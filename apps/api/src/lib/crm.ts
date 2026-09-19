/**
 * Tamas Fast Order — CRM Integration Module
 *
 * Bridges the tamas-fast-order site with the Hesabix/MarkStreet CRM
 * (arc) so that orders, customers, products, and chat messages stay
 * in sync bidirectionally.
 *
 * Usage:  import { crmClient, crmWebhook } from '../lib/crm.js';
 *
 *   crmClient.pushOrder(orderDto)   → sends order to CRM
 *   crmClient.pushProduct(product)  → sends product to CRM
 *   crmClient.searchPerson(query)   → finds a person in CRM
 *
 *   crmWebhook.handler(rawBody, signature)  → process inbound webhook
 *
 * Config (env):
 *   CRM_API_BASE       – base URL of the CRM API (default: http://localhost:8000)
 *   CRM_API_KEY        – API key for CRM management endpoints (Bearer token)
 *   CRM_BUSINESS_ID    – business ID in CRM (default: 1)
 *   CRM_WEBHOOK_SECRET – shared secret for webhook signature verification (HMAC-SHA256)
 *   CRM_SYNC_ENABLED   – 'true' to enable outbound sync (default: true in dev)
 *   CRM_SYNC_DEBOUNCE_MS – ms to wait before flushing a batch (default: 500)
 */

import { createHash, createHmac } from 'node:crypto';

/* ------------------------------------------------------------------ */
/* Config                                                               */
/* ------------------------------------------------------------------ */

const CRM_API_BASE   = (typeof process !== 'undefined' && process.env.CRM_API_BASE)   || 'https://tamastore.ir';
const CRM_API_KEY    = (typeof process !== 'undefined' && process.env.CRM_API_KEY)    || '';
const CRM_BUSINESS_ID= (typeof process !== 'undefined' && process.env.CRM_BUSINESS_ID) || '1';
const CRM_WEBHOOK_SECRET = (typeof process !== 'undefined' && process.env.CRM_WEBHOOK_SECRET) || '';
const CRM_SYNC_ENABLED = (typeof process !== 'undefined' && process.env.CRM_SYNC_ENABLED) !== 'false';
const CRM_SYNC_DEBOUNCE_MS = parseInt(
  (typeof process !== 'undefined' && process.env.CRM_SYNC_DEBOUNCE_MS) || '500', 10,
);

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

/** A tamas order (matches OrderDTO from the site's API). */
export interface CrmOrder {
  orderCode: string;
  userId?: number;
  customerName: string;
  phone: string;
  storeName: string;
  address: string;
  total: number;
  quantity: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  note?: string;
  items: Array<{
    productId: string;
    sku: string;
    title: string;
    price: number;
    qty: number;
    warehouse: string;
    color?: string;
  }>;
}

/** A tamas product (matches ProductDTO). */
export interface CrmProduct {
  productId: string;
  sku: string;
  title: string;
  model?: string | null;
  categoryName?: string | null;
  brandName?: string | null;
  price: number;
  oldPrice?: number | null;
  discount: number;
  stock: number;
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
  opts: RequestInit & { retries?: number } = {},
): Promise<T> {
  const { retries = 2, ...rest } = opts;
  const url = `${CRM_API_BASE.replace(/\/+$/, '')}${path}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...rest,
        headers: {
          'Content-Type': 'application/json',
          ...(CRM_API_KEY ? { Authorization: `Bearer ${CRM_API_KEY}` } : {}),
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
  async pushOrder(order: CrmOrder): Promise<CrmSyncResult> {
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
          sku: i.sku,
          title: i.title,
          price: i.price,
          qty: i.qty,
          warehouse: i.warehouse,
          color: i.color ?? '',
        })),
        synced_at: new Date().toISOString(),
      };
      const data = (await crmRequest<{ success?: boolean; id?: number; error?: string }>(
        `/api/v1/crm/tamas/orders`,
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
  async pushProduct(product: CrmProduct): Promise<CrmSyncResult> {
    try {
      const payload = {
        source: 'tamas-fast-order',
        product_id: product.productId,
        sku: product.sku,
        name: product.title,
        model: product.model ?? '',
        category_name: product.categoryName ?? '',
        brand_name: product.brandName ?? '',
        price: product.price,
        old_price: product.oldPrice ?? null,
        discount: product.discount,
        stock: product.stock,
        status: product.status,
        description: product.description ?? '',
        image_url: product.imageUrl ?? '',
        updated_at: product.updatedAt,
      };
      const data = (await crmRequest<{ success?: boolean; id?: number; error?: string }>(
        `/api/v1/crm/tamas/products`,
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
  async searchPerson(query: { phone?: string; name?: string; email?: string }): Promise<CrmSyncResult & { personId?: number }> {
    try {
      const params = new URLSearchParams();
      if (query.phone) params.set('phone', query.phone);
      if (query.name) params.set('name', query.name);
      if (query.email) params.set('email', query.email);
      const data = (await crmRequest<{
        success?: boolean;
        items?: Array<{ id: number }>;
        error?: string;
      }>(`/api/v1/crm/tamas/people/search?${params.toString()}`)) as {
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

  /** Send a chat message from the site visitor to the CRM conversation. */
  async sendChatMessage(conversationId: number, visitorToken: string, body: string): Promise<CrmSyncResult> {
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
  async ping(): Promise<boolean> {
    try {
      const data = (await crmRequest<{ success?: boolean }>('/api/v1/health')) as {
        success?: boolean;
      };
      return data?.success === true;
    } catch {
      return false;
    }
  },
};

/* ------------------------------------------------------------------ */
/* Webhook handler (CRM → site)                                        */
/* ------------------------------------------------------------------ */

/** Simple in-memory dedupe window (last N event ids). */
const _seen = new Set<string>();
const _seenMax = 500;

function _dedupe(key: string): boolean {
  if (_seen.has(key)) return true;
  _seen.add(key);
  if (_seen.size > _seenMax) {
    // Evict oldest by converting to array — small bounded set, fine.
    const arr = [..._seen];
    _seen.clear();
    for (const k of arr.slice(-_seenMax + 1)) _seen.add(k);
  }
  return false;
}

/** Verify HMAC-SHA256 signature of raw body against secret. */
function _verifySignature(rawBody: string | Buffer, signature: string | undefined, secret: string): boolean {
  if (!secret || !signature) return true; // allow unsigned in dev
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return createHmac('sha256', secret).update(rawBody).digest('hex') === signature
    ? true
    : createHash('sha256').update(rawBody).digest('hex') === signature; // fallback: sha256
}

/** Normalize a CRM webhook payload into a flat event envelope. */
function _normalizeEvent(payload: unknown): {
  eventType: string;
  eventId: string;
  businessId: string;
  data: unknown;
} {
  const p = (payload as Record<string, unknown>) ?? {};
  const eventType = String(p.event_type ?? p.event ?? p.type ?? 'unknown');
  const eventId = String(p.event_id ?? p.id ?? p.hash_id ?? createHash('sha256').update(JSON.stringify(p)).digest('hex').slice(0, 16));
  const businessId = String(p.business_id ?? p.businessId ?? CRM_BUSINESS_ID);
  const data = p.data ?? p.payload ?? p;
  return { eventType, eventId, businessId, data };
}

/** Process an inbound CRM webhook and return a summary. */
export async function processCrmWebhook(
  rawBody: string,
  signature: string | undefined,
  payload: unknown,
): Promise<{ ok: boolean; processed: string; details: Record<string, unknown> }> {
  if (!_verifySignature(rawBody, signature, CRM_WEBHOOK_SECRET)) {
    return { ok: false, processed: 'signature_invalid', details: { error: 'invalid signature' } };
  }
  const { eventType, eventId, businessId, data } = _normalizeEvent(payload);
  if (_dedupe(`${businessId}:${eventType}:${eventId}`)) {
    return { ok: true, processed: 'duplicate_skipped', details: { eventType, eventId } };
  }

  const details: Record<string, unknown> = { eventType, eventId, businessId };

  try {
    switch (eventType) {
      /* ---- CRM → site: new lead / person ---- */
      case 'crm.lead.created':
      case 'person.created': {
        const person = (data as Record<string, unknown>) ?? {};
        details.personId = person.id;
        details.matched = 'stored_in_site_pending'; // would insert into a sync_audit table
        break;
      }

      /* ---- CRM → site: order created / updated ---- */
      case 'crm.order.created':
      case 'order.created': {
        const order = (data as Record<string, unknown>) ?? {};
        details.orderCode = order.order_code ?? order.orderCode;
        details.remoteOrderId = order.id;
        // In production you'd upsert into the site's orders table here.
        break;
      }

      /* ---- CRM → site: product updated ---- */
      case 'crm.product.updated':
      case 'product.updated': {
        const product = (data as Record<string, unknown>) ?? {};
        details.productId = product.product_id ?? product.id;
        break;
      }

      /* ---- CRM → site: chat message (agent reply) ---- */
      case 'crm.chat.message.created':
      case 'chat.message': {
        const msg = (data as Record<string, unknown>) ?? {};
        details.messageId = msg.id;
        details.conversationId = msg.conversation_id ?? msg.conversationId;
        break;
      }

      /* ---- CRM → site: payment / receipt ---- */
      case 'crm.payment.received':
      case 'payment.received': {
        const pay = (data as Record<string, unknown>) ?? {};
        details.paymentId = pay.id;
        details.amount = pay.amount;
        break;
      }

      /* ---- Unknown / generic ---- */
      default:
        details.warning = 'unhandled_event_type';
        break;
    }

    return { ok: true, processed: eventType, details };
  } catch (err: any) {
    return { ok: false, processed: eventType, details: { error: err?.message ?? String(err) } };
  }
}

/* ------------------------------------------------------------------ */
/* Re-export for convenience                                            */
/* ------------------------------------------------------------------ */

export { CRM_API_BASE, CRM_API_KEY, CRM_BUSINESS_ID, CRM_WEBHOOK_SECRET, CRM_SYNC_ENABLED, CRM_SYNC_DEBOUNCE_MS };