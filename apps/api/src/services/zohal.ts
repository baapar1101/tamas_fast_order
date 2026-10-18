const DEFAULT_BASE_URL = 'https://service.zohal.io/api/v0';

export interface ZohalResponseBody<T> {
  data: T;
  error_code: string | null;
  message: string;
}

export interface ZohalEnvelope<T> {
  result: number;
  response_body: ZohalResponseBody<T>;
}

export interface ZohalIdentityData {
  alive: boolean | null;
  father_name: string | null;
  first_name: string | null;
  is_dead: boolean | null;
  last_name: string | null;
  matched: boolean;
  national_code: string | null;
}

export interface ZohalBouncedChequeData {
  count: number;
}

export class ZohalError extends Error {
  readonly statusCode: number | undefined;
  readonly providerCode: string | null;

  constructor(message: string, options: { statusCode?: number; providerCode?: string | null } = {}) {
    super(message);
    this.name = 'ZohalError';
    this.statusCode = options.statusCode;
    this.providerCode = options.providerCode ?? null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Zohal's current OpenAPI response is a direct envelope. Older gateway
 * responses wrapped that envelope in an array under data.result, so accept
 * both while deployments migrate.
 */
export function unwrapZohalEnvelope<T>(payload: unknown): ZohalEnvelope<T> | null {
  const item = Array.isArray(payload) ? payload[0] : payload;
  if (!isRecord(item)) return null;

  if (isRecord(item.response_body) && typeof item.result === 'number') {
    return item as unknown as ZohalEnvelope<T>;
  }

  const data = item.data;
  if (!isRecord(data)) return null;
  const nested = data.result;
  if (!isRecord(nested) || !isRecord(nested.response_body) || typeof nested.result !== 'number') return null;
  return nested as unknown as ZohalEnvelope<T>;
}

/** Convert the canonical stored Jalali date (YYYY-MM-DD) to Zohal's YYYY/MM/DD. */
export function toZohalBirthDate(normalizedJalaliDate: string): string {
  return normalizedJalaliDate.replace(/-/g, '/');
}

export interface ZohalClientOptions {
  token: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class ZohalClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ZohalClientOptions) {
    this.token = options.token.trim();
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    if (!this.token) {
      throw new ZohalError('تنظیمات سامانه زحل کامل نشده است.');
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof ZohalError) throw error;
      throw new ZohalError('ارتباط با سامانه زحل برقرار نشد. لطفاً دوباره تلاش کنید.');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ZohalError('پاسخ نامعتبر از سامانه زحل دریافت شد.', { statusCode: response.status });
    }

    const envelope = unwrapZohalEnvelope<T>(payload);
    const providerCode = envelope?.response_body?.error_code ?? null;
    if (!response.ok || !envelope || envelope.result !== 1) {
      throw new ZohalError('سامانه زحل درخواست را نپذیرفت. اطلاعات ورودی را بررسی کنید.', {
        statusCode: response.status,
        providerCode,
      });
    }

    return envelope.response_body.data;
  }

  inquiryIdentity(nationalCode: string, normalizedBirthDate: string): Promise<ZohalIdentityData> {
    return this.post<ZohalIdentityData>('/services/inquiry/national_identity_inquiry', {
      national_code: nationalCode,
      birth_date: toZohalBirthDate(normalizedBirthDate),
    });
  }

  inquiryBouncedCheque(nationalCode: string): Promise<ZohalBouncedChequeData> {
    return this.post<ZohalBouncedChequeData>('/services/inquiry/bounced_cheque', {
      national_code: nationalCode,
      nationality_type: 1,
    });
  }
}
