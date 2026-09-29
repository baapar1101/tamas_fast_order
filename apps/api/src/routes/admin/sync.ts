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
import { isPriceStockSyncRunning, syncPriceStockFromSheet } from '../../services/sheets/price-stock-sync.js';
import { processExcelUpload } from '../../services/sheets/excel-sync.js';
import { logAction } from '../../services/audit.js';
import * as xlsx from 'xlsx';

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

  /**
   * Lightweight price & stock sync from the public Google Sheet.
   * Google Sheet is the source of truth — this only updates price,
   * old_price, discount, kerman_stock, tehran_stock, stock.
   */
  app.post('/admin/sync/price-stock', async (req) => {
    if (isPriceStockSyncRunning()) {
      throw badRequest('همگام‌سازی قیمت/موجودی در حال اجراست. صبر کنید.');
    }
    const report = await syncPriceStockFromSheet();
    await logAction(req.currentUser!.id, 'sync:price-stock', 'sheets', null, {
      updated: report.updated,
      skipped: report.skipped,
      totalRows: report.totalRows,
    });
    return { ok: true, report };
  });

  /** Returns the current status of the price-stock sync. */
  app.get('/admin/sync/price-stock/status', async () => {
    return { ok: true, running: isPriceStockSyncRunning() };
  });

  /** Download sample Excel for updating price/stock */
  app.get('/admin/sync/excel-template', async (req, reply) => {
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([
      ['sku', 'price', 'kerman_stock', 'tehran_stock'],
      ['1001', '1500000', '10', '5'],
      ['1002', '2000000', '0', '20'],
    ]);
    // Adjust column widths
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    xlsx.utils.book_append_sheet(wb, ws, 'Prices');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    reply.header('Content-Disposition', 'attachment; filename="price-update-template.xlsx"');
    reply.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return reply.send(buffer);
  });

  /** Upload Excel to update price/stock in Google Sheets & DB */
  app.post('/admin/sync/excel-upload', async (req, reply) => {
    if (isPriceStockSyncRunning()) {
      throw badRequest('همگام‌سازی قیمت/موجودی در حال اجراست. صبر کنید.');
    }
    
    const file = await req.file();
    if (!file) {
      throw badRequest('فایلی برای آپلود انتخاب نشده است.');
    }

    const buffer = await file.toBuffer();
    const report = await processExcelUpload(buffer);
    
    await logAction(req.currentUser!.id, 'sync:excel-upload', 'sheets', null, {
      updated: report.updated,
      skipped: report.skipped,
      totalRows: report.totalRows,
    });
    
    return { ok: true, report };
  });
};

export default routes;
