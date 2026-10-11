import { isValidPhone, normalizePhone } from '@tamas/shared';

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

/** Direct Payam Resan V3/V4 transport. Never put the API key or message in the URL. */
export async function sendPayamresanSms(
  input: PayamresanSmsInput,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; error?: string }> {
  if (!input.apiKey.trim() || !input.sender.trim()) {
    return { ok: false, error: 'کلید API یا خط فرستندهٔ سامانه پیام‌رسان تنظیم نشده است.' };
  }

  const sender = Number(input.sender.trim());
  if (!/^\d+$/.test(input.sender.trim()) || !Number.isSafeInteger(sender)) {
    return { ok: false, error: 'شماره خط فرستندهٔ پیام‌رسان معتبر نیست.' };
  }
  if (!isValidPhone(input.toPhone)) {
    return { ok: false, error: 'شماره همراه گیرنده معتبر نیست.' };
  }

  let endpoint: URL;
  let v4 = false;
  try {
    const baseUrl = new URL(input.baseUrl);
    v4 = isV4Endpoint(baseUrl);
    endpoint = new URL(`${input.baseUrl.replace(/\/+$/, '')}/${v4 ? 'Send' : 'SendBulk'}`);
    if (endpoint.protocol !== 'https:') throw new Error('Insecure SMS endpoint');
  } catch {
    return { ok: false, error: 'نشانی امن سامانه پیام‌رسان معتبر نیست.' };
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

    return { ok: false, error: providerError(data) };
  } catch {
    return { ok: false, error: 'ارتباط با سامانه پیام‌رسان برقرار نشد.' };
  } finally {
    clearTimeout(timer);
  }
}
