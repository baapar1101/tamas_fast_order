import type { FastifyPluginAsync } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { catalogQuerySchema } from '@tamas/shared';
import { db } from '../db/client.js';
import { slides } from '../db/schema.js';
import { notFound } from '../lib/errors.js';
import { findProductByPublicId, listBrands, listCategories, listColors, queryProducts } from '../services/catalog.js';
import { getPublicSettings } from '../services/settings.js';

const GOLDEN_CAMPAIGN_IMAGE_URL = '/assets/slides/golden-days-2026-10.webp';
// Midnight at the start of 21 Mehr 1405 in Tehran.
const GOLDEN_CAMPAIGN_END_AT = Date.parse('2026-10-12T20:30:00.000Z');

/**
 * Everything a shopper's first paint needs. Responses carry a short
 * `s-maxage` so a CDN or reverse proxy in front of the API can absorb the
 * traffic spike of a promotion.
 */
const routes: FastifyPluginAsync = async (app) => {
  app.get('/catalog/products', async (req, reply) => {
    const q = catalogQuerySchema.parse(req.query);
    const result = await queryProducts(q);
    reply.header('cache-control', 'public, max-age=15, s-maxage=60, stale-while-revalidate=120');
    return { ok: true, ...result };
  });

  app.get('/catalog/products/:productId', async (req) => {
    const { productId } = req.params as { productId: string };
    const result = await findProductByPublicId(productId);
    if (!result) throw notFound('این محصول پیدا نشد.');
    return { ok: true, product: result.product, variants: result.variants };
  });

  app.get('/catalog/categories', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=60, s-maxage=300');
    return { ok: true, categories: await listCategories() };
  });

  app.get('/catalog/brands', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=60, s-maxage=300');
    return { ok: true, brands: await listBrands() };
  });

  app.get('/catalog/colors', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=300, s-maxage=900');
    return { ok: true, colors: await listColors() };
  });

  /** One round trip for the whole first render: taxonomy + settings together. */
  app.get('/catalog/bootstrap', async (_req, reply) => {
    const [categories, brands, colors, settings, activeSlides] = await Promise.all([
      listCategories(),
      listBrands(),
      listColors(),
      getPublicSettings(),
      db.select({
        id: slides.id,
        title: slides.title,
        imageUrl: slides.imageUrl,
        mobileImageUrl: slides.mobileImageUrl,
        linkUrl: slides.linkUrl,
      }).from(slides).where(eq(slides.isActive, true)).orderBy(desc(slides.sortOrder), desc(slides.id)),
    ]);
    reply.header('cache-control', 'public, max-age=30, s-maxage=120');
    const visibleSlides = Date.now() >= GOLDEN_CAMPAIGN_END_AT
      ? activeSlides.filter((slide) => slide.imageUrl !== GOLDEN_CAMPAIGN_IMAGE_URL)
      : activeSlides;
    return { ok: true, categories, brands, colors, settings, slides: visibleSlides };
  });
};

export default routes;
