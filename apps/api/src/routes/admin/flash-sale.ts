import type { FastifyPluginAsync } from 'fastify';
import {
  FLASH_SALE_MAX_DISCOUNT,
  FLASH_SALE_SETTING_KEY,
  flashSaleConfigSchema,
  flashSaleFloor,
  flashSaleWindow,
} from '@tamas/shared';
import { badRequest } from '../../lib/errors.js';
import { logAction } from '../../services/audit.js';
import { invalidateCatalog } from '../../services/catalog.js';
import { getFlashSaleConfig, regularPrices } from '../../services/flash-sale.js';
import { setSetting } from '../../services/settings.js';

/** The daily timed sale («۴ ساعت فروش با پَ مَ سود»), edited from the admin panel. */
const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_products'));

  app.get('/admin/flash-sale', async () => {
    const config = await getFlashSaleConfig();
    const prices = await regularPrices(config.items.map((item) => item.productId));
    return {
      ok: true,
      config,
      window: flashSaleWindow(config),
      products: Object.fromEntries(prices),
    };
  });

  app.put('/admin/flash-sale', async (req) => {
    const config = flashSaleConfigSchema.parse(req.body);
    const prices = await regularPrices(config.items.map((item) => item.productId));
    for (const item of config.items) {
      const product = prices.get(item.productId);
      if (!product) throw badRequest(`کالای «${item.productId}» در سایت پیدا نشد.`);
      if (item.salePrice >= product.price) throw badRequest(`قیمت فروش ویژهٔ «${product.title}» باید کمتر از قیمت فعلی آن باشد.`);
      if (item.salePrice < flashSaleFloor(product.price)) {
        throw badRequest(`تخفیف «${product.title}» بیشتر از ${FLASH_SALE_MAX_DISCOUNT.toLocaleString('fa-IR')}٪ است؛ کمترین قیمت مجاز ${flashSaleFloor(product.price).toLocaleString('fa-IR')} تومان است.`);
      }
    }
    await setSetting(FLASH_SALE_SETTING_KEY, JSON.stringify(config));
    invalidateCatalog();
    await logAction(req.currentUser!.id, 'UPDATE_FLASH_SALE', 'settings', FLASH_SALE_SETTING_KEY, {
      enabled: config.enabled,
      hours: `${config.startHour}-${config.endHour}`,
      items: config.items.map((item) => `${item.productId}:${item.salePrice}`),
    });
    return { ok: true, config, window: flashSaleWindow(config), message: 'فروش ویژه ذخیره شد.' };
  });
};

export default routes;
