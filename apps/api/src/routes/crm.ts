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

    app.post('/crm/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
      // Read raw body for HMAC verification - use req.rawBody if available, or read from stream
      const config = await getCrmConfig();
      let rawBodyStr: string;
      try {
        // Try to get raw body from Fastify's rawBody support
        const rawBody = (req as any).rawBody;
        if (rawBody) {
          rawBodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
        } else {
          rawBodyStr = JSON.stringify(req.body);
        }
        const signature = (req.headers['x-crm-signature'] as string) ?? undefined;
        const result = await processCrmWebhook(rawBodyStr, signature, req.body, config);
        if (!result.ok) {
          reply.code(400);
        }
        return result;
      } catch (err: any) {
        reply.code(400);
        return { ok: false, error: err?.message ?? 'Webhook processing failed' };
      }
    });

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
   * CRM Sync Logs and Product details
   */
  app.get('/crm/sync/logs', { preHandler: [app.requirePermission('manage_settings')] }, async () => {
    const { db } = await import('../db/client.js');
    const { crmSyncLogs } = await import('../db/schema.js');
    const { desc } = await import('drizzle-orm');
    
    const logs = await db.select().from(crmSyncLogs).orderBy(desc(crmSyncLogs.createdAt)).limit(100);
    return { ok: true, items: logs };
  });

  app.get('/crm/sync/products/detail', { preHandler: [app.requirePermission('manage_settings')] }, async () => {
    const { db } = await import('../db/client.js');
    const { products, crmSyncLogs } = await import('../db/schema.js');
    const { desc, eq } = await import('drizzle-orm');

    const activeProducts = await db.select().from(products).where(eq(products.status, 'active'));
    
    const productLogs = await db.query.crmSyncLogs.findMany({
      where: eq(crmSyncLogs.entity, 'product'),
      orderBy: [desc(crmSyncLogs.createdAt)],
    });
    
    const logMap = new Map();
    // Since ordered by desc, the first one we set will be the most recent
    for (const log of productLogs) {
      if (!logMap.has(log.entityKey)) {
        logMap.set(log.entityKey, log);
      }
    }
    
    const items = activeProducts.map(p => {
        const log = logMap.get(p.productId);
        return {
          productId: p.productId,
          sku: null,
          title: p.title,
          status: p.status,
          price: p.price,
          stock: p.stock,
          kermanStock: p.kermanStock,
          tehranStock: p.tehranStock,
          imageUrl: p.imageUrl,
          lastSyncedAt: log?.createdAt,
          crmId: log?.remoteId ? parseInt(log.remoteId, 10) : undefined,
          syncStatus: log ? (log.status === 'success' ? 'synced' : log.status === 'error' ? 'error' : 'pending') : 'never',
          syncError: log?.error || undefined
        };
    });
    
    return { ok: true, items };
  });

  /**
   * CRM Integration Statistics (admin only)
   */
  app.get('/crm/stats', { preHandler: [app.requirePermission('manage_settings')] }, async () => {
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
    { preHandler: [app.requirePermission('manage_settings')] },
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
    { preHandler: [app.requirePermission('manage_settings')] },
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
    { preHandler: [app.requirePermission('manage_settings')] },
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
      { preHandler: [app.requirePermission('manage_settings')] },
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
              const searchResult = await crmClient.searchProduct(
                { productId: variant.productId },
                config,
              );

              let action: 'update' | 'create' = 'create';
              let resultObj;
              if (searchResult.ok && searchResult.remoteId) {
                // Product exists - update it
                action = 'update';
                resultObj = await crmClient.pushProduct(
                  { ...variant, productId: variant.productId },
                  config,
                );
              } else {
                // Product doesn't exist - create it
                action = 'create';
                resultObj = await crmClient.pushProduct(
                  { ...variant, productId: variant.productId },
                  config,
                );
              }

              if (resultObj.ok) {
                totalPushed++;
              } else {
                totalErrors++;
                errors.push(`${variant.productId}: ${resultObj.error}`);
              }

              // Log it
              const { db } = await import('../db/client.js');
              const { crmSyncLogs } = await import('../db/schema.js');
              await db.insert(crmSyncLogs).values({
                entity: 'product',
                entityKey: variant.productId,
                action,
                status: resultObj.ok ? 'success' : 'error',
                error: resultObj.ok ? null : String(resultObj.error),
                payload: { productId: variant.productId },
                response: resultObj as unknown as Record<string, unknown>,
              });
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
    { preHandler: [app.requirePermission('manage_settings')] },
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
    { preHandler: [app.requirePermission('manage_settings')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { crmClient } = await import('../lib/crm.js');
      const { queryProducts } = await import('../services/catalog.js');
      const { db } = await import('../db/client.js');
      const { crmSyncLogs } = await import('../db/schema.js');

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

          // Log each product sync result
          await db.insert(crmSyncLogs).values({
            entity: 'product',
            entityKey: variant.productId,
            action: 'update',
            status: pushResult.ok ? 'success' : 'error',
            remoteId: pushResult.remoteId?.toString() ?? null,
            error: pushResult.ok ? null : String(pushResult.error),
            payload: { productId: variant.productId, stock: variant.stock },
            response: pushResult as unknown as Record<string, unknown>,
          });

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

  /**
   * Bulk sync orders to CRM.
   * POST /api/crm/sync/orders
   */
  app.post(
    '/crm/sync/orders',
    { preHandler: [app.requirePermission('manage_settings')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { crmClient } = await import('../lib/crm.js');
      const { db } = await import('../db/client.js');
      const { orders } = await import('../db/schema.js');
      const { crmSyncLogs } = await import('../db/schema.js');
      const { desc, isNull, eq } = await import('drizzle-orm');
      const config = await getCrmConfig();

      // Get recent orders (limit to 50)
      const orderRows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(50);
      let synced = 0;
      const errors: string[] = [];

      for (const orderRow of orderRows) {
        // Fetch order items from database
        const { orderItems } = await import('../db/schema.js');
        const orderItemsRows = await db.select().from(orderItems).where(eq(orderItems.orderId, orderRow.id));

        if (orderItemsRows.length === 0) {
          const errorMsg = `سفارش ${orderRow.orderCode} فاقد آیتم است`;
          await db.insert(crmSyncLogs).values({
            entity: 'order',
            entityKey: orderRow.orderCode,
            action: 'create',
            status: 'error',
            error: errorMsg,
            payload: { orderId: orderRow.id },
          });
          errors.push(errorMsg);
          continue;
        }

        // Build CrmOrder with items
        const crmOrder = {
          orderCode: orderRow.orderCode,
          customerName: orderRow.customerName,
          phone: orderRow.phone,
          storeName: orderRow.storeName,
          address: orderRow.address,
          total: Number(orderRow.total),
          quantity: orderItemsRows.reduce((sum, item) => sum + item.qty, 0),
          status: orderRow.status,
          paymentStatus: orderRow.paymentStatus,
          paymentMethod: orderRow.paymentMethod,
          note: orderRow.note ?? undefined,
          items: orderItemsRows.map((item) => ({
            productId: item.productId,
            sku: item.sku ?? '',
            title: item.title,
            price: Number(item.price),
            qty: item.qty,
            warehouse: item.warehouse,
          })),
        } as any;

        const result = await crmClient.pushOrder(crmOrder, config);
        if (result.ok) synced++;
        else errors.push(`${orderRow.orderCode}: ${result.error}`);

        // Log the sync attempt
        await db.insert(crmSyncLogs).values({
          entity: 'order',
          entityKey: orderRow.orderCode,
          action: 'create',
          status: result.ok ? 'success' : 'error',
          remoteId: result.remoteId?.toString() ?? null,
          error: result.error ?? null,
          payload: { orderId: orderRow.id, orderCode: orderRow.orderCode },
          response: result as unknown as Record<string, unknown>,
        });
      }

      return {
        ok: errors.length === 0,
        pushed: synced,
        errors: errors.length,
        errorDetails: errors.slice(0, 20),
      };
    },
  );

  /**
   * Bulk sync persons to CRM.
   * POST /api/crm/sync/persons
   */
  app.post(
    '/crm/sync/persons',
    { preHandler: [app.requirePermission('manage_settings')] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { crmClient } = await import('../lib/crm.js');
      const { db } = await import('../db/client.js');
      const { users } = await import('../db/schema.js');
      const { crmSyncLogs } = await import('../db/schema.js');
      const { desc, eq } = await import('drizzle-orm');
      const config = await getCrmConfig();

      // Get active users
      const userRows = await db.select().from(users).where(eq(users.isActive, true)).orderBy(desc(users.createdAt)).limit(50);
      let synced = 0;
      const errors: string[] = [];

      for (const userRow of userRows) {
        const person = {
          firstName: userRow.name.split(' ')[0] || '',
          lastName: userRow.name.split(' ').slice(1).join(' ') || '',
          phone: userRow.phone,
          email: null,
          aliasName: userRow.name || userRow.phone,
        } as any;

        const result = await crmClient.pushPerson(person, config);
        if (result.ok) synced++;
        else errors.push(`${userRow.phone}: ${result.error}`);

        // Log the sync attempt
        await db.insert(crmSyncLogs).values({
          entity: 'person',
          entityKey: userRow.phone,
          action: 'create',
          status: result.ok ? 'success' : 'error',
          remoteId: result.personId?.toString() ?? null,
          error: result.error ?? null,
          payload: { userId: userRow.id, phone: userRow.phone },
          response: result as unknown as Record<string, unknown>,
        });
      }

      return {
        ok: errors.length === 0,
        pushed: synced,
        errors: errors.length,
        errorDetails: errors.slice(0, 20),
      };
    },
  );

  /**
   * CRM Web Chat Proxy Routes
   */
  const chatApiPrefix = '/crm/chat';
  
  app.get(`${chatApiPrefix}/conversations`, { preHandler: [app.requirePermission('manage_settings')] }, async (req, reply) => {
    const config = await getCrmConfig();
    if (!config.apiBase || !config.apiKey) return reply.status(400).send({ ok: false, error: 'CRM not configured' });
    const url = `${config.apiBase.replace(/\/$/, '')}/api/v1/crm/businesses/${config.businessId}/chat/conversations`;
    const res = await fetch(url, { headers: { 'Authorization': `ApiKey ${config.apiKey}` } });
    const data = await res.json();
    console.log('CRM CHAT CONVS:', JSON.stringify(data.items?.[0] || data.data?.[0] || data[0], null, 2));
    return reply.status(res.status).send(data);
  });

  app.get(`${chatApiPrefix}/conversations/:id/messages`, { preHandler: [app.requirePermission('manage_settings')] }, async (req, reply) => {
    const config = await getCrmConfig();
    const { id } = req.params as { id: string };
    if (!config.apiBase || !config.apiKey) return reply.status(400).send({ ok: false, error: 'CRM not configured' });
    const url = `${config.apiBase.replace(/\/$/, '')}/api/v1/crm/businesses/${config.businessId}/chat/conversations/${id}/messages`;
    const res = await fetch(url, { headers: { 'Authorization': `ApiKey ${config.apiKey}` } });
    const data = await res.json();
    return reply.status(res.status).send(data);
  });

  app.post(`${chatApiPrefix}/conversations/:id/messages`, { preHandler: [app.requirePermission('manage_settings')] }, async (req, reply) => {
    const config = await getCrmConfig();
    const { id } = req.params as { id: string };
    if (!config.apiBase || !config.apiKey) return reply.status(400).send({ ok: false, error: 'CRM not configured' });
    const url = `${config.apiBase.replace(/\/$/, '')}/api/v1/crm/businesses/${config.businessId}/chat/conversations/${id}/messages`;
    const res = await fetch(url, { 
      method: 'POST',
      headers: { 'Authorization': `ApiKey ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await res.json();
    return reply.status(res.status).send(data);
  });
  
  app.patch(`${chatApiPrefix}/conversations/:id`, { preHandler: [app.requirePermission('manage_settings')] }, async (req, reply) => {
    const config = await getCrmConfig();
    const { id } = req.params as { id: string };
    if (!config.apiBase || !config.apiKey) return reply.status(400).send({ ok: false, error: 'CRM not configured' });
    const url = `${config.apiBase.replace(/\/$/, '')}/api/v1/crm/businesses/${config.businessId}/chat/conversations/${id}`;
    const res = await fetch(url, { 
      method: 'PATCH',
      headers: { 'Authorization': `ApiKey ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await res.json();
    return reply.status(res.status).send(data);
  });
};

export default routes;