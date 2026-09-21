import { createHash, createHmac } from 'node:crypto';

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export interface CrmConfig {
  apiBase: string;
  apiKey: string;
  businessId: number;
  webhookSecret: string;
  syncEnabled: boolean;
  syncDebounceMs: number;
}

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

/** A tamas order (matches OrderDTO from the site's API). */
export interface CrmOrder {
  orderCode: string;
  userId?: number | null;
  customerName: string;
  phone: string;
  storeName: string | null;
  address: string;
  total: number;
  quantity: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  note?: string | null;
  items: Array<{
    productId: string;
    sku: string | null;
    title: string;
    price: number;
    qty: number;
    warehouse: string;
    color?: string | null;
  }>;
}

/** A tamas product (matches ProductDTO). */
export interface CrmProduct {
  productId: string;
  sku: string | null;
  title: string;
  model?: string | null;
  categoryName?: string | null;
  brandName?: string | null;
  price: number;
  oldPrice?: number | null;
  discount: number;
  stock: number;
  kermanStock?: number;
  tehranStock?: number;
  status: string;
  description?: string | null;
  imageUrl?: string | null;
  updatedAt: string;
}

/** A customer / person to create or match in CRM. */
export interface CrmPerson {
  firstName: string;
  lastName?: string;
  email?: string;
  phone: string;
  aliasName?: string;
}

/** Result of a push operation. */
export interface CrmSyncResult {
  ok: boolean;
  entity: 'order' | 'product' | 'person' | 'chat_message';
  remoteId?: string | number;
  error?: string;
  deduped?: boolean;
}

/* ------------------------------------------------------------------ */
/* Low-level HTTP helper                                                */
/* ------------------------------------------------------------------ */

async function crmRequest<T = unknown>(
  path: string,
  config: CrmConfig,
  opts: RequestInit & { retries?: number } = {},
): Promise<T> {
  const { retries = 2, ...rest } = opts;
    const url = `${config.apiBase.replace(/\/$/, '')}${path}`;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          ...rest,
          headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey ? { Authorization: `ApiKey ${config.apiKey}` } : {}),
            'X-Business-ID': String(config.businessId),
            'X-Calendar-Type': 'jalali',
            'X-Currency': 'IRR',
            ...(rest.headers as Record<string, string> | undefined),
          },
        });
      if (!res.ok && attempt < retries && res.status >= 500) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      const body = (await res.json()) as T;
      return body;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error('CRM request exhausted retries');
}

/* ------------------------------------------------------------------ */
/* Public client – outbound sync (site → CRM)                           */
/* ------------------------------------------------------------------ */

export const crmClient = {
  /** Push an order to the CRM. Returns the remote CRM order id on success. */
  async pushOrder(order: CrmOrder, config: CrmConfig): Promise<CrmSyncResult> {
    try {
      const payload = {
        source: 'tamas-fast-order',
        order_code: order.orderCode,
        customer_name: order.customerName,
        phone: order.phone,
        store_name: order.storeName,
        address: order.address,
        total: order.total,
        quantity: order.quantity,
        status: order.status,
        payment_status: order.paymentStatus,
        payment_method: order.paymentMethod,
        note: order.note ?? '',
        items: order.items.map((i) => ({
          product_id: i.productId,
          sku: i.sku ?? '',
          title: i.title,
          price: i.price,
          qty: i.qty,
          warehouse: i.warehouse,
          color: i.color ?? '',
        })),
        synced_at: new Date().toISOString(),
      };
      // Hesabix API: POST /api/v1/orders/business/{businessId}/
      const data = (await crmRequest<{ success?: boolean; id?: number; error?: string }>(
        `/api/v1/orders/business/${config.businessId}/`,
        config,
        { method: 'POST', body: JSON.stringify(payload) },
      )) as { success?: boolean; id?: number; error?: string };
      if (data?.success === false || data?.error) {
        return { ok: false, entity: 'order', error: data.error || 'CRM rejected order' };
      }
      return { ok: true, entity: 'order', remoteId: data?.id ?? undefined };
    } catch (err: any) {
      return { ok: false, entity: 'order', error: err?.message ?? String(err) };
    }
  },

  /** Push a product to the CRM (creates or updates the CRM product). */
  async pushProduct(product: CrmProduct, config: CrmConfig): Promise<CrmSyncResult> {
    try {
      const payload = {
        source: 'tamas-fast-order',
        product_id: product.productId,
        sku: product.sku ?? '',
        name: product.title,
        model: product.model ?? '',
        category_name: product.categoryName ?? '',
        brand_name: product.brandName ?? '',
        price: product.price,
        old_price: product.oldPrice ?? null,
        discount: product.discount,
        stock: product.stock,
        kerman_stock: product.kermanStock ?? 0,
        tehran_stock: product.tehranStock ?? 0,
        status: product.status,
        description: product.description ?? '',
        image_url: product.imageUrl ?? '',
        updated_at: product.updatedAt,
      };
      // Hesabix API: POST /api/v1/products/business/{businessId}/
      const data = (await crmRequest<{ success?: boolean; id?: number; error?: string }>(
        `/api/v1/products/business/${config.businessId}/`,
        config,
        { method: 'POST', body: JSON.stringify(payload) },
      )) as { success?: boolean; id?: number; error?: string };
      if (data?.success === false || data?.error) {
        return { ok: false, entity: 'product', error: data.error || 'CRM rejected product' };
      }
      return { ok: true, entity: 'product', remoteId: data?.id ?? undefined };
    } catch (err: any) {
      return { ok: false, entity: 'product', error: err?.message ?? String(err) };
    }
  },

  /** Search for a person in CRM by phone or name (for order customer matching). */
    async searchPerson(
      query: { phone?: string; name?: string; email?: string },
      config: CrmConfig,
    ): Promise<CrmSyncResult & { personId?: number }> {
      try {
        const params = new URLSearchParams();
        if (query.phone) params.set('phone', query.phone);
        if (query.name) params.set('name', query.name);
        if (query.email) params.set('email', query.email);
        const data = (await crmRequest<{
          success?: boolean;
          items?: Array<{ id: number }>;
          error?: string;
        }>(`/api/v1/crm/tamas/people/search?${params.toString()}`, config)) as {
          success?: boolean;
          items?: Array<{ id: number }>;
          error?: string;
        };
        if (data?.success === false || data?.error) {
          return { ok: false, entity: 'person', error: data.error || 'CRM search failed' };
        }
        const first = data?.items?.[0];
        return { ok: true, entity: 'person', personId: first?.id };
      } catch (err: any) {
        return { ok: false, entity: 'person', error: err?.message ?? String(err) };
      }
    },

    /** Search for a product in CRM by productId. */
    async searchProduct(
      query: { productId: string },
      config: CrmConfig,
    ): Promise<CrmSyncResult & { remoteId?: number }> {
      try {
        // MarkStreet API: GET /api/v1/products/business/{businessId}/search
        const params = new URLSearchParams();
        params.set('take', '1');
        params.set('skip', '0');
        params.set('sort_desc', 'false');
        params.set('include_inventory', 'true');

        const data = (await crmRequest<{
          success?: boolean;
          items?: Array<{ id: number; sku?: string; title?: string }>;
          error?: string;
        }>(`/api/v1/products/business/${config.businessId}/search?${params.toString()}`, config)) as {
          success?: boolean;
          items?: Array<{ id: number; sku?: string; title?: string }>;
          error?: string;
        };
        if (data?.success === false || data?.error) {
          return { ok: false, entity: 'product', error: data.error || 'CRM product search failed' };
        }
        const first = data?.items?.[0];
        if (!first) {
          return { ok: true, entity: 'product', remoteId: undefined };
        }
        // Check if this matches our productId
        if (first.sku === query.productId || first.title === query.productId) {
          return { ok: true, entity: 'product', remoteId: first.id };
        }
        // No match found
        return { ok: true, entity: 'product', remoteId: undefined };
      } catch (err: any) {
        return { ok: false, entity: 'product', error: err?.message ?? String(err) };
      }
    },

    /** Send a chat message from the site visitor to the CRM conversation. */
  async sendChatMessage(
    conversationId: number,
    visitorToken: string,
    body: string,
    config: CrmConfig,
  ): Promise<CrmSyncResult> {
    try {
      const payload = {
        conversation_id: conversationId,
        visitor_token: visitorToken,
        body,
        sender_role: 'visitor',
        source: 'tamas-fast-order',
      };
      const data = (await crmRequest<{ success?: boolean; id?: number; error?: string }>(
        `/api/v1/public/crm-chat/messages`,
        config,
        { method: 'POST', body: JSON.stringify(payload) },
      )) as { success?: boolean; id?: number; error?: string };
      if (data?.success === false || data?.error) {
        return { ok: false, entity: 'chat_message', error: data.error || 'CRM rejected message' };
      }
      return { ok: true, entity: 'chat_message', remoteId: data?.id ?? undefined };
    } catch (err: any) {
      return { ok: false, entity: 'chat_message', error: err?.message ?? String(err) };
    }
  },

  /** Check CRM health / reachability. */
  async ping(config: CrmConfig): Promise<boolean> {
    try {
      const data = (await crmRequest<{ success?: boolean }>('/api/v1/health', config)) as {
        success?: boolean;
      };
      return data?.success === true;
    } catch {
      return false;
    }
  },

  /** Push a person to CRM (create or find existing by phone/email). */
  async pushPerson(person: CrmPerson, config: CrmConfig): Promise<CrmSyncResult & { personId?: number }> {
    try {
      if (!config.syncEnabled) return { ok: true, entity: 'person', deduped: true };
      const payload = {
        source: 'tamas-fast-order',
        first_name: person.firstName,
        last_name: person.lastName ?? '',
        email: person.email ?? '',
        phone: person.phone,
        alias_name: person.aliasName ?? '',
        synced_at: new Date().toISOString(),
      };
      const data = (await crmRequest<{ success?: boolean; id?: number; error?: string }>(
        `/api/v1/crm/tamas/people`,
        config,
        { method: 'POST', body: JSON.stringify(payload) },
      )) as { success?: boolean; id?: number; error?: string };
      if (data?.success === false || data?.error) {
        return { ok: false, entity: 'person', error: data.error || 'CRM rejected person' };
      }
      return { ok: true, entity: 'person', personId: data?.id };
    } catch (err: any) {
      return { ok: false, entity: 'person', error: err?.message ?? String(err) };
    }
  },
};

/* ------------------------------------------------------------------ */
/* Webhook handler (CRM → site)                                         */
/* ------------------------------------------------------------------ */

/** Simple in-memory dedupe window (last N event ids). */
const _seen = new Set<string>();
const _seenMax = 500;

function _dedupe(key: string): boolean {
  if (_seen.has(key)) return true;
  _seen.add(key);
  if (_seen.size > _seenMax) {
    const arr = [..._seen];
    _seen.clear();
    for (const k of arr.slice(-_seenMax + 1)) _seen.add(k);
  }
  return false;
}

/** Verify HMAC-SHA256 signature of raw body against secret. */
function _verifySignature(rawBody: string | Buffer, signature: string | undefined, secret: string): boolean {
  if (!secret || !signature) return true;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return createHmac('sha256', secret).update(rawBody).digest('hex') === signature;
}

/** Normalize a CRM webhook payload into a flat event envelope. */
function _normalizeEvent(payload: unknown, defaultBusinessId: string | number): {
  eventType: string;
  eventId: string;
  businessId: string;
  data: unknown;
} {
  const p = (payload as Record<string, unknown>) ?? {};
  const eventType = String(p.event_type ?? p.event ?? p.type ?? 'unknown');
  const eventId = String(p.event_id ?? p.id ?? p.hash_id ?? createHash('sha256').update(JSON.stringify(p)).digest('hex').slice(0, 16));
  const businessId = String(p.business_id ?? p.businessId ?? defaultBusinessId);
  const data = p.data ?? p.payload ?? p;
  return { eventType, eventId, businessId, data };
}

/** Process an inbound CRM webhook and return a summary. */
export async function processCrmWebhook(
  rawBody: string,
  signature: string | undefined,
  payload: unknown,
  config: CrmConfig,
): Promise<{ ok: boolean; processed: string; details: Record<string, unknown> }> {
  if (!_verifySignature(rawBody, signature, config.webhookSecret)) {
    return { ok: false, processed: 'signature_invalid', details: { error: 'invalid signature' } };
  }
  const { eventType, eventId, businessId, data } = _normalizeEvent(payload, config.businessId);
  if (_dedupe(`${businessId}:${eventType}:${eventId}`)) {
    return { ok: true, processed: 'duplicate_skipped', details: { eventType, eventId } };
  }

  const details: Record<string, unknown> = { eventType, eventId, businessId };

  try {
    switch (eventType) {
      case 'crm.lead.created':
      case 'person.created': {
        const person = (data as Record<string, unknown>) ?? {};
        details.personId = person.id;
        details.matched = 'stored_in_site_pending';
        break;
      }
      case 'crm.order.created':
      case 'order.created': {
        const order = (data as Record<string, unknown>) ?? {};
        details.orderCode = order.order_code ?? order.orderCode;
        details.remoteOrderId = order.id;
        break;
      }
      case 'crm.product.updated':
      case 'product.updated': {
        const product = (data as Record<string, unknown>) ?? {};
        details.productId = product.product_id ?? product.id;
        break;
      }
      case 'crm.chat.message.created':
      case 'chat.message': {
        const msg = (data as Record<string, unknown>) ?? {};
        details.messageId = msg.id;
        details.conversationId = msg.conversation_id ?? msg.conversationId;
        break;
      }
      case 'crm.payment.received':
      case 'payment.received': {
        const pay = (data as Record<string, unknown>) ?? {};
        details.paymentId = pay.id;
        details.amount = pay.amount;
        break;
      }
      default:
        details.warning = 'unhandled_event_type';
        break;
    }

    return { ok: true, processed: eventType, details };
  } catch (err: any) {
    return { ok: false, processed: eventType, details: { error: err?.message ?? String(err) } };
  }
}
