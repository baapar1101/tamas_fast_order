import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { once } from 'node:events';
import { resolve } from 'node:path';
import type { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { sql } from '../db/client.js';
import { getAllSettings, setSetting } from './settings.js';
import { sendTelegramDocumentToGroup } from './telegram.js';

const BACKUP_DIRECTORY = resolve(process.cwd(), '.private', 'backups', 'telegram');
const RETRY_DELAY_MS = 30 * 60 * 1000;

export interface TelegramBackupConfig {
  enabled: boolean;
  time: string;
  groupId: string;
  retentionDays: number;
}

export interface TehranClock {
  date: string;
  time: string;
  hour: number;
  minute: number;
}

export interface TelegramBackupResult {
  fileName: string;
  size: number;
  checksum: string;
  tableCount: number;
  rowCount: number;
  groupName: string;
  sentAt: string;
}

interface BackupTable {
  table_name: string;
}

interface BackupColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
  ordinal_position: number;
}

let backupRunning = false;

function parseBool(value: string | undefined): boolean {
  return value != null && !['', 'false', '0', 'no', 'off'].includes(value.toLowerCase());
}

function normalizeTime(value: string | undefined): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value?.trim() ?? '');
  if (!match) return '03:00';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return '03:00';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseTelegramBackupConfig(settings: Record<string, string>): TelegramBackupConfig {
  const retention = Number.parseInt(settings.TELEGRAM_BACKUP_RETENTION_DAYS ?? '3', 10);
  return {
    enabled: parseBool(settings.TELEGRAM_BACKUP_ENABLED),
    time: normalizeTime(settings.TELEGRAM_BACKUP_TIME),
    groupId: (settings.TELEGRAM_BACKUP_GROUP_ID ?? '').trim(),
    retentionDays: Number.isFinite(retention) ? Math.min(30, Math.max(0, retention)) : 3,
  };
}

export function getTehranClock(now = new Date()): TehranClock {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(value('hour'));
  const minute = Number(value('minute'));
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    hour,
    minute,
  };
}

export function isTelegramBackupDue(
  config: TelegramBackupConfig,
  clock: TehranClock,
  lastSentDate: string | undefined,
  lastAttemptAt: string | undefined,
  now = new Date(),
): boolean {
  if (!config.enabled || !config.groupId || lastSentDate === clock.date || clock.time < config.time) return false;
  if (!lastAttemptAt) return true;
  const attempted = new Date(lastAttemptAt).getTime();
  return !Number.isFinite(attempted) || now.getTime() - attempted >= RETRY_DELAY_MS;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
}

async function writeChunk(stream: Writable, chunk: string): Promise<void> {
  if (!stream.write(chunk, 'utf8')) await once(stream, 'drain');
}

function quoteIdentifier(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) throw new Error('نام جدول نامعتبر در پایگاه داده.');
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

async function createDatabaseBackup(now = new Date()): Promise<{
  path: string;
  fileName: string;
  size: number;
  checksum: string;
  tableCount: number;
  rowCount: number;
}> {
  await mkdir(BACKUP_DIRECTORY, { recursive: true, mode: 0o700 });
  const clock = getTehranClock(now);
  const timestamp = now.toISOString().slice(11, 19).replaceAll(':', '');
  const fileName = `tamas-database-${clock.date}-${timestamp}.json.gz`;
  const path = resolve(BACKUP_DIRECTORY, fileName);

  const tables = await sql<BackupTable[]>`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `;
  const columns = await sql<BackupColumn[]>`
    select table_name, column_name, data_type, udt_name, is_nullable, column_default, ordinal_position
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `;
  const databaseRows = await sql<{ database_name: string }[]>`select current_database() as database_name`;
  const databaseName = databaseRows[0]?.database_name ?? 'database';

  const gzip = createGzip({ level: 9 });
  const output = createWriteStream(path, { mode: 0o600 });
  const completion = pipeline(gzip, output);
  let rowCount = 0;

  try {
    await writeChunk(gzip, `{"format":"tamas-database-backup","version":1,"createdAt":${safeJson(now.toISOString())},"timezone":"Asia/Tehran","database":${safeJson(databaseName)},"tables":[`);
    for (const [tableIndex, table] of tables.entries()) {
      const tableColumns = columns
        .filter((column) => column.table_name === table.table_name)
        .map((column) => ({
          name: column.column_name,
          dataType: column.data_type,
          postgresType: column.udt_name,
          nullable: column.is_nullable === 'YES',
          default: column.column_default,
        }));
      const rows = await sql.unsafe(`select * from public.${quoteIdentifier(table.table_name)}`) as unknown as Array<Record<string, unknown>>;
      if (tableIndex > 0) await writeChunk(gzip, ',');
      await writeChunk(gzip, `{"name":${safeJson(table.table_name)},"columns":${safeJson(tableColumns)},"rows":[`);
      for (const [rowIndex, row] of rows.entries()) {
        if (rowIndex > 0) await writeChunk(gzip, ',');
        await writeChunk(gzip, safeJson(row));
        rowCount += 1;
      }
      await writeChunk(gzip, ']}');
    }
    await writeChunk(gzip, ']}');
    gzip.end();
    await completion;
  } catch (error) {
    gzip.destroy();
    await completion.catch(() => undefined);
    await rm(path, { force: true }).catch(() => undefined);
    throw error;
  }

  await chmod(path, 0o600).catch(() => undefined);
  const file = await stat(path);
  return {
    path,
    fileName,
    size: file.size,
    checksum: await sha256File(path),
    tableCount: tables.length,
    rowCount,
  };
}

async function setBackupStatus(values: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(values)) await setSetting(key, value);
}

async function pruneLocalBackups(retentionDays: number, now = new Date()): Promise<void> {
  const entries = await readdir(BACKUP_DIRECTORY, { withFileTypes: true }).catch(() => []);
  const cutoff = now.getTime() - retentionDays * 86_400_000;
  for (const entry of entries) {
    if (!entry.isFile() || !/^tamas-database-.*\.json\.gz$/.test(entry.name)) continue;
    const path = resolve(BACKUP_DIRECTORY, entry.name);
    const info = await stat(path).catch(() => null);
    if (retentionDays === 0 || (info && info.mtimeMs < cutoff)) await rm(path, { force: true });
  }
}

export function isTelegramBackupRunning(): boolean {
  return backupRunning;
}

export async function runTelegramBackup(options: { force?: boolean; now?: Date } = {}): Promise<TelegramBackupResult> {
  if (backupRunning) throw new Error('فرایند بکاپ دیگری در حال اجرا است.');
  backupRunning = true;
  const now = options.now ?? new Date();
  const attemptAt = now.toISOString();
  let backupPath = '';
  let retentionDays = 3;

  try {
    const settings = await getAllSettings();
    const config = parseTelegramBackupConfig(settings);
    retentionDays = config.retentionDays;
    if (!options.force && !config.enabled) throw new Error('بکاپ روزانه تلگرام غیرفعال است.');
    if (!config.groupId) throw new Error('گروه مقصد بکاپ انتخاب نشده است.');

    await setBackupStatus({
      TELEGRAM_BACKUP_LAST_STATUS: 'running',
      TELEGRAM_BACKUP_LAST_ATTEMPT_AT: attemptAt,
      TELEGRAM_BACKUP_LAST_ERROR: '',
    });
    const backup = await createDatabaseBackup(now);
    backupPath = backup.path;
    const sent = await sendTelegramDocumentToGroup(
      config.groupId,
      backup.path,
      backup.fileName,
      `بکاپ روزانه تماس مارکت\n${backup.tableCount.toLocaleString('fa-IR')} جدول، ${backup.rowCount.toLocaleString('fa-IR')} رکورد\nSHA-256: ${backup.checksum.slice(0, 16)}…`,
    );
    const sentAt = new Date().toISOString();
    const clock = getTehranClock(now);
    await setBackupStatus({
      TELEGRAM_BACKUP_LAST_STATUS: 'success',
      TELEGRAM_BACKUP_LAST_SENT_DATE: clock.date,
      TELEGRAM_BACKUP_LAST_SENT_AT: sentAt,
      TELEGRAM_BACKUP_LAST_ERROR: '',
      TELEGRAM_BACKUP_LAST_FILE: backup.fileName,
      TELEGRAM_BACKUP_LAST_SIZE: String(backup.size),
      TELEGRAM_BACKUP_LAST_TABLE_COUNT: String(backup.tableCount),
      TELEGRAM_BACKUP_LAST_ROW_COUNT: String(backup.rowCount),
      TELEGRAM_BACKUP_LAST_CHECKSUM: backup.checksum,
    });
    await pruneLocalBackups(config.retentionDays, now);
    return {
      fileName: backup.fileName,
      size: backup.size,
      checksum: backup.checksum,
      tableCount: backup.tableCount,
      rowCount: backup.rowCount,
      groupName: sent.groupName,
      sentAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setBackupStatus({
      TELEGRAM_BACKUP_LAST_STATUS: 'error',
      TELEGRAM_BACKUP_LAST_ATTEMPT_AT: attemptAt,
      TELEGRAM_BACKUP_LAST_ERROR: message.slice(0, 1000),
    }).catch(() => undefined);
    throw error;
  } finally {
    if (retentionDays === 0 && backupPath) await rm(backupPath, { force: true }).catch(() => undefined);
    backupRunning = false;
  }
}

export async function runScheduledTelegramBackup(now = new Date()): Promise<TelegramBackupResult | null> {
  if (backupRunning) return null;
  const settings = await getAllSettings();
  const config = parseTelegramBackupConfig(settings);
  const clock = getTehranClock(now);
  if (!isTelegramBackupDue(
    config,
    clock,
    settings.TELEGRAM_BACKUP_LAST_SENT_DATE,
    settings.TELEGRAM_BACKUP_LAST_ATTEMPT_AT,
    now,
  )) return null;
  return runTelegramBackup({ now });
}

