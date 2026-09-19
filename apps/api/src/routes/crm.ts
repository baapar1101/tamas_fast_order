import { count, eq, isNull } from 'drizzle-orm';
import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from 'fastify';
import { processCrmWebhook } from '../lib/crm.js';
import { getCrmConfig } from '../services/settings.js';

/**
 * CRM Integration Routes
 *
 * Endpoints:
 *   POST /api/crm/webhook           - Inbound webhook from CRM
 *   GET  /api/crm/health            - CRM connectivity health check
 *   POST /api/crm/sync/order        - Manual order sync by orderCode
 *   POST /api/crm/sync/product      - Manual product sync by productId
 *   POST /api/crm/sync/person       - Manual person sync by phone/email
 *   POST /api/crm/sync/products/push - Bulk push all products to CRM
 *   POST /api/crm/sync/products/pull - Pull products from CRM
 *   POST /api/crm/sync/stock        - Sync stock levels to CRM
 *   GET  /api/crm/stats             - CRM integration statistics (admin)
 */
const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Capture the raw body for HMAC signature verification.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
    try {
      const json = JSON.parse(body.toString('utf-8'));
      done(null, { raw: body, json });
    } catch {
      done(new Error('Invalid JSON'), undefined);
    }
  });

  app.post(
    '/crm/webhook',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = req.body as { raw: Buffer; json: unknown };
      const rawBody = parsed.raw.toString('utf-8');
      const signature = (req.headers['x-crm-signature'] as string) ?? undefined;
      const config = await getCrmConfig();
      const result = await processCrmWebhook(rawBody, signature, parsed.json, config);
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
    const config = await getCrmConfig();
    const { crmClient } = await import('../lib/crm.js');
    const reachable = await crmClient.ping(config);
    return {
      ok: true,
      crm: { reachable, baseUrl: config.apiBase || 'not configured' },
      sync: { enabled: config.syncEnabled, debounceMs: config.syncDebounceMs },
    };
  });

  /**
   * CRM Integration Statistics (admin only)
   */
  app.get('/crm/stats', { preHandler: [app.requireAdmin] }, async () => {
    const config = await getCrmConfig();
    const { crmClient } = await import('../lib/crm.js');
    const reachable = await crmClient.ping(config);

    // Get counts from local DB
    const { db } = await import('../db/client.js');
    const { users, orders, products } = await import('../db/schema.js');
    const { count } = await import('drizzle-orm');

    const [userCount, orderCount, productCount] = await Promise.all([
      db.select({ n: count() }).from(users).where(eq(users.isActive, true)),
      db.select({ n: count() }).from(orders).where(isNull(orders.deletedAt)),
      db.select({ n: count() }).from(products).where(eq(products.status, 'active')),
    ]);

    return {
      ok: true,
      crm: {
        reachable,
        baseUrl: config.apiBase || 'not configured',
        syncEnabled: config.syncEnabled,
      },
      local: {
        activeUsers: userCount[0]?.n ?? 0,
        totalOrders: orderCount[0]?.n ?? 0,
        activeProducts: productCount[0]?.n ?? 0,
      },
    };
  });

  /**
   * Trigger a manual sync of a specific order to CRM.
   * POST /api/crm/sync/order { orderCode: string }
   */
  app.post(
    '/crm/sync/order',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body as { orderCode?: string }) ?? {};
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
      const config = await getCrmConfig();
      const result = await crmClient.pushOrder(order, config);
      return { ok: result.ok, result };
    },
  );

  /**
   * Trigger a manual sync of a specific product to CRM.
   * POST /api/crm/sync/product { productId: string }
   */
  app.post(
    '/crm/sync/product',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body as { productId?: string }) ?? {};
      const { productId } = body;
      if (!productId) {
        reply.code(400);
        return { ok: false, error: 'productId is required' };
      }
      const { crmClient } = await import('../lib/crm.js');
      const { findProductByPublicId } = await import('../services/catalog.js');
      const result = await findProductByPublicId(productId);
      if (!result) {
        reply.code(404);
        return { ok: false, error: 'Product not found' };
      }
      const config = await getCrmConfig();
      const pushResult = await crmClient.pushProduct(result.product, config);
      return { ok: pushResult.ok, result: pushResult };
    },
  );

  /**
   * Trigger a manual sync of a specific person to CRM.
   * POST /api/crm/sync/person { phone: string, name?: string, email?: string }
   */
  app.post(
    '/crm/sync/person',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = (req.body as { phone?: string; name?: string; email?: string }) ?? {};
      const { phone, name, email } = body;
      if (!phone) {
        reply.code(400);
        return { ok: false, error: 'phone is required' };
      }
      const { crmClient } = await import('../lib/crm.js');
      const config = await getCrmConfig();
      const result = await crmClient.pushPerson({
        firstName: name?.split(' ')[0] ?? '',
        lastName: name?.split(' ').slice(1).join(' ') ?? '',
        phone,
        email,
        aliasName: name ?? phone,
      }, config);
      return { ok: result.ok, result };
    },
  );

  /**
     * Bulk push all active products to CRM.
     * POST /api/crm/sync/products/push
     */
    app.post(
      '/crm/sync/products/push',
      async (req: FastifyRequest, reply: FastifyReply) => {
        const config = await getCrmConfig();
        const { crmClient } = await import('../lib/crm.js');
        const { queryProducts } = await import('../services/catalog.js');

        // Fetch all active products in batches
        const pageSize = 50;
        let page = 1;
        let totalPushed = 0;
        let totalErrors = 0;
        const errors: string[] = [];

        while (true) {
          // MarkStreet API: GET /api/v1/products/business/{id}/search
          const searchParams = new URLSearchParams({
            take: String(pageSize),
            skip: String((page - 1) * pageSize),
            sort_desc: 'false',
            include_inventory: 'true',
          });

          const result = await queryProducts({
            page,
            perPage: pageSize,
            inStock: false,
            sort: 'price_asc',
            brands: [],
          });

          if (!result.groups || result.groups.length === 0) break;

          for (const group of result.groups) {
            for (const variant of group.variants) {
              // Search product in CRM first
              const searchResult = await crmClient.searchProduct(
                { productId: variant.productId },
                config,
              );

              if (searchResult.ok && searchResult.remoteId) {
                // Product exists - update it
                const updateResult = await crmClient.pushProduct(
                  { ...variant, productId: variant.productId },
                  config,
                );
                if (updateResult.ok) totalPushed++;
                else {
                  totalErrors++;
                  errors.push(`${variant.productId}: ${updateResult.error}`);
                }
              } else {
                // Product doesn't exist - create it
                const createResult = await crmClient.pushProduct(
                  { ...variant, productId: variant.productId },
                  config,
                );
                if (createResult.ok) totalPushed++;
                else {
                  totalErrors++;
                  errors.push(`${variant.productId}: ${createResult.error}`);
                }
              }
            }
          }

          if (result.groups.length < pageSize) break;
          page++;
        }

        return {
          ok: totalErrors === 0,
          pushed: totalPushed,
          errors: totalErrors,
          errorDetails: errors.slice(0, 20),
        };
      },
    );

  /**
   * Pull products from CRM (placeholder - needs CRM API endpoint)
   * POST /api/crm/sync/products/pull
   */
  app.post(
    '/crm/sync/products/pull',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { crmClient } = await import('../lib/crm.js');
      const { db } = await import('../db/client.js');
      const { products } = await import('../db/schema.js');
      const { eq } = await import('drizzle-orm');

      // This would call CRM to get products and upsert locally
      // For now, return not implemented
      return {
        ok: false,
        error: 'Product pull from CRM not yet implemented. Requires CRM API endpoint.',
      };
    },
  );

  /**
   * Sync stock levels to CRM.
   * POST /api/crm/sync/stock
   */
  app.post(
    '/crm/sync/stock',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { crmClient } = await import('../lib/crm.js');
      const { queryProducts } = await import('../services/catalog.js');

      const result = await queryProducts({ page: 1, perPage: 200, inStock: false, sort: 'price_asc', brands: [] });
      let synced = 0;
      const errors: string[] = [];
      const config = await getCrmConfig();

      for (const group of result.groups ?? []) {
        for (const variant of group.variants) {
          const pushResult = await crmClient.pushProduct({
            productId: variant.productId,
            sku: variant.sku ?? '',
            title: variant.title,
            model: variant.model ?? '',
            categoryName: variant.categoryName ?? '',
            brandName: variant.brandName ?? '',
            price: variant.price,
            oldPrice: variant.oldPrice ?? null,
            discount: variant.discount,
            stock: variant.stock,
            kermanStock: variant.kermanStock,
            tehranStock: variant.tehranStock,
            status: variant.status,
            description: variant.description ?? '',
            imageUrl: variant.imageUrl ?? '',
            updatedAt: variant.updatedAt,
          }, config);

          if (pushResult.ok) synced++;
          else errors.push(`${variant.productId}: ${pushResult.error}`);
        }
      }

      return {
        ok: errors.length === 0,
        synced,
        errors: errors.length,
        errorDetails: errors.slice(0, 20),
      };
    },
  );
};

export default routes;