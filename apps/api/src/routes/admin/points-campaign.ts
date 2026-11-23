import type { FastifyPluginAsync } from 'fastify';
import { and, count, gt, isNull } from 'drizzle-orm';
import { pointsCampaignConfigSchema, pointsCampaignPhase } from '@tamas/shared';
import { db } from '../../db/client.js';
import { products } from '../../db/schema.js';
import { badRequest } from '../../lib/errors.js';
import { logAction } from '../../services/audit.js';
import { invalidateCatalog } from '../../services/catalog.js';
import {
  campaignStandings,
  drawPointsCampaign,
  getPointsCampaignConfig,
  savePointsCampaignConfig,
} from '../../services/points-campaign.js';

/** The points campaign: settings, the full standings with contact details, and the draw. */
const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_settings'));

  app.get('/admin/points-campaign', async () => {
    const config = await getPointsCampaignConfig();
    const [standings, [withPoints]] = await Promise.all([
      campaignStandings(config),
      db.select({ n: count() }).from(products).where(and(isNull(products.deletedAt), gt(products.campaignPoints, 0))),
    ]);
    return {
      ok: true,
      config,
      phase: pointsCampaignPhase(config),
      productsWithPoints: Number(withPoints?.n ?? 0),
      standings: standings.slice(0, 500),
      participants: standings.length,
    };
  });

  app.put('/admin/points-campaign', async (req) => {
    const next = pointsCampaignConfigSchema.parse(req.body);
    const current = await getPointsCampaignConfig();
    if (next.enabled && (!next.startsAt || !next.endsAt)) throw badRequest('برای روشن کردن کمپین، تاریخ شروع و پایان را وارد کنید.');
    // The draw result is written only by the draw itself.
    const config = { ...next, draw: current.draw };
    await savePointsCampaignConfig(config);
    invalidateCatalog();
    await logAction(req.currentUser!.id, 'UPDATE_POINTS_CAMPAIGN', 'settings', 'points_campaign', {
      enabled: config.enabled,
      startsAt: config.startsAt,
      endsAt: config.endsAt,
    });
    return { ok: true, config, phase: pointsCampaignPhase(config), message: 'تنظیمات کمپین ذخیره شد.' };
  });

  app.post('/admin/points-campaign/draw', async (req) => {
    const draw = await drawPointsCampaign();
    await logAction(req.currentUser!.id, 'DRAW_POINTS_CAMPAIGN', 'settings', 'points_campaign', {
      winners: draw.winners.map((winner) => `${winner.kind}:${winner.userId}:${winner.points}`),
      entrants: draw.entrants,
      totalPoints: draw.totalPoints,
    });
    return { ok: true, draw, message: 'قرعه‌کشی انجام شد.' };
  });
};

export default routes;
