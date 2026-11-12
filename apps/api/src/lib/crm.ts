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
          signal: rest.signal ?? AbortSignal.timeout(20_000),
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
/* Products                                                             */
/* ------------------------------------------------------------------ */

type CrmEnvelope = { success?: boolean; data?: unknown; error?: { code?: string; message?: string } | string; message?: string };

function envelopeError(data: CrmEnvelope | null | undefined): string | undefined {
  if (!data) return 'Empty CRM response';
  if (typeof data.error === 'string') return data.error;
  if (data.error) return data.error.message || data.error.code || 'CRM rejected product';
  if (data.success === false) return data.message || 'CRM rejected product';
  return undefined;
}

function toCrmId(value: unknown): number | undefined {
  const id = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

/** The CRM refuses to create a second product with an existing code. */
export function isDuplicateCodeError(error: string | undefined): boolean {
  return Boolean(error && /تکراری|duplicate|already exists/i.test(error));
}

/**
 * Network trouble and CRM outages are worth retrying; a rejection of the data
 * itself will fail the same way every time.
 */
export function isTransientCrmError(error: string | undefined): boolean {
  if (!error) return false;
  return /timeout|timed out|aborted|fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|socket|network|Unexpected token|not valid JSON|exhausted retries|50[0-9]|bad gateway|service unavailable/i.test(error);
}

/** Fields both creating and editing send. */
function productFields(product: CrmProduct) {
  return {
    code: product.productId,
    name: product.title,
    general_barcodes: product.sku || product.productId,
    base_sales_price: product.price,
    is_active: product.status === 'active',
  };
}

async function createCrmProduct(product: CrmProduct, config: CrmConfig, retries?: number): Promise<CrmSyncResult> {
  const payload = {
    item_type: 'کالا',
    ...productFields(product),
    track_inventory: product.stock > 0,
    inventory_mode: 'bulk',
    base_purchase_price: Math.floor(product.price * 0.8),
    main_unit: 'عدد',
    unit_conversion_factor: 1,
  };
  // Hesabix API: POST /api/v1/products/business/{businessId}
  const data = await crmRequest<CrmEnvelope & { data?: { id?: number } }>(
    `/api/v1/products/business/${config.businessId}`,
    config,
    { method: 'POST', body: JSON.stringify(payload), retries },
  );
  const error = envelopeError(data);
  if (error) return { ok: false, entity: 'product', error };
  return { ok: true, entity: 'product', remoteId: toCrmId(data?.data?.id) };
}

/**
 * Reads the single-item result of the CRM's bulk upsert. Only an explicit
 * "created" or "updated" counts as success, so an unfamiliar reply shows up as
 * an error instead of silently passing.
 */
export function readBulkUpsertResult(data: unknown, fallbackId: number): CrmSyncResult {
  const envelope = data as CrmEnvelope & { results?: unknown };
  const error = envelopeError(envelope);
  if (error) return { ok: false, entity: 'product', remoteId: fallbackId, error };
  const inner = (envelope?.data ?? {}) as { results?: unknown; items?: unknown };
  const list = [envelope?.results, inner.results, inner.items].find(Array.isArray) as Array<Record<string, unknown>> | undefined;
  const item = list?.[0];
  const status = typeof item?.status === 'string' ? item.status : undefined;
  const remoteId = toCrmId(item?.product_id) ?? toCrmId(item?.id) ?? fallbackId;
  if (status === 'created' || status === 'updated') return { ok: true, entity: 'product', remoteId };
  const reason = item?.error ?? item?.message ?? item?.detail;
  const text = typeof reason === 'string' ? reason : reason ? JSON.stringify(reason) : '';
  return {
    ok: false,
    entity: 'product',
    remoteId: fallbackId,
    error: text || `CRM product update not confirmed: ${JSON.stringify(data).slice(0, 300)}`,
  };
}

async function updateCrmProduct(product: CrmProduct, remoteId: number, config: CrmConfig, retries?: number): Promise<CrmSyncResult> {
  // Hesabix API: POST /api/v1/products/business/{businessId}/bulk-upsert edits by CRM id (JSON body).
  const data = await crmRequest<unknown>(
    `/api/v1/products/business/${config.businessId}/bulk-upsert`,
    config,
    {
      method: 'POST',
      body: JSON.stringify({
        items: [{ client_ref: product.productId, product_id: remoteId, payload: productFields(product) }],
        create_if_update_missing: false,
      }),
      retries,
    },
  );
  return readBulkUpsertResult(data, remoteId);
}

/* ------------------------------------------------------------------ */
/* Public client – outbound sync (site → CRM)                           */
/* ------------------------------------------------------------------ */

export const crmClient = {
  /** Helper to log sync result to CRM sync logs table. */
  async _logSyncResult(
    entity: CrmSyncResult['entity'],
    entityKey: string,
    action: 'create' | 'update' | 'delete',
    result: CrmSyncResult,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const { db } = await import('../db/client.js');
      const { crmSyncLogs } = await import('../db/schema.js');
      await db.insert(crmSyncLogs).values({
        entity,
        entityKey,
        action,
        status: result.ok ? 'success' : 'error',
        remoteId: result.remoteId?.toString() ?? null,
        error: result.error ?? null,
        payload: payload ?? {},
        response: result as unknown as Record<string, unknown>,
      });
    } catch (err) {
      console.error('[CRM] Failed to log sync result:', err);
    }
  },

  /** Push an order to the CRM. Returns the remote CRM order id on success. */
  async pushOrder(order: CrmOrder, config: CrmConfig): Promise<CrmSyncResult> {
    try {
      const fail = async (error: string): Promise<CrmSyncResult> => {
        await this._logSyncResult('order', order.orderCode, 'create', { ok: false, entity: 'order', error }, { orderCode: order.orderCode });
        return { ok: false, entity: 'order', error };
      };

      // If no items, return error
      if (!order.items || order.items.length === 0) return await fail('سفارش فاقد آیتم است');

      // The customer: the CRM person with this exact phone, created if missing.
      // Without one the invoice is not sent, rather than landing on someone else.
      const personResult = await this.pushPerson({
        firstName: order.customerName.split(' ')[0] || '',
        lastName: order.customerName.split(' ').slice(1).join(' ') || '',
        phone: order.phone,
        aliasName: order.customerName,
      }, config);
      const resolvedPersonId = toCrmId(personResult.personId);
      if (!resolvedPersonId) {
        return await fail(`مشتری سفارش در حسابداری پیدا یا ساخته نشد: ${personResult.error ?? 'بدون شناسه'}`);
      }

      // Invoice lines need the CRM's own product ids, not the site's product codes.
      const productIds = new Map<string, number>();
      const missing: string[] = [];
      for (const code of new Set(order.items.map((i) => i.productId))) {
        const found = await this.searchProduct({ productId: code }, config);
        if (!found.ok) return await fail(`جستجوی کالای ${code} در حسابداری ناموفق بود: ${found.error}`);
        const id = toCrmId(found.remoteId);
        if (id) productIds.set(code, id);
        else missing.push(code);
      }
      if (missing.length) return await fail(`این کالاها در حسابداری نیستند: ${missing.join('، ')}`);

      // Build invoice payload - Hesabix uses "invoice_sales" and person_id in extra_info
      const payload = {
        invoice_type: 'invoice_sales',
        invoice_date: new Date().toISOString().split('T')[0],
        currency_id: 1,
        extra_info: {
          person_id: resolvedPersonId,
        },
        lines: order.items.map((i) => ({
          product_id: productIds.get(i.productId),
          quantity: i.qty,
          unit_price: i.price,
          discount_percent: 0,
          tax_percent: 0,
          warehouse_id: 1,
        })),
        description: order.note ?? '',
        payment_method: order.paymentMethod === 'card' ? 'card' : 'cash',
        payment_amount: order.paymentStatus === 'paid' ? order.total : 0,
      };

      console.log('[CRM] Syncing order:', order.orderCode, 'with', order.items.length, 'items');
      console.log('[CRM] Items:', JSON.stringify(order.items));

      // Hesabix API: POST /api/v1/invoices/business/{businessId}
      const data = (await crmRequest<{
        success?: boolean;
        data?: { id?: number };
        error?: { code?: string; message?: string };
      }>(
        `/api/v1/invoices/business/${config.businessId}`,
        config,
        { method: 'POST', body: JSON.stringify(payload) },
      )) as { success?: boolean; data?: { id?: number }; error?: { code?: string; message?: string } };
      if (data?.success === false || data?.error) {
        await this._logSyncResult('order', order.orderCode, 'create', {
          ok: false, entity: 'order', error: data.error?.message || 'CRM rejected order'
        }, { orderCode: order.orderCode });
        return { ok: false, entity: 'order', error: data.error?.message || 'CRM rejected order' };
      }
      // Log successful order sync with invoice ID
      await this._logSyncResult('order', order.orderCode, 'create', {
        ok: true, entity: 'order', remoteId: data?.data?.id
      }, { orderCode: order.orderCode, invoiceId: data?.data?.id, total: order.total });
      return { ok: true, entity: 'order', remoteId: data?.data?.id ?? undefined };
    } catch (err: any) {
      await this._logSyncResult('order', order.orderCode, 'create', {
        ok: false, entity: 'order', error: err?.message ?? String(err)
      }, { orderCode: order.orderCode });
      return { ok: false, entity: 'order', error: err?.message ?? String(err) };
    }
  },

  /**
   * Push a product to the CRM. A product the CRM already has (known id, or
   * found by its code) is edited; only a product it lacks is created. Creating
   * an existing code is rejected as a duplicate, which is why every re-sync
   * used to fail.
   */
  async pushProduct(
    product: CrmProduct,
    config: CrmConfig,
    requestOptions: { retries?: number; remoteId?: string | number | null } = {},
  ): Promise<CrmSyncResult> {
    try {
      const knownId = toCrmId(requestOptions.remoteId);
      if (knownId) {
        const updated = await updateCrmProduct(product, knownId, config, requestOptions.retries);
        // A stored id can go stale (product removed or re-made in the CRM): fall through and look it up by code.
        if (updated.ok || isTransientCrmError(updated.error)) return updated;
      }
      const found = await this.searchProduct({ productId: product.productId }, config);
      if (!found.ok) return found;
      const remoteId = toCrmId(found.remoteId);
      if (remoteId) return await updateCrmProduct(product, remoteId, config, requestOptions.retries);

      const created = await createCrmProduct(product, config, requestOptions.retries);
      if (created.ok || !isDuplicateCodeError(created.error)) return created;
      // The search missed a product the CRM does hold: look it up again and edit it.
      const again = await this.searchProduct({ productId: product.productId }, config);
      const existingId = again.ok ? toCrmId(again.remoteId) : undefined;
      if (!existingId) return created;
      return await updateCrmProduct(product, existingId, config, requestOptions.retries);
    } catch (err: any) {
      return { ok: false, entity: 'product', error: err?.message ?? String(err) };
    }
  },

  /**
   * Find the CRM person for a phone number. The CRM ignores free-text `query`/
   * `search` fields and just lists its newest people, which used to attach
   * every order to whoever registered last; filter on the exact phone (then
   * mobile) instead, and only accept a row whose number really matches.
   * With several matches (duplicates), the oldest one wins so the choice is stable.
   */
  async searchPerson(
    query: { phone?: string; name?: string; email?: string },
    config: CrmConfig,
  ): Promise<CrmSyncResult & { personId?: number }> {
    const phone = query.phone?.trim();
    if (!phone) return { ok: true, entity: 'person', personId: undefined };
    try {
      for (const property of ['phone', 'mobile'] as const) {
        const data = await crmRequest<CrmEnvelope & {
          data?: { items?: Array<{ id: number; phone?: string | null; mobile?: string | null }> };
        }>(`/api/v1/persons/businesses/${config.businessId}/persons`, config, {
          method: 'POST',
          body: JSON.stringify({ take: 20, skip: 0, filters: [{ property, operator: '=', value: phone }] }),
        });
        const error = envelopeError(data);
        if (error) return { ok: false, entity: 'person', error };
        const ids = (data?.data?.items ?? [])
          .filter((item) => item[property]?.trim() === phone)
          .map((item) => toCrmId(item.id))
          .filter((id): id is number => id !== undefined)
          .sort((a, b) => a - b);
        if (ids.length) return { ok: true, entity: 'person', personId: ids[0] };
      }
      return { ok: true, entity: 'person', personId: undefined };
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
      // Hesabix API: POST /api/v1/products/business/{businessId}/search
      // The CRM ignores a `query` field and just lists its first products, so
      // filter on the exact code instead.
      const payload = {
        take: 10,
        skip: 0,
        filters: [{ property: 'code', operator: '=', value: query.productId }],
      };
      const data = (await crmRequest<{
        success?: boolean;
        data?: {
          items?: Array<{ id: number; code?: string; name?: string; general_barcodes?: string }>;
        };
        error?: { code?: string; message?: string };
      }>(`/api/v1/products/business/${config.businessId}/search`, config, {
        method: 'POST',
        body: JSON.stringify(payload),
      })) as {
        success?: boolean;
        data?: { items?: Array<{ id: number; code?: string; name?: string; general_barcodes?: string }> };
        error?: { code?: string; message?: string };
      };
      if (data?.success === false || data?.error) {
        return { ok: false, entity: 'product', error: data.error?.message || 'CRM product search failed' };
      }
      const match = data?.data?.items?.find((item) =>
        item.code === query.productId || item.general_barcodes === query.productId,
      );
      if (!match) {
        return { ok: true, entity: 'product', remoteId: undefined };
      }
      return { ok: true, entity: 'product', remoteId: match.id };
    } catch (err: any) {
      return { ok: false, entity: 'product', error: err?.message ?? String(err) };
    }
  },

  /** Delete a product from CRM by its remote id (or resolve that id by code). */
  async deleteProduct(
    productId: string,
    config: CrmConfig,
    knownRemoteId?: string | number,
  ): Promise<CrmSyncResult> {
    try {
      let remoteId = knownRemoteId;
      if (!remoteId) {
        const found = await this.searchProduct({ productId }, config);
        if (!found.ok) return found;
        remoteId = found.remoteId;
      }
      if (!remoteId) {
        return { ok: true, entity: 'product', deduped: true };
      }

      const data = await crmRequest<{
        success?: boolean;
        result?: number;
        message?: string;
        error?: { message?: string } | string;
      }>(`/api/v1/products/business/${config.businessId}/${remoteId}`, config, {
        method: 'DELETE',
        retries: 0,
      });
      const error = typeof data?.error === 'string' ? data.error : data?.error?.message;
      if (data?.success === false || error || data?.result === 2) {
        return { ok: false, entity: 'product', remoteId, error: error || data.message || 'CRM rejected product deletion' };
      }
      return { ok: true, entity: 'product', remoteId };
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
      // Reuse the CRM's existing person for this phone instead of adding a duplicate.
      const existing = await this.searchPerson({ phone: person.phone }, config);
      if (!existing.ok) return existing;
      if (existing.personId) return { ok: true, entity: 'person', personId: existing.personId, remoteId: existing.personId, deduped: true };
      const payload = {
        alias_name: person.aliasName || `${person.firstName}${person.lastName ? ' ' + person.lastName : ''}`,
        first_name: person.firstName,
        last_name: person.lastName ?? '',
        phone: person.phone,
        email: person.email ?? '',
        person_types: ['مشتری'],
      };
      // Hesabix API: POST /api/v1/persons/businesses/{businessId}/persons/create
      const data = (await crmRequest<{
        success?: boolean;
        data?: { id?: number };
        error?: { code?: string; message?: string };
      }>(
        `/api/v1/persons/businesses/${config.businessId}/persons/create`,
        config,
        { method: 'POST', body: JSON.stringify(payload) },
      )) as { success?: boolean; data?: { id?: number }; error?: { code?: string; message?: string } };
      if (data?.success === false || data?.error) {
        await this._logSyncResult('person', person.phone, 'create', {
          ok: false, entity: 'person', error: data.error?.message || 'CRM rejected person'
        }, { phone: person.phone, aliasName: person.aliasName });
        return { ok: false, entity: 'person', error: data.error?.message || 'CRM rejected person' };
      }
      // Log successful person sync
      await this._logSyncResult('person', person.phone, 'create', {
        ok: true, entity: 'person', remoteId: data?.data?.id as any
      }, { phone: person.phone, aliasName: person.aliasName, crmId: data?.data?.id });
      return { ok: true, entity: 'person', personId: data?.data?.id };
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
