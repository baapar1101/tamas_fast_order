import type { FastifyPluginAsync } from 'fastify';
import { processCrmWebhook } from '../lib/crm.js';

/**
 * Webhook endpoint for inbound CRM events.
 *
 * POST /api/crm/webhook
 *   - Content-Type: application/json
 *   - X-CRM-Signature: HMAC-SHA256 hex digest of raw body (optional in dev)
 *
 * Events handled:
 *   - person.created / updated
 *   - order.created / updated / paid
 *   - product.updated
 *   - crm.chat.message.created (agent reply)
 *   - payment.received
 *
 * The handler verifies the signature, dedupes by event_id, and stores
 * a minimal audit log. Actual data mutations happen in the service layer
 * (to be wired in).
 */
const routes: FastifyPluginAsync = async (app) => {
  app.post(
    '/crm/webhook',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const rawBody = await req.rawBody?.toString() ?? JSON.stringify(req.body);
      const signature = (req.headers['x-crm-signature'] as string) ?? undefined;
      const result = await processCrmWebhook(rawBody, signature, req.body);
      if (!result.ok) {
        reply.code(400);
      }
      return result;
    },
  );

  /**
   * Health check for the CRM integration.
   */
  app.get('/crm/health', async () => {
    const { crmClient } = await import('../lib/crm.js');
    const reachable = await crmClient.ping();
    return {
      ok: true,
      crm: { reachable, baseUrl: CRM_API_BASE },
      sync: { enabled: CRM_SYNC_ENABLED, debounceMs: CRM_SYNC_DEBOUNCE_MS },
    };
  });

  /**
   * Trigger a manual sync of a specific order to CRM.
   * POST /api/crm/sync/order { orderCode: string }
   */
  app.post(
    '/crm/sync/order',
    { preHandler: [app.requireAdmin] },
    async (req) => {
      const body = req.body as { orderCode?: string } ?? {};
      const { orderCode } = body;
      if (!orderCode) {
        reply.code(400);
        return { ok: false, error: 'orderCode is required' };
      }
      const { crmClient } = await import('../lib/crm.js');
      const { getOrderByCode } = await import('../services/orders.js');
      const order = await getOrderByCode(orderCode);
      if (!order) {
        reply.code(404);
        return { ok: false, error: 'Order not found' };
      }
      const result = await crmClient.pushOrder(order);
      return { ok: result.ok, result };
    },
  );

  /**
   * Trigger a manual sync of a specific product to CRM.
   * POST /api/crm/sync/product { productId: string }
   */
  app.post(
    '/crm/sync/product',
    { preHandler: [app.requireAdmin] },
    async (req) => {
      const body = req.body as { productId?: string } ?? {};
      const { productId } = body;
      if (!productId) {
        reply.code(400);
        return { ok: false, error: 'productId is required' };
      }
      const { crmClient } = await import('../lib/crm.js');
      const { findProductByPublicId } = await import('../services/catalog.js');
      const product = await findProductByPublicId(productId);
      if (!product) {
        reply.code(404);
        return { ok: false, error: 'Product not found' };
      }
      const result = await crmClient.pushProduct(product.product);
      return { ok: result.ok, result };
    },
  );
};

export default routes;