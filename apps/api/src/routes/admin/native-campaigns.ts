import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { campaignDraftSchema } from '@tamas/shared';
import * as service from '../../services/native-campaigns.js';
import { logAction } from '../../services/audit.js';

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const campaignStatus = z.enum(['draft', 'queued', 'sending', 'completed', 'cancelled']);
const deliveryStatus = z.enum(['queued', 'processing', 'accepted', 'failed', 'skipped', 'unknown', 'cancelled']);
const page = z.coerce.number().int().min(1).max(100000).default(1);
export function createAdminNativeCampaignRoutes(deps = service): FastifyPluginAsync {
  return async app => {
    app.addHook('preHandler', app.requirePermission('manage_app_notifications'));
    app.get('/admin/app-notifications', async req => {
      const q = z.object({ page, status: campaignStatus.optional(), q: z.string().trim().max(100).optional() }).parse(req.query);
      return { ok: true, ...await deps.listCampaigns(q.page, q.status, q.q) };
    });
    app.get('/admin/app-notifications/customers', async req => {
      const q = z.object({ page, q: z.string().trim().max(80).default('') }).parse(req.query);
      return { ok: true, ...await deps.campaignCustomers(q.q, q.page) };
    });
    app.get('/admin/app-notifications/:id', async req => {
      const { id } = idSchema.parse(req.params);
      const q = z.object({ page, status: deliveryStatus.optional() }).parse(req.query);
      return { ok: true, ...await deps.campaignDetail(id, q.page, q.status) };
    });
    app.post('/admin/app-notifications', async req => {
      const campaign = await deps.saveCampaign(campaignDraftSchema.parse(req.body), req.currentUser!.id);
      await logAction(req.currentUser!.id, 'create', 'app_notification', String(campaign.id));
      return { ok: true, campaign };
    });
    app.put('/admin/app-notifications/:id', async req => {
      const { id } = idSchema.parse(req.params);
      const { revision, ...input } = z.object({ revision: z.number().int().positive() }).passthrough().parse(req.body);
      const campaign = await deps.saveCampaign(campaignDraftSchema.parse(input), req.currentUser!.id, id, revision);
      await logAction(req.currentUser!.id, 'update', 'app_notification', String(id));
      return { ok: true, campaign };
    });
    app.get('/admin/app-notifications/:id/preview', async req => {
      const { id } = idSchema.parse(req.params); return { ok: true, ...await deps.previewCampaign(id) };
    });
    app.post('/admin/app-notifications/:id/send', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async req => {
      const { id } = idSchema.parse(req.params);
      const { revision, previewToken } = z.object({ revision: z.number().int().positive(), previewToken: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(req.body);
      const campaign = await deps.queueCampaign(id, revision, previewToken);
      await logAction(req.currentUser!.id, 'queue', 'app_notification', String(id), { audience: campaign.audience, total: campaign.stats.total });
      return { ok: true, campaign };
    });
    for (const action of ['cancel', 'retry'] as const) app.post(`/admin/app-notifications/:id/${action}`, { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async req => {
      const { id } = idSchema.parse(req.params);
      await (action === 'cancel' ? deps.cancelCampaign(id) : deps.retryCampaign(id));
      await logAction(req.currentUser!.id, action, 'app_notification', String(id));
      return { ok: true };
    });
  };
}
export default createAdminNativeCampaignRoutes();
