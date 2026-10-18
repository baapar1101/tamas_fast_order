import type { FastifyPluginAsync } from 'fastify';
import { count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { customerTelegramAccounts, customerTelegramLinkTokens } from '../db/schema.js';
import { badRequest } from '../lib/errors.js';
import {
  configureCustomerTelegramWebhook,
  broadcastCustomerTelegramNotification,
  createCustomerTelegramLink,
  getCustomerTelegramConfig,
  handleCustomerTelegramUpdate,
  testCustomerTelegramBot,
  type CustomerTelegramUpdate,
} from '../services/customer-telegram.js';
import { telegramSecretMatches } from '../services/telegram.js';

const updateSchema = z.object({ update_id: z.number().int().nonnegative() }).passthrough();

const routes: FastifyPluginAsync = async (app) => {
  app.post('/telegram/customer/webhook', async (req, reply) => {
    const config = await getCustomerTelegramConfig();
    const header = req.headers['x-telegram-bot-api-secret-token'];
    const received = Array.isArray(header) ? header[0] : header;
    if (!telegramSecretMatches(config.webhookSecret, received)) {
      return reply.status(401).send({ ok: false, error: 'invalid telegram secret' });
    }
    const update = updateSchema.parse(req.body) as CustomerTelegramUpdate;
    void handleCustomerTelegramUpdate(update).catch((error) => req.log.error({ err: error }, 'customer telegram update failed'));
    return { ok: true };
  });

  app.get('/customer-telegram/status', { preHandler: app.requireUser }, async (req) => {
    const config = await getCustomerTelegramConfig();
    const [account] = await db.select().from(customerTelegramAccounts)
      .where(eq(customerTelegramAccounts.userId, req.currentUser!.id)).limit(1);
    return {
      ok: true,
      enabled: config.enabled && Boolean(config.botToken && config.botUsername),
      botUsername: config.botUsername,
      popup: { title: config.popupTitle, text: config.popupText, button: config.popupButton },
      account: account ? {
        linked: true,
        username: account.username,
        notificationsEnabled: account.notificationsEnabled,
        linkedAt: account.linkedAt.toISOString(),
      } : { linked: false },
    };
  });

  app.post('/customer-telegram/link', {
    preHandler: app.requireUser,
    config: { rateLimit: { max: 6, timeWindow: '10 minutes' } },
  }, async (req) => {
    try {
      return { ok: true, ...(await createCustomerTelegramLink(req.currentUser!.id)) };
    } catch (error) {
      throw badRequest((error as Error).message);
    }
  });

  app.delete('/customer-telegram/link', { preHandler: app.requireUser }, async (req) => {
    await db.transaction(async (tx) => {
      await tx.delete(customerTelegramLinkTokens).where(eq(customerTelegramLinkTokens.userId, req.currentUser!.id));
      await tx.delete(customerTelegramAccounts).where(eq(customerTelegramAccounts.userId, req.currentUser!.id));
    });
    return { ok: true };
  });

  app.get('/admin/customer-telegram/stats', { preHandler: app.requirePermission('manage_settings') }, async () => {
    const [[linked], [notified]] = await Promise.all([
      db.select({ value: count() }).from(customerTelegramAccounts),
      db.select({ value: count() }).from(customerTelegramAccounts).where(eq(customerTelegramAccounts.notificationsEnabled, true)),
    ]);
    return { ok: true, linked: Number(linked?.value ?? 0), notificationsEnabled: Number(notified?.value ?? 0) };
  });

  app.post('/admin/customer-telegram/test', { preHandler: app.requirePermission('manage_settings') }, async (req) => {
    try {
      const result = await testCustomerTelegramBot();
      return { ok: true, ...result, message: `اتصال به @${result.botUsername} موفق بود.` };
    } catch (error) {
      req.log.warn({ err: error }, 'customer Telegram connection test failed');
      throw badRequest(`تست ربات مشتریان ناموفق بود: ${(error as Error).message}`);
    }
  });

  app.post('/admin/customer-telegram/webhook', { preHandler: app.requirePermission('manage_settings') }, async (req) => {
    const body = z.object({ webhookUrl: z.string().url().max(1000).optional() }).parse(req.body ?? {});
    const webhookUrl = body.webhookUrl || `${req.protocol}://${req.hostname}/api/telegram/customer/webhook`;
    try {
      const result = await configureCustomerTelegramWebhook(webhookUrl);
      return {
        ok: true,
        ...result,
        message: result.enabled
          ? `ربات مشتریان @${result.botUsername} فعال شد و webhook متصل است.`
          : 'ربات مشتریان غیرفعال و webhook حذف شد.',
      };
    } catch (error) {
      req.log.warn({ err: error }, 'customer Telegram webhook setup failed');
      throw badRequest(`راه‌اندازی ربات مشتریان ناموفق بود: ${(error as Error).message}`);
    }
  });

  app.post('/admin/customer-telegram/broadcast', {
    preHandler: app.requirePermission('manage_settings'),
    config: { rateLimit: { max: 3, timeWindow: '10 minutes' } },
  }, async (req) => {
    const body = z.object({
      title: z.string().trim().min(2).max(150),
      message: z.string().trim().min(3).max(3500),
    }).parse(req.body);
    try {
      const result = await broadcastCustomerTelegramNotification(body.title, body.message);
      return { ok: true, ...result, message: `پیام برای ${result.sent.toLocaleString('fa-IR')} مشتری ارسال شد${result.failed ? `؛ ${result.failed.toLocaleString('fa-IR')} ارسال ناموفق بود` : ''}.` };
    } catch (error) {
      throw badRequest(`ارسال همگانی ناموفق بود: ${(error as Error).message}`);
    }
  });
};

export default routes;
