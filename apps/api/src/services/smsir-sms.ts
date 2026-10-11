import { isValidPhone, normalizePhone } from '@tamas/shared';
import type { SmsTransportResult } from './melipayamak-sms.js';

interface SmsIrBaseInput {
  apiKey: string;
  baseUrl: string;
  toPhone: string;
}

export interface SmsIrBulkInput extends SmsIrBaseInput {
  lineNumber: string;
  text: string;
}

export interface SmsIrVerifyInput extends SmsIrBaseInput {
  templateId: string;
  parameters: Array<{ name: string; value: string }>;
}

interface SmsIrResponse {
  status?: unknown;
  message?: unknown;
  data?: {
    packId?: unknown;
    messageId?: unknown;
    messageIds?: unknown;
  };
}

function isResponse(value: unknown): value is SmsIrResponse {
  return typeof value === 'object' && value !== null;
}

function hasReceipt(data: SmsIrResponse['data']): boolean {
  if (!data) return false;
  if (String(data.packId ?? '').trim()) return true;
  if (/^\d+$/.test(String(data.messageId ?? '').trim())) return true;
  return Array.isArray(data.messageIds) && data.messageIds.length > 0;
}

async function requestSmsIr(
  input: SmsIrBaseInput,
  path: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<SmsTransportResult> {
  if (!input.apiKey.trim()) {
    return { ok: false, error: 'کلید API سامانه sms.ir تنظیم نشده است.', fallbackSafe: true };
  }
  if (!isValidPhone(input.toPhone)) {
    return { ok: false, error: 'شماره همراه گیرنده معتبر نیست.', fallbackSafe: false };
  }

  let endpoint: URL;
  try {
    endpoint = new URL(`${input.baseUrl.replace(/\/+$/, '')}${path}`);
    if (endpoint.protocol !== 'https:') throw new Error('Insecure SMS endpoint');
  } catch {
    return { ok: false, error: 'نشانی امن وب‌سرویس sms.ir معتبر نیست.', fallbackSafe: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': input.apiKey.trim(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = (await response.text()).trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = undefined;
    }

    if (response.ok && isResponse(parsed) && Number(parsed.status) === 1 && hasReceipt(parsed.data)) {
      return { ok: true };
    }

    const status = isResponse(parsed) && Number.isFinite(Number(parsed.status))
      ? Number(parsed.status)
      : response.status;
    const detail = isResponse(parsed) && typeof parsed.message === 'string'
      ? parsed.message.trim().slice(0, 180)
      : '';
    return {
      ok: false,
      error: `سامانه sms.ir ارسال را نپذیرفت (وضعیت ${status}${detail ? `: ${detail}` : ''}).`,
      fallbackSafe: true,
    };
  } catch {
    return { ok: false, error: 'ارتباط با وب‌سرویس sms.ir برقرار نشد.', fallbackSafe: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Sends arbitrary site notifications through the official SMS.ir bulk endpoint. */
export async function sendSmsIrBulk(
  input: SmsIrBulkInput,
  fetchImpl: typeof fetch = fetch,
): Promise<SmsTransportResult> {
  const lineNumber = Number(input.lineNumber.trim());
  if (!/^\d+$/.test(input.lineNumber.trim()) || !Number.isSafeInteger(lineNumber)) {
    return { ok: false, error: 'شماره خط ارسال sms.ir معتبر نیست.', fallbackSafe: true };
  }
  return requestSmsIr(input, '/v1/send/bulk', {
    lineNumber,
    messageText: input.text,
    mobiles: [normalizePhone(input.toPhone)],
  }, fetchImpl);
}

/** Sends an OTP through an approved SMS.ir template. */
export async function sendSmsIrVerify(
  input: SmsIrVerifyInput,
  fetchImpl: typeof fetch = fetch,
): Promise<SmsTransportResult> {
  const templateId = Number(input.templateId.trim());
  if (!/^\d+$/.test(input.templateId.trim()) || !Number.isSafeInteger(templateId)) {
    return { ok: false, error: 'شناسه قالب sms.ir معتبر نیست.', fallbackSafe: true };
  }
  if (!input.parameters.length || input.parameters.some(({ name }) => !name.trim())) {
    return { ok: false, error: 'پارامترهای قالب sms.ir معتبر نیستند.', fallbackSafe: true };
  }
  return requestSmsIr(input, '/v1/send/verify', {
    mobile: normalizePhone(input.toPhone),
    templateId,
    parameters: input.parameters.map(({ name, value }) => ({ name: name.trim(), value })),
  }, fetchImpl);
}
