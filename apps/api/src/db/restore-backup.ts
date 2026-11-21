/**
 * Restores a database backup made by the daily Telegram backup
 * (`tamas-database-YYYY-MM-DD-HHMMSS.json.gz`) into the configured database.
 *
 *   node dist/src/db/restore-backup.js /path/to/tamas-database-….json.gz [--replace]
 *
 * Run it after migrations (the API applies them on start), so every table
 * exists. Each table in the backup is emptied and refilled inside one
 * transaction; columns the backup does not have keep their defaults, and
 * columns or tables the current schema no longer has are skipped. Refuses to
 * touch a database that already has customers or orders unless --replace.
 */
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import type postgres from 'postgres';
import { closeDb, sql } from './client.js';

interface BackupColumn { name: string; postgresType: string }
interface BackupTable { name: string; columns: BackupColumn[]; rows: Array<Record<string, unknown>> }
interface BackupFile { format: string; version: number; createdAt: string; database?: string; tables: BackupTable[] }

const BATCH_SIZE = 500;
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

async function readBackup(path: string): Promise<BackupFile> {
  const chunks: Buffer[] = [];
  const source = createReadStream(path);
  const stream = path.endsWith('.gz') ? source.pipe(createGunzip()) : source;
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as BackupFile;
  if (parsed?.format !== 'tamas-database-backup' || !Array.isArray(parsed.tables)) {
    throw new Error('This file is not a Tamas database backup (tamas-database-….json.gz).');
  }
  return parsed;
}

/** The Tehran calendar day of a date the backup wrote as an ISO instant. */
function tehranDay(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith('--'));
  const replace = args.includes('--replace');
  if (!file) {
    console.error('Usage: node dist/src/db/restore-backup.js <tamas-database-….json.gz> [--replace]');
    process.exit(2);
  }

  const backup = await readBackup(file);
  console.log(`backup from ${backup.createdAt} (${backup.tables.length} tables)`);

  const columnRows = await sql<{ table_name: string; column_name: string; udt_name: string; is_identity: string; is_generated: string }[]>`
    select table_name, column_name, udt_name, is_identity, is_generated
    from information_schema.columns where table_schema = 'public'
  `;
  const current = new Map<string, Map<string, { type: string; writable: boolean }>>();
  for (const row of columnRows) {
    if (!current.has(row.table_name)) current.set(row.table_name, new Map());
    current.get(row.table_name)!.set(row.column_name, { type: row.udt_name, writable: row.is_generated !== 'ALWAYS' });
  }
  if (!current.has('users')) throw new Error('The database has no tables yet: run the migrations first (start the API once).');

  if (!replace) {
    const [counts] = await sql<{ users: number; orders: number }[]>`
      select (select count(*)::int from users) as users, (select count(*)::int from orders) as orders
    `;
    const users = counts?.users ?? 0;
    const orders = counts?.orders ?? 0;
    if (users > 0 || orders > 0) {
      throw new Error(`The database already has ${users} users and ${orders} orders. Add --replace to overwrite them with the backup.`);
    }
  }

  const tables = backup.tables.filter((table) => IDENTIFIER.test(table.name) && current.has(table.name));
  const skippedTables = backup.tables.filter((table) => !tables.includes(table)).map((table) => table.name);

  const report: Array<{ table: string; rows: number; skippedColumns: string[] }> = [];
  await sql.begin(async (tx) => {
    // Rows go in table by table, so foreign keys are checked only at the end.
    await tx`set local session_replication_role = replica`;
    if (tables.length) await tx.unsafe(`truncate ${tables.map((table) => `"${table.name}"`).join(', ')} restart identity cascade`);

    for (const table of tables) {
      const target = current.get(table.name)!;
      const columns = table.columns.map((column) => column.name).filter((name) => target.get(name)?.writable);
      const skippedColumns = table.columns.map((column) => column.name).filter((name) => !columns.includes(name));
      const convert = (name: string, value: unknown): unknown => {
        if (value === null || value === undefined) return null;
        const type = target.get(name)!.type;
        // Drizzle replaces the client's JSON serializer, so JSON goes in as text.
        if (type === 'json' || type === 'jsonb') return JSON.stringify(value);
        if (type === 'date' && typeof value === 'string') return tehranDay(value);
        return value;
      };
      for (let start = 0; start < table.rows.length; start += BATCH_SIZE) {
        const batch = table.rows.slice(start, start + BATCH_SIZE).map((row) =>
          Object.fromEntries(columns.map((name) => [name, convert(name, row[name])])) as Record<string, postgres.ParameterOrJSON<never>>);
        if (batch.length && columns.length) await tx`insert into ${tx(table.name)} ${tx(batch, columns)}`;
      }
      report.push({ table: table.name, rows: table.rows.length, skippedColumns });
    }

    // Serial ids continue after the restored rows.
    const serials = await tx<{ table_name: string; column_name: string }[]>`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public' and column_default like 'nextval(%'
    `;
    for (const { table_name: tableName, column_name: columnName } of serials) {
      if (!tables.some((table) => table.name === tableName)) continue;
      await tx.unsafe(
        `select setval(pg_get_serial_sequence($1, $2), coalesce((select max("${columnName}") from "${tableName}"), 0) + 1, false)`,
        [`public."${tableName}"`, columnName],
      );
    }
  });

  for (const entry of report) {
    const note = entry.skippedColumns.length ? `  (skipped columns: ${entry.skippedColumns.join(', ')})` : '';
    console.log(`  ${entry.table.padEnd(32)} ${String(entry.rows).padStart(7)}${note}`);
  }
  if (skippedTables.length) console.log(`skipped tables not in this schema: ${skippedTables.join(', ')}`);
  console.log(`✅ restored ${report.reduce((sum, entry) => sum + entry.rows, 0)} rows into ${report.length} tables`);
  await closeDb();
}

main().catch(async (err) => {
  console.error('❌ restore failed:', err instanceof Error ? err.message : err);
  await closeDb().catch(() => {});
  process.exit(1);
});
