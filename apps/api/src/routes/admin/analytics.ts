import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { badRequest } from '../../lib/errors.js';
import { getArvanAnalytics, isArvanConfigured, parseArvanPeriod } from '../../services/arvan-cloud.js';

const routes: FastifyPluginAsync = async (app) => {
  app.get('/admin/analytics/arvan', { preHandler: app.requireAdmin }, async (req) => {
    const { period } = z.object({ period: z.string().optional() }).parse(req.query);
    if (!(await isArvanConfigured())) {
      return { ok: true, analytics: { configured: false as const } };
    }

    try {
      return { ok: true, analytics: await getArvanAnalytics(parseArvanPeriod(period)) };
    } catch (error) {
      req.log.warn({ err: error }, 'Arvan Cloud analytics request failed');
      throw badRequest((error as Error).message);
    }
  });

  app.post('/admin/analytics/arvan/test', { preHandler: app.requirePermission('manage_settings') }, async () => {
    try {
      const analytics = await getArvanAnalytics('1h');
      return {
        ok: true,
        message: `اتصال به اروان کلاد برای دامنه ${analytics.domain} برقرار شد.`,
        domain: analytics.domain,
      };
    } catch (error) {
      throw badRequest((error as Error).message);
    }
  });
};

export default routes;
