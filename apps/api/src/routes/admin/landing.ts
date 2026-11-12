import type { FastifyPluginAsync } from 'fastify';
import { LANDING_SETTING_KEY, landingConfigSchema, parseLandingConfig } from '@tamas/shared';
import { logAction } from '../../services/audit.js';
import { getSetting, setSetting } from '../../services/settings.js';

/** Home page landing sections, edited from the admin panel. */
const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_content'));

  app.get('/admin/landing', async () => ({
    ok: true,
    config: parseLandingConfig(await getSetting(LANDING_SETTING_KEY)),
  }));

  app.put('/admin/landing', async (req) => {
    const config = landingConfigSchema.parse(req.body);
    await setSetting(LANDING_SETTING_KEY, JSON.stringify(config));
    await logAction(req.currentUser!.id, 'UPDATE_LANDING', 'settings', LANDING_SETTING_KEY, {
      enabled: config.enabled,
      sections: config.sections.map((section) => `${section.type}${section.enabled ? '' : ' (off)'}`),
    });
    return { ok: true, config, message: 'صفحهٔ اصلی ذخیره شد.' };
  });
};

export default routes;
