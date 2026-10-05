import { env } from '../env.js';
import { getAllSettings } from './settings.js';

export async function sendSms(toPhone: string, text: string): Promise<{ ok: boolean; error?: string }> {
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
    return { ok: false, error: `ارسال پیامک ناموفق بود (پاسخ: ${body}).` };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[rastin-sms] error sending to ${toPhone}:`, err);
    return { ok: false, error: err instanceof Error ? err.message : 'خطا در ارتباط با سامانه پیامک' };
  } finally {
    clearTimeout(timer);
  }
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

  return sendSms(toPhone, text);
}
