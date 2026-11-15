import type { FastifyPluginAsync } from 'fastify';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { FESTIVAL_SETTING_KEY, festivalConfigSchema, festivalStatus } from '@tamas/shared';
import { db } from '../../db/client.js';
import { products, slides } from '../../db/schema.js';
import { badRequest } from '../../lib/errors.js';
import { logAction } from '../../services/audit.js';
import { invalidateCatalog } from '../../services/catalog.js';
import { getFestivalConfig } from '../../services/festival.js';
import { setSetting } from '../../services/settings.js';

async function festivalProductCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(and(isNull(products.deletedAt), eq(products.status, 'active'), eq(products.promotion, true)));
  return row?.count ?? 0;
}

async function slideList() {
  return db
    .select({ id: slides.id, title: slides.title, imageUrl: slides.imageUrl, isActive: slides.isActive })
    .from(slides)
    .orderBy(desc(slides.sortOrder), desc(slides.id));
}

/** The store-wide festival: on, off or on a schedule, and what it changes. */
const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_settings'));

  app.get('/admin/festival', async () => {
    const config = await getFestivalConfig();
    const [festivalProducts, slideRows] = await Promise.all([festivalProductCount(), slideList()]);
    return { ok: true, config, status: festivalStatus(config), festivalProducts, slides: slideRows };
  });

  app.put('/admin/festival', async (req) => {
    const parsed = festivalConfigSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'تنظیمات جشنواره نامعتبر است.');
    const config = parsed.data;
    const known = new Set((await slideList()).map((slide) => slide.id));
    config.festivalSlideIds = config.festivalSlideIds.filter((id) => known.has(id));
    await setSetting(FESTIVAL_SETTING_KEY, JSON.stringify(config));
    invalidateCatalog();
    const status = festivalStatus(config);
    await logAction(req.currentUser!.id, 'UPDATE_FESTIVAL', 'settings', FESTIVAL_SETTING_KEY, {
      mode: config.mode,
      startsAt: config.startsAt,
      endsAt: config.endsAt,
      effects: config.effects,
      slides: config.festivalSlideIds,
      active: status.active,
    });
    const message = status.active
      ? 'جشنواره ذخیره شد و هم‌اکنون فعال است.'
      : status.phase === 'upcoming' ? 'جشنواره ذخیره شد و در زمان تعیین‌شده خودکار روشن می‌شود.'
      : 'جشنواره ذخیره شد؛ اکنون فعال نیست.';
    return { ok: true, config, status, message };
  });
};

export default routes;
