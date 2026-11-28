import { toAsciiDigits } from '@tamas/shared';
import { AppError } from '../lib/errors.js';

/**
 * Payam Resan web service, version 4 (https://www.payam-resan.com/uapi/v4).
 *
 * Every call is a POST with a JSON body that carries `ApiKey`; every answer is
 * the `{ success, result, errorCode, error }` envelope, and `success` decides
 * the outcome even when HTTP says 200. The key only ever travels in the body —
 * never in a URL, a log line or an error message.
 */

export const PAYAMRESAN_V4_BASE_URL = 'https://www.payam-resan.com/uapi/v4';

/* ------------------------------------------------------------------ *
 * Models
 * ------------------------------------------------------------------ */

/** The envelope every v4 method answers with. */
export interface PayamResanEnvelope<T> {
  success: boolean;
  result: T;
  errorCode: number | null;
  error: string | null;
}

/** POST /GetInbox and /GetAccountInfo take nothing but the key. */
export type GetInboxRequest = Record<string, never>;
export type GetAccountInfoRequest = Record<string, never>;

/** One unread incoming SMS as the provider sends it. */
export interface GetInboxResultItem {
  id: string | number;
  text: string;
  from: string | number;
  to: string | number;
  /** Iran local time, `YYYY-MM-DD HH:mm:ss`. */
  time: string;
}

/** POST /GetAccountInfo result. */
export interface GetAccountInfoResult {
  credit: number;
  availableSenders: Array<string | number>;
}

/** An incoming SMS after validation: ids and numbers are kept as strings. */
export interface InboxMessage {
  /** Provider message id, kept as text so no digit is lost. */
  id: string;
  text: string;
  /** Sender as received (digits only). */
  from: string;
  /** Sender in the provider's `9xxxxxxxxx` mobile form, or null for a non-mobile sender. */
  fromMobile: string | null;
  /** The receiving line (one of our senders). */
  to: string;
  /** Raw provider time (Iran local time). */
  time: string;
  /** `time` converted to an absolute instant, or null when it could not be read. */
  receivedAt: Date | null;
}

export interface AccountInfo {
  credit: number;
  availableSenders: string[];
}

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

export type PayamResanErrorKind = 'not_configured' | 'network' | 'timeout' | 'http' | 'invalid_response' | 'provider';

const ERROR_MESSAGES: Record<PayamResanErrorKind, string> = {
  not_configured: 'کلید API سامانه پیام‌رسان تنظیم نشده است.',
  network: 'ارتباط با سامانه پیام‌رسان برقرار نشد.',
  timeout: 'سامانه پیام‌رسان در زمان مقرر پاسخ نداد.',
  http: 'سامانه پیام‌رسان پاسخ غیرمنتظره داد',
  invalid_response: 'پاسخ سامانه پیام‌رسان قابل خواندن نبود.',
  provider: 'سامانه پیام‌رسان درخواست را نپذیرفت',
};

/** Follows the API's AppError convention so admin routes can surface it as-is. */
export class PayamResanError extends AppError {
  readonly kind: PayamResanErrorKind;
  readonly providerErrorCode: number | null;
  readonly httpStatus: number | null;

  constructor(kind: PayamResanErrorKind, details: { httpStatus?: number; errorCode?: number | null; error?: string | null } = {}) {
    const code = details.errorCode ?? null;
    const providerText = typeof details.error === 'string' ? details.error.trim().slice(0, 200) : '';
    let message = ERROR_MESSAGES[kind];
    if (kind === 'http') message += ` (HTTP ${details.httpStatus}).`;
    if (kind === 'provider') message += `${code !== null ? ` (کد ${code})` : ''}${providerText ? `: ${providerText}` : ''}.`;
    super(message, kind === 'timeout' ? 504 : kind === 'not_configured' ? 400 : 502, 'sms_provider_error', {
      providerErrorCode: code,
    });
    this.name = 'PayamResanError';
    this.kind = kind;
    this.providerErrorCode = code;
    this.httpStatus = details.httpStatus ?? null;
  }
}

/* ------------------------------------------------------------------ *
 * Number helpers
 * ------------------------------------------------------------------ */

/** Folds any Iranian mobile shape (09…, +989…, 989…, 9…) to `9xxxxxxxxx`; null if it is not a mobile. */
export function toProviderMobile(value: unknown): string | null {
  let digits = toAsciiDigits(value).replace(/\D/g, '');
  if (digits.startsWith('0098')) digits = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith('98')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('09')) digits = digits.slice(1);
  return /^9\d{9}$/.test(digits) ? digits : null;
}

/** Iran has stayed on +03:30 all year since 2022, so local time maps to one offset. */
export function parseIranLocalTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(toAsciiDigits(value).trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s = '00'] = match;
  // A Jalali date (13xx/14xx) would land centuries off; leave it for the raw column.
  if (Number(y) < 1900) return null;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+03:30`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const asDigits = (value: unknown) => toAsciiDigits(value).replace(/\D/g, '');

function idText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/* ------------------------------------------------------------------ *
 * Client
 * ------------------------------------------------------------------ */

export interface SmsServiceOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export class SmsService {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;

  constructor(apiKey: string, options: SmsServiceOptions = {}) {
    this.#apiKey = apiKey.trim();
    this.#baseUrl = (options.baseUrl ?? PAYAMRESAN_V4_BASE_URL).replace(/\/+$/, '');
    this.#timeoutMs = options.timeoutMs ?? 15_000;
    this.#fetch = options.fetch ?? fetch;
    if (new URL(this.#baseUrl).protocol !== 'https:') throw new Error('Payam Resan base URL must use https');
  }

  get configured(): boolean {
    return Boolean(this.#apiKey);
  }

  /** Unread incoming SMS. The provider likely marks them read once returned, so store them right away. */
  async getInbox(): Promise<InboxMessage[]> {
    const result = await this.#call<GetInboxRequest, GetInboxResultItem[] | null>('GetInbox', {});
    if (result == null) return [];
    if (!Array.isArray(result)) throw new PayamResanError('invalid_response');
    return result.map((item) => {
      const id = idText(item?.id);
      if (!id || typeof item.text !== 'string') throw new PayamResanError('invalid_response');
      const from = asDigits(item.from);
      const time = typeof item.time === 'string' ? item.time : '';
      return {
        id,
        text: item.text,
        from,
        fromMobile: toProviderMobile(from),
        to: asDigits(item.to),
        time,
        receivedAt: parseIranLocalTime(time),
      };
    });
  }

  async getAccountInfo(): Promise<AccountInfo> {
    const result = await this.#call<GetAccountInfoRequest, GetAccountInfoResult>('GetAccountInfo', {});
    if (!result || typeof result !== 'object' || !Number.isFinite(Number(result.credit))) {
      throw new PayamResanError('invalid_response');
    }
    return {
      credit: Number(result.credit),
      availableSenders: Array.isArray(result.availableSenders) ? result.availableSenders.map(asDigits).filter(Boolean) : [],
    };
  }

  async #call<Req extends object, Res>(method: string, body: Req): Promise<Res> {
    if (!this.#apiKey) throw new PayamResanError('not_configured');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ApiKey: this.#apiKey, ...body }),
        signal: controller.signal,
      });
    } catch {
      // The fetch error is dropped on purpose: it can echo the request.
      throw new PayamResanError(controller.signal.aborted ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }

    let data: Partial<PayamResanEnvelope<Res>> | null = null;
    try {
      data = (await response.json()) as Partial<PayamResanEnvelope<Res>>;
    } catch {
      data = null;
    }
    if (data && typeof data === 'object' && typeof data.success === 'boolean') {
      if (data.success !== true) {
        throw new PayamResanError('provider', { errorCode: data.errorCode ?? null, error: data.error ?? null });
      }
      if (!response.ok) throw new PayamResanError('http', { httpStatus: response.status });
      return data.result as Res;
    }
    if (!response.ok) throw new PayamResanError('http', { httpStatus: response.status });
    throw new PayamResanError('invalid_response');
  }
}
