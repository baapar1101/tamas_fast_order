import { isValidPhone, normalizePhone } from '@tamas/shared';

interface PayamresanSmsInput {
  apiKey: string;
  sender: string;
  baseUrl: string;
  toPhone: string;
  text: string;
}

interface PayamresanResponse {
  Success?: boolean;
  ErrorCode?: number | null;
}

/** Direct Payam Resan V3 transport. Never put the API key or message in the URL. */
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
  try {
    endpoint = new URL(`${input.baseUrl.replace(/\/+$/, '')}/SendBulk`);
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
        Recipients: [{ Destination: Number(normalizePhone(input.toPhone).slice(1)) }],
      }),
      signal: controller.signal,
    });
    const data = (await response.json()) as PayamresanResponse;
    if (response.ok && data?.Success === true) return { ok: true };

    const code = Number.isInteger(data?.ErrorCode) ? ` (کد ${data.ErrorCode})` : '';
    return { ok: false, error: `سامانه پیام‌رسان ارسال پیامک را نپذیرفت${code}.` };
  } catch {
    return { ok: false, error: 'ارتباط با سامانه پیام‌رسان برقرار نشد.' };
  } finally {
    clearTimeout(timer);
  }
}
