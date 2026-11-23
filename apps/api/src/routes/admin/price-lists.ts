import type { FastifyPluginAsync } from 'fastify';
import { priceListsConfigSchema } from '@tamas/shared';
import { badRequest } from '../../lib/errors.js';
import { logAction } from '../../services/audit.js';
import { publishPriceListsToGroup } from '../../services/price-list-telegram.js';
import { getPriceListsConfig, priceListSummaries, savePriceListsConfig } from '../../services/price-lists.js';
import { getTelegramConfig } from '../../services/telegram.js';

/** Telegram groups an admin can publish price lists to (names only, never chat ids). */
async function telegramGroups() {
  const config = await getTelegramConfig();
  return {
    enabled: config.enabled && Boolean(config.botToken),
    groups: config.groups.filter((group) => group.enabled).map((group) => ({ id: group.id, name: group.name })),
  };
}

/** Which categories and brands make up each public price list, and where Telegram copies go. */
const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_products'));

  app.get('/admin/price-lists', async () => ({
    ok: true,
    config: await getPriceListsConfig(),
    summaries: await priceListSummaries(),
    telegram: await telegramGroups(),
  }));

  app.put('/admin/price-lists', async (req) => {
    const config = priceListsConfigSchema.parse(req.body);
    await savePriceListsConfig(config);
    await logAction(req.currentUser!.id, 'UPDATE_PRICE_LISTS', 'settings', 'price_lists', {
      lists: config.lists.map((list) => `${list.id}:${list.enabled ? 'on' : 'off'}`),
      telegramGroup: config.telegram.groupId,
      autoPublish: config.telegram.autoPublish,
    });
    return { ok: true, config, summaries: await priceListSummaries(), telegram: await telegramGroups(), message: 'لیست‌های قیمت ذخیره شد.' };
  });

  app.post('/admin/price-lists/publish', async (req) => {
    try {
      const result = await publishPriceListsToGroup();
      await logAction(req.currentUser!.id, 'PUBLISH_PRICE_LISTS', 'settings', 'price_lists', result);
      return { ok: true, ...result, message: `${result.lists.toLocaleString('fa-IR')} لیست قیمت به «${result.groupName}» ارسال شد.` };
    } catch (error) {
      throw badRequest(`ارسال به تلگرام ناموفق بود: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
};

export default routes;
