import type { FastifyBaseLogger } from 'fastify';
import { SYNC_ENTITIES } from '@tamas/shared';
import { env } from './env.js';
import { pruneSessions } from './services/auth.js';
import { pruneOtpCodes } from './services/otp.js';
import { isSyncRunning, pruneConflicts, runSync } from './services/sheets/sync.js';

/**
 * Background work: the periodic Sheets pass plus the small housekeeping jobs.
 * Everything here is best-effort — a failure is logged and the next tick tries
 * again rather than taking the API down with it.
 */
export function startScheduler(log: FastifyBaseLogger): () => void {
  const timers: NodeJS.Timeout[] = [];

  if (env.SHEETS_ENABLED && env.SHEETS_SYNC_INTERVAL_SECONDS > 0) {
    const interval = env.SHEETS_SYNC_INTERVAL_SECONDS * 1000;
    const tick = async () => {
      if (isSyncRunning()) return;
      try {
        const report = await runSync({ direction: 'both', entities: [...SYNC_ENTITIES], dryRun: false });
        const totals = report.entities.reduce(
          (acc, e) => ({ pulled: acc.pulled + e.pulled, pushed: acc.pushed + e.pushed }),
          { pulled: 0, pushed: 0 },
        );
        if (totals.pulled > 0 || totals.pushed > 0) log.info({ totals }, 'sheets sync finished');
      } catch (err) {
        log.error({ err }, 'sheets sync failed');
      }
    };
    // Give the process a moment to finish booting before the first pass.
    timers.push(setTimeout(() => void tick(), 15_000));
    timers.push(setInterval(() => void tick(), interval));
    log.info(`sheets sync scheduled every ${env.SHEETS_SYNC_INTERVAL_SECONDS}s`);
  }

  const housekeeping = async () => {
    try {
      const [sessions, otps, conflicts] = await Promise.all([pruneSessions(), pruneOtpCodes(), pruneConflicts()]);
      if (sessions + otps + conflicts > 0) log.debug({ sessions, otps, conflicts }, 'housekeeping pruned rows');
    } catch (err) {
      log.warn({ err }, 'housekeeping failed');
    }
  };
  timers.push(setTimeout(() => void housekeeping(), 60_000));
  timers.push(setInterval(() => void housekeeping(), 6 * 3600 * 1000));

  return () => {
    for (const t of timers) {
      clearTimeout(t);
      clearInterval(t);
    }
  };
}
