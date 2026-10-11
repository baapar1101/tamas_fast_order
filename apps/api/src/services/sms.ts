import { env } from '../env.js';
import { getAllSettings } from './settings.js';
import { sendPayamresanSms } from './payamresan-sms.js';
import { sendMelipayamakSms, type SmsTransportResult } from './melipayamak-sms.js';
import { sendSmsIrBulk, sendSmsIrVerify, type SmsIrVerifyInput } from './smsir-sms.js';

type SmsIrTemplate = Pick<SmsIrVerifyInput, 'templateId' | 'parameters'>;

function melipayamakInput(toPhone: string, text: string) {
  return {
    username: env.MELIPAYAMAK_USERNAME,
    apiKey: env.MELIPAYAMAK_API_KEY,
    sender: env.MELIPAYAMAK_FROM,
    baseUrl: env.MELIPAYAMAK_BASE_URL,
    toPhone,
    text,
  };
}

function smsIrBaseInput(toPhone: string) {
  return {
    apiKey: env.SMSIR_API_KEY,
    baseUrl: env.SMSIR_BASE_URL,
    toPhone,
  };
}

async function sendPrimarySms(toPhone: string, text: string): Promise<SmsTransportResult> {
  if (env.SMS_PROVIDER === 'melipayamak') return sendMelipayamakSms(melipayamakInput(toPhone, text));

  if (env.SMS_PROVIDER === 'payamresan') {
    return sendPayamresanSms({
      apiKey: env.PAYAMRESAN_API_KEY,
      sender: env.PAYAMRESAN_SENDER,
      baseUrl: env.PAYAMRESAN_BASE_URL,
      toPhone,
      text,
    });
  }

  if (!env.RASTIN_SMS_USERNAME || !env.RASTIN_SMS_PASSWORD || !env.RASTIN_SMS_FROM) {
    return { ok: false, error: 'اطلاعات سامانه پیامک تنظیم نشده است.', fallbackSafe: true };
  }

  const params = new URLSearchParams({
    Username: env.RASTIN_SMS_USERNAME,
    Password: env.RASTIN_SMS_PASSWORD,
    From: env.RASTIN_SMS_FROM,
    To: toPhone,
    Text: text,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${env.RASTIN_SMS_URL}?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
    });
    const body = (await res.text()).trim();
    // eslint-disable-next-line no-console
    console.info(`[rastin-sms] ${toPhone} → status ${res.status}, response: ${body}`);
    // Positive number ID or '1' indicates successful SMS delivery
    if (res.ok && (body === '1' || Number(body) > 0)) {
      return { ok: true };
    }
    return { ok: false, error: `ارسال پیامک ناموفق بود (پاسخ: ${body}).`, fallbackSafe: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[rastin-sms] error sending to ${toPhone}:`, err);
    return { ok: false, error: err instanceof Error ? err.message : 'خطا در ارتباط با سامانه پیامک', fallbackSafe: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendSms(
  toPhone: string,
  text: string,
  smsIrTemplate?: SmsIrTemplate,
): Promise<{ ok: boolean; error?: string }> {
  let result = await sendPrimarySms(toPhone, text);
  if (result.ok) return { ok: true };

  const errors = [result.error ?? 'ارسال از سرویس اصلی ناموفق بود'];
  if (!result.fallbackSafe) return { ok: false, error: errors.join('؛ ') };

  if (env.SMS_FALLBACK_PROVIDER === 'melipayamak' && env.SMS_PROVIDER !== 'melipayamak') {
    result = await sendMelipayamakSms(melipayamakInput(toPhone, text));
    if (result.ok) return { ok: true };
    errors.push(`سرویس جایگزین اول: ${result.error ?? 'ناموفق بود'}`);
    if (!result.fallbackSafe) return { ok: false, error: errors.join('؛ ') };
  }

  if (env.SMS_SECOND_FALLBACK_PROVIDER === 'smsir') {
    result = smsIrTemplate
      ? await sendSmsIrVerify({ ...smsIrBaseInput(toPhone), ...smsIrTemplate })
      : await sendSmsIrBulk({
        ...smsIrBaseInput(toPhone),
        lineNumber: env.SMSIR_LINE_NUMBER,
        text,
      });
    if (result.ok) return { ok: true };
    errors.push(`سرویس جایگزین دوم: ${result.error ?? 'ناموفق بود'}`);
  }

  return { ok: false, error: errors.join('؛ ') };
}

export async function sendTemplatedSms(
  toPhone: string,
  templateKey: string,
  variables: Record<string, string>,
  defaultTemplate = '',
): Promise<{ ok: boolean; error?: string }> {
  const settings = await getAllSettings();
  const enabledKey = `sms_enabled_${templateKey.replace(/^sms_template_/, '')}`;
  const enabled = (settings[enabledKey] ?? '1').trim().toLowerCase();
  // Storage defaults to enabled whenever the key is missing.
  if (enabled === '0' || enabled === 'false' || enabled === 'disabled' || enabled === 'off' || enabled === 'no') {
    return { ok: true, error: 'ارسال پیامک برای این رویداد غیرفعال است.' };
  }

  let text = settings[templateKey] || defaultTemplate;

  if (!text) {
    return { ok: true, error: 'الگویی برای ارسال یافت نشد و پیامک لغو شد.' }; // Return ok if no template configured
  }

  for (const [key, value] of Object.entries(variables)) {
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }

  const smsIrTemplate = templateKey === 'sms_template_otp' && env.SMSIR_OTP_TEMPLATE_ID
    ? {
      templateId: env.SMSIR_OTP_TEMPLATE_ID,
      parameters: [{
        name: env.SMSIR_OTP_PARAMETER,
        value: variables.code ?? text,
      }],
    }
    : undefined;

  return sendSms(toPhone, text, smsIrTemplate);
}

export function sendUserApprovedSms(toPhone: string): Promise<{ ok: boolean; error?: string }> {
  return sendTemplatedSms(
    toPhone,
    'sms_template_user_approved',
    {},
    'حساب کاربری شما در تماس مارکت تایید شد',
  );
}
