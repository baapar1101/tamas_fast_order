import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { funnelAutomationSchema } from '@tamas/shared';
import { getFunnelReport, getFunnelSegment, setFunnelAutomation } from '../../services/funnel.js';
import { logAction } from '../../services/audit.js';

const daysSchema = z.coerce.number().int().refine((value) => [1, 7, 30].includes(value)).default(7);

const routes: FastifyPluginAsync = async (app) => {
  app.get('/admin/funnel', { preHandler: app.requirePermission('manage_users') }, async (req) => {
    const { days } = z.object({ days: daysSchema }).parse(req.query);
    return { ok: true, report: await getFunnelReport(days) };
  });

  app.get('/admin/funnel/users', { preHandler: app.requirePermission('manage_users') }, async (req) => {
    const { segment, days } = z.object({ segment: z.enum(['browsed', 'cart', 'unpaid']), days: daysSchema }).parse(req.query);
    return { ok: true, users: await getFunnelSegment(segment, days) };
  });

  app.put('/admin/funnel/automation', { preHandler: app.requirePermission('manage_settings') }, async (req) => {
    const config = funnelAutomationSchema.parse(req.body);
    await setFunnelAutomation(config);
    await logAction(req.currentUser!.id, 'UPDATE_FUNNEL_AUTOMATION', 'settings', 'funnel_automation', { ...config });
    return { ok: true, automation: config, message: 'تنظیمات پیگیری خودکار ذخیره شد.' };
  });
};

export default routes;
