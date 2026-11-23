import type { FastifyPluginAsync } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { catalogQuerySchema, festivalSlides } from '@tamas/shared';
import { db } from '../db/client.js';
import { slides } from '../db/schema.js';
import { notFound } from '../lib/errors.js';
import { findProductByPublicId, listBrands, listCategories, listColors, queryProducts } from '../services/catalog.js';
import { getPublicSettings } from '../services/settings.js';
import { flashSaleShowcase } from '../services/flash-sale.js';
import { getFestivalState } from '../services/festival.js';
import { pointsCampaignShowcase } from '../services/points-campaign.js';
import { priceList, priceListSummaries } from '../services/price-lists.js';

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
    const response: { ok: true } & NonNullable<Awaited<ReturnType<typeof findProductByPublicId>>> = {
      ok: true,
      ...result,
    };
    return response;
  });

  /** Public price lists built from current site prices; prices only for approved partners. */
  app.get('/catalog/price-lists', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=30, s-maxage=60');
    return { ok: true, lists: await priceListSummaries() };
  });

  app.get('/catalog/price-lists/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const showPrices = Boolean(req.currentUser?.isActive);
    // Never shared caches: the same address answers with or without prices depending on who asks.
    reply.header('cache-control', 'private, no-store');
    reply.header('vary', 'cookie, authorization');
    const list = await priceList(id, { showPrices });
    if (!list) throw notFound('این لیست قیمت پیدا نشد.');
    return { ok: true, list };
  });

  /** The points campaign with its live leaderboard, plus the signed-in customer's own standing. */
  app.get('/catalog/points-campaign', async (req, reply) => {
    reply.header('cache-control', 'private, max-age=5');
    return { ok: true, campaign: await pointsCampaignShowcase(req.currentUser?.id ?? null) };
  });

  app.get('/catalog/flash-sale', async (_req, reply) => {
    reply.header('cache-control', 'public, max-age=15, s-maxage=30');
    return { ok: true, sale: await flashSaleShowcase() };
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
    const [categories, brands, colors, settings, festival, activeSlides] = await Promise.all([
      listCategories(),
      listBrands(),
      listColors(),
      getPublicSettings(),
      getFestivalState(),
      db.select({
        id: slides.id,
        title: slides.title,
        imageUrl: slides.imageUrl,
        mobileImageUrl: slides.mobileImageUrl,
        linkUrl: slides.linkUrl,
      }).from(slides).where(eq(slides.isActive, true)).orderBy(desc(slides.sortOrder), desc(slides.id)),
    ]);
    // Store configuration changes must not leave an old public projection in caches.
    reply.header('cache-control', 'no-store');
    const campaignSlides = Date.now() >= GOLDEN_CAMPAIGN_END_AT
      ? activeSlides.filter((slide) => slide.imageUrl !== GOLDEN_CAMPAIGN_IMAGE_URL)
      : activeSlides;
    // Festival banners show only while the festival runs (and may hide the rest).
    const visibleSlides = festivalSlides(campaignSlides, festival);
    return { ok: true, categories, brands, colors, settings, slides: visibleSlides };
  });
};

export default routes;
