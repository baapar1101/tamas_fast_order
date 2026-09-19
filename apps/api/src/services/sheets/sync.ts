import { eq, sql } from 'drizzle-orm';
import type { SyncEntity, SyncReport, SyncRun } from '@tamas/shared';
import { db } from '../../db/client.js';
import { syncConflicts, syncState } from '../../db/schema.js';
import { env } from '../../env.js';
import { rowHash } from '../../lib/hash.js';
import { invalidateCatalog } from '../catalog.js';
import { readTab, writeTab } from './client.js';
import {
  MAPPINGS,
  SYNC_ORDER,
  UPDATED_AT_COLUMN,
  markSynced,
  refreshLookups,
  type EntityMapping,
  type SheetCells,
} from './mapping.js';

/**
 * How the engine reaches the spreadsheet. Kept behind an interface so the
 * merge logic can be exercised against an in-memory sheet in tests without a
 * live Google account.
 */
export interface SheetTransport {
  read(tab: string): Promise<string[][]>;
  write(tab: string, rows: string[][]): Promise<void>;
}

const googleTransport: SheetTransport = { read: readTab, write: writeTab };

/**
 * Two-way sync between Postgres and Google Sheets.
 *
 * A pass over one tab does this:
 *   1. read the tab and the matching database rows
 *   2. for every key on both sides, compare each side against `sheet_hash` —
 *      the fingerprint saved the last time the two agreed. Whichever side moved
 *      away from that baseline is the side that changed. Only when *both* moved
 *      is it a real conflict, and then `updated_at` decides; every differing
 *      column is written to `sync_conflicts` so the panel can show what was
 *      overwritten and why
 *   3. keys only in the sheet are inserted into the database
 *   4. keys only in the database are appended to the sheet
 *   5. the whole tab is rewritten once, in a single API call, and the new
 *      baseline hashes are stored
 *
 * A row whose hash matches on both sides is left completely alone, which is
 * what keeps a 3000-row catalogue inside the Sheets rate limits.
 */

let running = false;

export function isSyncRunning(): boolean {
  return running;
}

interface SheetSideRow {
  key: string;
  cells: SheetCells;
  updatedAt: Date | null;
  hash: string;
}

function parseSheet(mapping: EntityMapping, rows: string[][]): { header: string[]; items: SheetSideRow[] } {
  if (rows.length === 0) return { header: mapping.columns, items: [] };
  const header = (rows[0] ?? []).map((h) => String(h).trim());
  const keyIdx = header.indexOf(mapping.keyColumn);
  if (keyIdx < 0) return { header, items: [] };

  const items: SheetSideRow[] = [];
  const seen = new Set<string>();

  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const key = String(row[keyIdx] ?? '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const cells: SheetCells = {};
    header.forEach((h, i) => {
      cells[h] = String(row[i] ?? '').trim();
    });

    const rawUpdated = cells[UPDATED_AT_COLUMN] ?? '';
    const parsed = rawUpdated ? new Date(rawUpdated) : null;
    items.push({
      key,
      cells,
      updatedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
      // The timestamp column is excluded so a row that only got restamped does
      // not read as an edit.
      // Ignore unrelated/formatted Google Sheet columns (for example the
      // automatic "Column 21" headers created by a Sheet table). Only the
      // mapping contract participates in change detection, matching dbHash.
      hash: rowHash(mapping.columns.filter((h) => h !== UPDATED_AT_COLUMN).map((h) => cells[h] ?? '')),
    });
  }
  return { header, items };
}

function hashCells(mapping: EntityMapping, cells: SheetCells): string {
  return rowHash(mapping.columns.filter((c) => c !== UPDATED_AT_COLUMN).map((c) => cells[c] ?? ''));
}

async function recordConflicts(
  mapping: EntityMapping,
  key: string,
  dbCells: SheetCells,
  sheetCells: SheetCells,
  winner: 'db' | 'sheet',
): Promise<number> {
  const rows = mapping.columns
    .filter((c) => c !== UPDATED_AT_COLUMN)
    .filter((c) => (dbCells[c] ?? '') !== (sheetCells[c] ?? ''))
    .map((field) => ({
      entity: mapping.entity,
      entityKey: key.slice(0, 200),
      field,
      dbValue: (dbCells[field] ?? '').slice(0, 4000),
      sheetValue: (sheetCells[field] ?? '').slice(0, 4000),
      resolvedTo: winner,
    }));

  if (rows.length > 0) await db.insert(syncConflicts).values(rows);
  return rows.length;
}

interface EntityResult {
  entity: string;
  pulled: number;
  pushed: number;
  created: number;
  updated: number;
  conflicts: number;
  skipped: number;
  error?: string;
}

async function syncEntity(
  entity: SyncEntity,
  direction: SyncRun['direction'],
  dryRun: boolean,
  transport: SheetTransport,
): Promise<EntityResult> {
  const mapping = MAPPINGS[entity];
  const result: EntityResult = { entity, pulled: 0, pushed: 0, created: 0, updated: 0, conflicts: 0, skipped: 0 };

  if (mapping.private && !env.SHEETS_SYNC_PRIVATE_DATA) {
    result.skipped = 1;
    return result;
  }

  const [sheetRaw, dbRows] = await Promise.all([transport.read(mapping.tab), mapping.loadDbRows()]);
  const { items: sheetRows } = parseSheet(mapping, sheetRaw);

  const sheetByKey = new Map(sheetRows.map((r) => [r.key, r]));
  const dbByKey = new Map(dbRows.map((r) => [r.key, r]));

  /* ---------- sheet → database ---------- */
  if (direction === 'pull' || direction === 'both') {
    for (const sheetRow of sheetRows) {
      const dbRow = dbByKey.get(sheetRow.key);

      if (!dbRow) {
        if (!dryRun) {
          const stamp = sheetRow.updatedAt ?? new Date();
          const outcome = await mapping.applySheetRow(sheetRow.key, sheetRow.cells, stamp);
          if (outcome === 'created') result.created += 1;
          else if (outcome === 'updated') result.updated += 1;
          else result.skipped += 1;
        }
        result.pulled += 1;
        continue;
      }

      const dbHash = hashCells(mapping, dbRow.cells);
      if (dbHash === sheetRow.hash) continue; // both sides already agree

      /*
       * Three-way merge against the hash captured the last time the two sides
       * agreed. This is what makes a hand edit in the sheet count even when
       * nobody touched the `updated_at` cell: if the sheet no longer matches
       * that baseline, someone changed it there.
       */
      const baseline = dbRow.sheetHash;
      const sheetChanged = baseline == null ? sheetRow.updatedAt != null : sheetRow.hash !== baseline;
      const dbChanged = baseline == null ? true : dbHash !== baseline;

      let sheetWins: boolean;
      if (sheetChanged && !dbChanged) {
        sheetWins = true;
      } else if (!sheetChanged && dbChanged) {
        sheetWins = false;
      } else {
        // Both sides moved (or there is no baseline at all): fall back to the
        // timestamps. A sheet row with no usable timestamp never wins here.
        sheetWins = (sheetRow.updatedAt?.getTime() ?? 0) > dbRow.updatedAt.getTime();
      }

      const bothChanged = sheetChanged && dbChanged;
      if (!dryRun && bothChanged) {
        result.conflicts += await recordConflicts(
          mapping,
          sheetRow.key,
          dbRow.cells,
          sheetRow.cells,
          sheetWins ? 'sheet' : 'db',
        );
      }

      if (sheetWins) {
        const editable = new Set(mapping.editableColumns);
        // Columns the sheet is not allowed to own keep the database value.
        const merged: SheetCells = { ...dbRow.cells };
        for (const col of mapping.columns) {
          if (editable.has(col)) merged[col] = sheetRow.cells[col] ?? '';
        }
        if (!dryRun) {
          // Stamped now, not from the cell: the edit is only being applied at
          // this moment, and a blank or stale cell must not look older than it.
          const outcome = await mapping.applySheetRow(sheetRow.key, merged, new Date());
          if (outcome === 'created') result.created += 1;
          else if (outcome === 'updated') result.updated += 1;
          else result.skipped += 1;
        }
        result.pulled += 1;
      }
    }

    // A pull-only pass still has to record the new baseline; in a `both` pass
    // the push step below does it after the sheet write lands.
    if (direction === 'pull' && !dryRun) {
      await markSynced(
        mapping,
        sheetRows.map((r) => ({ key: r.key, hash: r.hash })),
      );
    }
  }

  /* ---------- database → sheet ---------- */
  if (direction === 'push' || direction === 'both') {
    // Reload: the pull step above may have changed rows.
    const fresh = await mapping.loadDbRows();
    const out: string[][] = [mapping.columns];
    const marks: Array<{ key: string; hash: string }> = [];

    for (const row of fresh) {
      const sheetRow = sheetByKey.get(row.key);
      const dbHash = hashCells(mapping, row.cells);
      if (!sheetRow || sheetRow.hash !== dbHash) result.pushed += 1;
      out.push(mapping.columns.map((c) => row.cells[c] ?? ''));
      marks.push({ key: row.key, hash: dbHash });
    }

    // Rows the sheet has that the database does not are kept, so a person's
    // in-progress row is never wiped by a push.
    const dbKeys = new Set(fresh.map((r) => r.key));
    for (const sheetRow of sheetRows) {
      if (dbKeys.has(sheetRow.key)) continue;
      out.push(mapping.columns.map((c) => sheetRow.cells[c] ?? ''));
    }

    if (!dryRun) {
      await transport.write(mapping.tab, out);
      // Only after the write lands does the new baseline become true.
      await markSynced(mapping, marks);
    }
  }

  return result;
}

export async function runSync(options: SyncRun, transport: SheetTransport = googleTransport): Promise<SyncReport> {
  if (transport === googleTransport && !env.SHEETS_ENABLED) {
    throw new Error('همگام‌سازی گوگل شیت غیرفعال است (SHEETS_ENABLED=false).');
  }
  if (running) {
    throw new Error('یک همگام‌سازی در حال اجراست. تا پایان آن صبر کنید.');
  }
  running = true;
  const startedAt = new Date();
  const entities: EntityResult[] = [];

  try {
    await refreshLookups();
    const wanted = SYNC_ORDER.filter((e) => options.entities.includes(e));

    for (const entity of wanted) {
      try {
        const res = await syncEntity(entity, options.direction, options.dryRun, transport);
        entities.push(res);
        if (!options.dryRun) {
          await db
            .insert(syncState)
            .values({
              entity,
              lastPulledAt: options.direction !== 'push' ? new Date() : null,
              lastPushedAt: options.direction !== 'pull' ? new Date() : null,
              rowsPulled: res.pulled,
              rowsPushed: res.pushed,
              lastError: null,
            })
            .onConflictDoUpdate({
              target: syncState.entity,
              set: {
                lastPulledAt: options.direction !== 'push' ? new Date() : sql`${syncState.lastPulledAt}`,
                lastPushedAt: options.direction !== 'pull' ? new Date() : sql`${syncState.lastPushedAt}`,
                rowsPulled: res.pulled,
                rowsPushed: res.pushed,
                lastError: null,
              },
            });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        entities.push({ entity, pulled: 0, pushed: 0, created: 0, updated: 0, conflicts: 0, skipped: 0, error: message });
        await db
          .insert(syncState)
          .values({ entity, lastError: message })
          .onConflictDoUpdate({ target: syncState.entity, set: { lastError: message } });
      }
    }

    if (!options.dryRun) invalidateCatalog();

    return {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      dryRun: options.dryRun,
      entities,
    };
  } finally {
    running = false;
  }
}

/** Drops conflict rows older than 30 days so the table stays readable. */
export async function pruneConflicts(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 86_400_000);
  const rows = await db
    .delete(syncConflicts)
    .where(sql`${syncConflicts.createdAt} < ${cutoff}`)
    .returning({ id: syncConflicts.id });
  return rows.length;
}

export async function readSyncState() {
  return db.select().from(syncState);
}

export async function clearSyncError(entity: string): Promise<void> {
  await db.update(syncState).set({ lastError: null }).where(eq(syncState.entity, entity));
}
