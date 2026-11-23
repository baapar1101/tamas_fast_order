import type { FastifyPluginAsync } from 'fastify';
import { priceListsConfigSchema } from '@tamas/shared';
import { logAction } from '../../services/audit.js';
import { getPriceListsConfig, priceListSummaries, savePriceListsConfig } from '../../services/price-lists.js';

/** Which categories and brands make up each public price list. */
const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_products'));

  app.get('/admin/price-lists', async () => ({
    ok: true,
    config: await getPriceListsConfig(),
    summaries: await priceListSummaries(),
  }));

  app.put('/admin/price-lists', async (req) => {
    const config = priceListsConfigSchema.parse(req.body);
    await savePriceListsConfig(config);
    await logAction(req.currentUser!.id, 'UPDATE_PRICE_LISTS', 'settings', 'price_lists', {
      lists: config.lists.map((list) => `${list.id}:${list.enabled ? 'on' : 'off'}`),
    });
    return { ok: true, config, summaries: await priceListSummaries(), message: 'لیست‌های قیمت ذخیره شد.' };
  });
};

export default routes;
