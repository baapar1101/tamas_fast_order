import { count, desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { SYNC_ENTITIES, syncRunSchema } from '@tamas/shared';
import { db } from '../../db/client.js';
import { syncConflicts } from '../../db/schema.js';
import { env } from '../../env.js';
import { badRequest } from '../../lib/errors.js';
import { offsetOf } from '../../lib/pagination.js';
import { clearSyncError, isSyncRunning, readSyncState, runSync } from '../../services/sheets/sync.js';
import { logAction } from '../../services/audit.js';

const conflictQuery = z.object({
  entity: z.enum(SYNC_ENTITIES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_settings'));

  app.get('/admin/sync/status', async () => {
    const state = await readSyncState();
    return {
      ok: true,
      enabled: env.SHEETS_ENABLED,
      running: isSyncRunning(),
      spreadsheetId: env.SHEETS_SPREADSHEET_ID,
      intervalSeconds: env.SHEETS_SYNC_INTERVAL_SECONDS,
      syncPrivateData: env.SHEETS_SYNC_PRIVATE_DATA,
      entities: state.map((s) => ({
        entity: s.entity,
        lastPulledAt: s.lastPulledAt?.toISOString() ?? null,
        lastPushedAt: s.lastPushedAt?.toISOString() ?? null,
        rowsPulled: s.rowsPulled,
        rowsPushed: s.rowsPushed,
        lastError: s.lastError,
      })),
    };
  });

  /** Runs a pass on demand. `dryRun` reports what would change without writing. */
  app.post('/admin/sync/run', async (req) => {
    if (!env.SHEETS_ENABLED) throw badRequest('همگام‌سازی گوگل شیت غیرفعال است (SHEETS_ENABLED=false).');
    const body = syncRunSchema.parse(req.body ?? {});
    const report = await runSync(body);
    await logAction(req.currentUser!.id, `sync:${body.direction}`, 'sheets', null, {
      dryRun: body.dryRun,
      entities: body.entities,
    });
    return { ok: true, report };
  });

  app.get('/admin/sync/conflicts', async (req) => {
    const q = conflictQuery.parse(req.query);
    const where = q.entity ? eq(syncConflicts.entity, q.entity) : undefined;

    const [rows, [total]] = await Promise.all([
      db
        .select()
        .from(syncConflicts)
        .where(where)
        .orderBy(desc(syncConflicts.createdAt))
        .limit(q.perPage)
        .offset(offsetOf(q)),
      db.select({ n: count() }).from(syncConflicts).where(where),
    ]);

    return {
      ok: true,
      items: rows.map((r) => ({
        id: r.id,
        entity: r.entity,
        entityKey: r.entityKey,
        field: r.field,
        dbValue: r.dbValue,
        sheetValue: r.sheetValue,
        resolvedTo: r.resolvedTo,
        createdAt: r.createdAt.toISOString(),
      })),
      total: Number(total?.n ?? 0),
      page: q.page,
      perPage: q.perPage,
    };
  });

  app.delete('/admin/sync/conflicts', async () => {
    await db.delete(syncConflicts);
    return { ok: true, message: 'تاریخچه تضادها پاک شد.' };
  });

  app.post('/admin/sync/clear-error', async (req) => {
    const { entity } = z.object({ entity: z.enum(SYNC_ENTITIES) }).parse(req.body);
    await clearSyncError(entity);
    return { ok: true };
  });
};

export default routes;
