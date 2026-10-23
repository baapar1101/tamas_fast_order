import { isValidPhone, normalizePhone } from '@tamas/shared';
import type { SmsTransportResult } from './melipayamak-sms.js';

interface PayamresanSmsInput {
  apiKey: string;
  sender: string;
  baseUrl: string;
  toPhone: string;
  text: string;
  userTraceId?: number;
}

interface PayamresanResponse {
  Success?: boolean;
  ErrorCode?: number | null;
  Error?: string | null;
  success?: boolean;
  errorCode?: number | null;
  error?: string | null;
}

function isV4Endpoint(baseUrl: URL): boolean {
  return /\/uapi\/v4\/?$/i.test(baseUrl.pathname);
}

function providerError(data: PayamresanResponse): string {
  const code = data.errorCode ?? data.ErrorCode;
  const detail = data.error ?? data.Error;
  const codeText = Number.isInteger(code) ? ` (کد ${code})` : '';
  const detailText = detail?.trim() ? `: ${detail.trim()}` : '';
  return `سامانه پیام‌رسان ارسال پیامک را نپذیرفت${codeText}${detailText}.`;
}

function mayUseFallback(data: PayamresanResponse): boolean {
  const code = data.errorCode ?? data.ErrorCode;
  return Number.isInteger(code) && ![4, 5, 20, 100].includes(Number(code));
}

/** Direct Payam Resan V3/V4 transport. Never put the API key or message in the URL. */
export async function sendPayamresanSms(
  input: PayamresanSmsInput,
  fetchImpl: typeof fetch = fetch,
): Promise<SmsTransportResult> {
  if (!input.apiKey.trim() || !input.sender.trim()) {
    return { ok: false, error: 'کلید API یا خط فرستندهٔ سامانه پیام‌رسان تنظیم نشده است.', fallbackSafe: true };
  }

  const sender = Number(input.sender.trim());
  if (!/^\d+$/.test(input.sender.trim()) || !Number.isSafeInteger(sender)) {
    return { ok: false, error: 'شماره خط فرستندهٔ پیام‌رسان معتبر نیست.', fallbackSafe: true };
  }
  if (!isValidPhone(input.toPhone)) {
    return { ok: false, error: 'شماره همراه گیرنده معتبر نیست.', fallbackSafe: false };
  }

  let endpoint: URL;
  let v4: boolean;
  try {
    const baseUrl = new URL(input.baseUrl);
    v4 = isV4Endpoint(baseUrl);
    endpoint = new URL(`${input.baseUrl.replace(/\/+$/, '')}/${v4 ? 'Send' : 'SendBulk'}`);
    if (endpoint.protocol !== 'https:') throw new Error('Insecure SMS endpoint');
  } catch {
    return { ok: false, error: 'نشانی امن سامانه پیام‌رسان معتبر نیست.', fallbackSafe: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ApiKey: input.apiKey.trim(),
        Text: input.text,
        Sender: sender,
        Recipients: [{
          Destination: Number(normalizePhone(input.toPhone).slice(1)),
          ...(v4 ? { UserTraceId: input.userTraceId ?? Date.now() } : {}),
        }],
      }),
      signal: controller.signal,
    });
    const data = (await response.json()) as PayamresanResponse;
    if (response.ok && (data?.Success === true || data?.success === true)) return { ok: true };

    return { ok: false, error: providerError(data), fallbackSafe: mayUseFallback(data) };
  } catch {
    return { ok: false, error: 'ارتباط با سامانه پیام‌رسان برقرار نشد.', fallbackSafe: false };
  } finally {
    clearTimeout(timer);
  }
}
