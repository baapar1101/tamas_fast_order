/**
 * Manual sync from the command line — the replacement for the old
 * `sync_spreadsheet.py --pull / --push / --diff`.
 *
 *   npm run sync:pull
 *   npm run sync:push
 *   npx tsx scripts/sync-cli.ts both --dry-run
 */
import { SYNC_ENTITIES, type SyncEntity } from '@tamas/shared';
import { closeDb } from '../src/db/client.js';
import { runSync } from '../src/services/sheets/sync.js';

const [directionArg = 'both', ...rest] = process.argv.slice(2);
const direction = (['pull', 'push', 'both'] as const).includes(directionArg as never)
  ? (directionArg as 'pull' | 'push' | 'both')
  : 'both';

const dryRun = rest.includes('--dry-run');
const only = rest
  .filter((a) => a.startsWith('--only='))
  .flatMap((a) => a.slice(7).split(','))
  .filter((e): e is SyncEntity => (SYNC_ENTITIES as readonly string[]).includes(e));

async function main(): Promise<void> {
  const report = await runSync({
    direction,
    entities: only.length > 0 ? only : [...SYNC_ENTITIES],
    dryRun,
  });

  console.log(`\n${dryRun ? '[dry run] ' : ''}sync ${direction} — ${report.startedAt} → ${report.finishedAt}\n`);
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(pad('entity', 14) + pad('pulled', 8) + pad('pushed', 8) + pad('new', 6) + pad('upd', 6) + 'conflicts');
  console.log('-'.repeat(60));
  for (const e of report.entities) {
    console.log(
      pad(e.entity, 14) +
        pad(String(e.pulled), 8) +
        pad(String(e.pushed), 8) +
        pad(String(e.created), 6) +
        pad(String(e.updated), 6) +
        String(e.conflicts) +
        (e.error ? `   ❌ ${e.error}` : ''),
    );
  }
  console.log('');
  await closeDb();
}

main().catch(async (err) => {
  console.error('❌ sync failed:', err instanceof Error ? err.message : err);
  await closeDb().catch(() => {});
  process.exit(1);
});
