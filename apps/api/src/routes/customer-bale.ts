import type { FastifyPluginAsync } from 'fastify';
import { count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { customerBaleAccounts, customerBaleLinkTokens } from '../db/schema.js';
import { badRequest } from '../lib/errors.js';
import {
  configureCustomerBaleWebhook,
  createCustomerBaleLink,
  getCustomerBaleConfig,
  handleCustomerBaleUpdate,
  testCustomerBaleBot,
  type CustomerBaleUpdate,
} from '../services/customer-bale.js';

const updateSchema = z.object({ update_id: z.number().int().nonnegative() }).passthrough();

const routes: FastifyPluginAsync = async (app) => {
  app.post('/bale/customer/webhook/:secret', async (req, reply) => {
    const config = await getCustomerBaleConfig();
    if (!config.webhookSecret || (req.params as { secret: string }).secret !== config.webhookSecret) {
      return reply.status(401).send({ ok: false, error: 'invalid bale secret' });
    }
    const update = updateSchema.parse(req.body) as CustomerBaleUpdate;
    void handleCustomerBaleUpdate(update).catch((error) => req.log.error({ err: error }, 'customer Bale update failed'));
    return { ok: true };
  });

  app.get('/customer-bale/status', { preHandler: app.requireUser }, async (req) => {
    const config = await getCustomerBaleConfig();
    const [account] = await db.select().from(customerBaleAccounts).where(eq(customerBaleAccounts.userId, req.currentUser!.id)).limit(1);
    return { ok: true, enabled: config.enabled && Boolean(config.botToken && config.botUsername), botUsername: config.botUsername,
      account: account ? { linked: true, username: account.username, notificationsEnabled: account.notificationsEnabled, linkedAt: account.linkedAt.toISOString() } : { linked: false } };
  });

  app.post('/customer-bale/link', { preHandler: app.requireUser }, async (req) => {
    try { return { ok: true, ...(await createCustomerBaleLink(req.currentUser!.id)) }; }
    catch (error) { throw badRequest((error as Error).message); }
  });

  app.delete('/customer-bale/link', { preHandler: app.requireUser }, async (req) => {
    await db.transaction(async (tx) => {
      await tx.delete(customerBaleLinkTokens).where(eq(customerBaleLinkTokens.userId, req.currentUser!.id));
      await tx.delete(customerBaleAccounts).where(eq(customerBaleAccounts.userId, req.currentUser!.id));
    });
    return { ok: true };
  });

  app.get('/admin/customer-bale/stats', { preHandler: app.requirePermission('manage_settings') }, async () => {
    const [[linked], [notified]] = await Promise.all([
      db.select({ value: count() }).from(customerBaleAccounts),
      db.select({ value: count() }).from(customerBaleAccounts).where(eq(customerBaleAccounts.notificationsEnabled, true)),
    ]);
    return { ok: true, linked: Number(linked?.value ?? 0), notificationsEnabled: Number(notified?.value ?? 0) };
  });

  app.post('/admin/customer-bale/test', { preHandler: app.requirePermission('manage_settings') }, async () => {
    try { const result = await testCustomerBaleBot(); return { ok: true, ...result, message: `اتصال ربات بله ${result.botUsername ? `@${result.botUsername}` : ''} موفق بود.` }; }
    catch (error) { throw badRequest(`تست ربات بله ناموفق بود: ${(error as Error).message}`); }
  });

  app.post('/admin/customer-bale/webhook', { preHandler: app.requirePermission('manage_settings') }, async (req) => {
    const body = z.object({ webhookUrl: z.string().url().max(1000).optional() }).parse(req.body ?? {});
    const webhookUrl = body.webhookUrl || `${req.protocol}://${req.hostname}/api/bale/customer/webhook`;
    try { const result = await configureCustomerBaleWebhook(webhookUrl); return { ok: true, ...result, message: 'Webhook ربات بله با موفقیت و مسیر محرمانه متصل شد.' }; }
    catch (error) { throw badRequest(`راه‌اندازی ربات بله ناموفق بود: ${(error as Error).message}`); }
  });
};

export default routes;
