import { and, asc, desc, eq, isNotNull, isNull, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { crmSyncLogs, products } from '../db/schema.js';
import { crmClient, type CrmSyncResult } from '../lib/crm.js';
import { getCrmConfig } from './settings.js';

type ProductSyncAction = 'create' | 'update' | 'delete';

export interface CrmProductSyncReport {
  processed: number;
  succeeded: number;
  failed: number;
}

let running = false;

export function isCrmProductSyncRunning(): boolean {
  return running;
}

export async function enqueueCrmProductSync(
  productId: string,
  action: ProductSyncAction,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const [pending] = await db
    .select({ id: crmSyncLogs.id })
    .from(crmSyncLogs)
    .where(and(
      eq(crmSyncLogs.entity, 'product'),
      eq(crmSyncLogs.entityKey, productId),
      eq(crmSyncLogs.action, action),
      eq(crmSyncLogs.status, 'pending'),
    ))
    .limit(1);
  if (pending) return;

  const [previous] = await db
    .select({ remoteId: crmSyncLogs.remoteId })
    .from(crmSyncLogs)
    .where(and(
      eq(crmSyncLogs.entity, 'product'),
      eq(crmSyncLogs.entityKey, productId),
      isNotNull(crmSyncLogs.remoteId),
    ))
    .orderBy(desc(crmSyncLogs.createdAt))
    .limit(1);

  await db.insert(crmSyncLogs).values({
    entity: 'product',
    entityKey: productId,
    action,
    status: 'pending',
    remoteId: previous?.remoteId ?? null,
    payload: { ...payload, attempt: 0 },
  });
}

async function pushCurrentProduct(
  productId: string,
  knownRemoteId?: string,
): Promise<CrmSyncResult> {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.productId, productId), isNull(products.deletedAt)))
    .limit(1);
  const config = await getCrmConfig();
  if (!row) return crmClient.deleteProduct(productId, config, knownRemoteId);
  return crmClient.pushProduct({
    productId: row.productId,
    sku: row.sku,
    title: row.title,
    model: row.model,
    price: row.price,
    oldPrice: row.oldPrice,
    discount: row.discount,
    stock: row.stock,
    kermanStock: row.kermanStock,
    tehranStock: row.tehranStock,
    status: row.status,
    description: row.description,
    imageUrl: row.imageUrl,
    updatedAt: row.updatedAt.toISOString(),
  }, config, { retries: 0 });
}

export async function processPendingCrmProductSync(limit = 2): Promise<CrmProductSyncReport> {
  if (running) return { processed: 0, succeeded: 0, failed: 0 };
  running = true;
  const report: CrmProductSyncReport = { processed: 0, succeeded: 0, failed: 0 };
  try {
    const config = await getCrmConfig();
    if (!config.syncEnabled || !config.apiBase || !config.apiKey) return report;

    const jobs = await db
      .select()
      .from(crmSyncLogs)
      .where(and(eq(crmSyncLogs.entity, 'product'), eq(crmSyncLogs.status, 'pending')))
      .orderBy(asc(crmSyncLogs.createdAt))
      .limit(Math.max(1, Math.min(limit, 100)));

    const updates: {
      id: number;
      status: 'success' | 'error';
      remoteId: string | null;
      error: string | null;
      response: Record<string, unknown>;
      durationMs: number;
    }[] = [];
    const retries: (typeof crmSyncLogs.$inferInsert)[] = [];

    for (const job of jobs) {
      const started = Date.now();
      const result = job.action === 'delete'
        ? await crmClient.deleteProduct(job.entityKey, config, job.remoteId ?? undefined)
        : await pushCurrentProduct(job.entityKey, job.remoteId ?? undefined);
      report.processed += 1;

      if (result.ok) {
        report.succeeded += 1;
        updates.push({
          id: job.id,
          status: 'success',
          remoteId: result.remoteId?.toString() ?? job.remoteId,
          error: null,
          response: result as unknown as Record<string, unknown>,
          durationMs: Date.now() - started,
        });
        continue;
      }

      report.failed += 1;
      const attempt = Number(job.payload?.attempt ?? 0);
      updates.push({
        id: job.id,
        status: 'error',
        remoteId: job.remoteId ?? null,
        error: result.error ?? 'CRM sync failed',
        response: result as unknown as Record<string, unknown>,
        durationMs: Date.now() - started,
      });

      if (attempt < 49) {
        retries.push({
          entity: 'product',
          entityKey: job.entityKey,
          action: job.action,
          status: 'pending',
          remoteId: job.remoteId,
          payload: { ...(job.payload ?? {}), attempt: attempt + 1 },
        });
      }
    }

    if (updates.length > 0) {
      const ids = updates.map((u) => u.id);
      await db.update(crmSyncLogs)
        .set({
          status: sql`case ${sql.join(
            updates.map((u) => sql`when ${crmSyncLogs.id} = ${u.id} then ${u.status}::varchar`),
            sql` `
          )} end`,
          remoteId: sql`case ${sql.join(
            updates.map((u) => sql`when ${crmSyncLogs.id} = ${u.id} then ${u.remoteId}`),
            sql` `
          )} end`,
          error: sql`case ${sql.join(
            updates.map((u) => sql`when ${crmSyncLogs.id} = ${u.id} then ${u.error}`),
            sql` `
          )} end`,
          response: sql`case ${sql.join(
            updates.map((u) => sql`when ${crmSyncLogs.id} = ${u.id} then ${u.response}::jsonb`),
            sql` `
          )} end`,
          durationMs: sql`case ${sql.join(
            updates.map((u) => sql`when ${crmSyncLogs.id} = ${u.id} then ${u.durationMs}`),
            sql` `
          )} end`,
        })
        .where(inArray(crmSyncLogs.id, ids));
    }

    if (retries.length > 0) {
      await db.insert(crmSyncLogs).values(retries);
    }

    return report;
  } finally {
    running = false;
  }
}
