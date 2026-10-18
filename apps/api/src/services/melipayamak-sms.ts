import { isValidPhone, normalizePhone } from '@tamas/shared';

export interface MelipayamakSmsInput {
  username: string;
  apiKey: string;
  sender: string;
  baseUrl: string;
  toPhone: string;
  text: string;
}

export interface MelipayamakPatternSmsInput {
  username: string;
  apiKey: string;
  patternBaseUrl: string;
  toPhone: string;
  bodyId: string;
  values: string[];
}

export interface SmsTransportResult {
  ok: boolean;
  error?: string;
  /** True only when trying another provider cannot duplicate an accepted SMS. */
  fallbackSafe?: boolean;
}

interface MelipayamakResponse {
  Value?: unknown;
  RetStatus?: unknown;
  StrRetStatus?: unknown;
}

function isPositiveReceipt(value: unknown): boolean {
  const receipt = String(value ?? '').trim();
  return /^\d+$/.test(receipt) && !/^0+$/.test(receipt);
}

function isProviderResponse(value: unknown): value is MelipayamakResponse {
  return typeof value === 'object' && value !== null;
}

function parseProviderResult(response: Response, raw: string, label = 'ملی‌پیامک'): SmsTransportResult {
  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    // Some legacy endpoints return a plain numeric receipt id.
  }
  const accepted = isProviderResponse(parsed)
    ? Number(parsed.RetStatus) === 1 && isPositiveReceipt(parsed.Value)
    : isPositiveReceipt(parsed);
  if (response.ok && accepted) return { ok: true };

  const status = isProviderResponse(parsed) ? Number(parsed.RetStatus) : undefined;
  const detail = isProviderResponse(parsed) && typeof parsed.StrRetStatus === 'string'
    ? parsed.StrRetStatus.trim().slice(0, 180)
    : '';
  const plainCode = /^-?\d+$/.test(String(parsed)) ? String(parsed) : '';
  const safeResponse = Number.isFinite(status)
    ? `وضعیت ${status}${detail ? `: ${detail}` : ''}`
    : plainCode || `HTTP ${response.status}`;
  return { ok: false, error: `${label} ارسال را نپذیرفت (پاسخ ${safeResponse}).`, fallbackSafe: true };
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
    return parseProviderResult(response, raw);
  } catch {
    return { ok: false, error: 'ارتباط با وب‌سرویس ملی‌پیامک برقرار نشد.', fallbackSafe: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Sends an approved shared-service template (BaseServiceNumber). */
export async function sendMelipayamakPatternSms(
  input: MelipayamakPatternSmsInput,
  fetchImpl: typeof fetch = fetch,
): Promise<SmsTransportResult> {
  if (!input.username.trim() || !input.apiKey.trim() || !input.bodyId.trim()) {
    return { ok: false, error: 'نام کاربری، کلید API یا کد الگوی ملی‌پیامک تنظیم نشده است.', fallbackSafe: true };
  }
  if (!/^\d+$/.test(input.bodyId.trim())) {
    return { ok: false, error: 'کد الگوی ملی‌پیامک معتبر نیست.', fallbackSafe: true };
  }
  if (!isValidPhone(input.toPhone)) {
    return { ok: false, error: 'شماره همراه گیرنده معتبر نیست.', fallbackSafe: false };
  }

  let endpoint: URL;
  try {
    endpoint = new URL(input.patternBaseUrl);
    if (endpoint.protocol !== 'https:') throw new Error('Insecure SMS endpoint');
  } catch {
    return { ok: false, error: 'نشانی امن وب‌سرویس الگوی ملی‌پیامک معتبر نیست.', fallbackSafe: true };
  }

  const payload = new URLSearchParams({
    username: input.username.trim(),
    password: input.apiKey.trim(),
    text: input.values.join(';'),
    to: normalizePhone(input.toPhone),
    bodyId: input.bodyId.trim(),
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
    return parseProviderResult(response, (await response.text()).trim(), 'الگوی ملی‌پیامک');
  } catch {
    return { ok: false, error: 'ارتباط با وب‌سرویس الگوی ملی‌پیامک برقرار نشد.', fallbackSafe: false };
  } finally {
    clearTimeout(timer);
  }
}
