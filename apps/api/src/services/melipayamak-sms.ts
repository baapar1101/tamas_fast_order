import { isValidPhone, normalizePhone } from '@tamas/shared';

export interface MelipayamakSmsInput {
  username: string;
  apiKey: string;
  sender: string;
  baseUrl: string;
  toPhone: string;
  text: string;
}

export interface SmsTransportResult {
  ok: boolean;
  error?: string;
  /** True only when trying another provider cannot duplicate an accepted SMS. */
  fallbackSafe?: boolean;
}

/** Lightweight implementation of the official melipayamak-node REST send contract. */
export async function sendMelipayamakSms(
  input: MelipayamakSmsInput,
  fetchImpl: typeof fetch = fetch,
): Promise<SmsTransportResult> {
  if (!input.username.trim() || !input.apiKey.trim() || !input.sender.trim()) {
    return { ok: false, error: 'نام کاربری، کلید API یا خط فرستندهٔ ملی‌پیامک تنظیم نشده است.', fallbackSafe: true };
  }
  if (!isValidPhone(input.toPhone)) {
    return { ok: false, error: 'شماره همراه گیرنده معتبر نیست.', fallbackSafe: false };
  }

  let endpoint: URL;
  try {
    endpoint = new URL(`${input.baseUrl.replace(/\/+$/, '')}/SendSMS`);
    if (endpoint.protocol !== 'https:') throw new Error('Insecure SMS endpoint');
  } catch {
    return { ok: false, error: 'نشانی امن وب‌سرویس ملی‌پیامک معتبر نیست.', fallbackSafe: true };
  }

  const payload = new URLSearchParams({
    username: input.username.trim(),
    password: input.apiKey.trim(),
    to: normalizePhone(input.toPhone),
    from: input.sender.trim(),
    text: input.text,
    isFlash: 'false',
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: payload.toString(),
      signal: controller.signal,
    });
    const raw = (await response.text()).trim();
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      // The legacy endpoint may return a plain numeric receipt id.
    }
    const receiptId = Number(parsed);
    if (response.ok && Number.isSafeInteger(receiptId) && receiptId > 0) return { ok: true };

    const safeResponse = /^-?\d+$/.test(String(parsed)) ? String(parsed) : `HTTP ${response.status}`;
    return { ok: false, error: `ملی‌پیامک ارسال را نپذیرفت (پاسخ ${safeResponse}).`, fallbackSafe: true };
  } catch {
    return { ok: false, error: 'ارتباط با وب‌سرویس ملی‌پیامک برقرار نشد.', fallbackSafe: false };
  } finally {
    clearTimeout(timer);
  }
}
