import { getAllSettings } from './settings.js';
import { sendPayamresanSms } from './payamresan-sms.js';
import {
  sendMelipayamakPatternSms,
  sendMelipayamakSms,
  type SmsTransportResult,
} from './melipayamak-sms.js';
import { sendSmsIrBulk, sendSmsIrVerify, type SmsIrVerifyInput } from './smsir-sms.js';
import { getSmsRuntimeConfig, type SmsRuntimeConfig } from './sms-config.js';

type SmsIrTemplate = Pick<SmsIrVerifyInput, 'templateId' | 'parameters'>;
type MelipayamakTemplate = { bodyId: string; values: string[] };
type SmsTemplates = { melipayamak?: MelipayamakTemplate; smsir?: SmsIrTemplate };
type SmsAttempt = { label: string; send: () => Promise<SmsTransportResult> };

function melipayamakInput(config: SmsRuntimeConfig, toPhone: string, text: string) {
  return {
    username: config.melipayamak.username,
    apiKey: config.melipayamak.apiKey,
    sender: config.melipayamak.sender,
    baseUrl: config.melipayamak.baseUrl,
    toPhone,
    text,
  };
}

function melipayamakPatternInput(config: SmsRuntimeConfig, toPhone: string, template: MelipayamakTemplate) {
  return {
    username: config.melipayamak.username,
    apiKey: config.melipayamak.apiKey,
    patternBaseUrl: config.melipayamak.patternBaseUrl,
    toPhone,
    bodyId: template.bodyId,
    values: template.values,
  };
}

function smsIrBaseInput(config: SmsRuntimeConfig, toPhone: string) {
  return {
    apiKey: config.smsir.apiKey,
    baseUrl: config.smsir.baseUrl,
    toPhone,
  };
}

async function sendPrimarySms(
  config: SmsRuntimeConfig,
  toPhone: string,
  text: string,
  melipayamakTemplate?: MelipayamakTemplate,
): Promise<SmsTransportResult> {
  if (config.smsProvider === 'melipayamak') {
    return melipayamakTemplate
      ? sendMelipayamakPatternSms(melipayamakPatternInput(config, toPhone, melipayamakTemplate))
      : sendMelipayamakSms(melipayamakInput(config, toPhone, text));
  }

  if (config.smsProvider === 'payamresan') {
    return sendPayamresanSms({
      apiKey: config.payamresan.apiKey,
      sender: config.payamresan.sender,
      baseUrl: config.payamresan.baseUrl,
      toPhone,
      text,
    });
  }

  if (!config.rastin.username || !config.rastin.password || !config.rastin.sender) {
    return { ok: false, error: 'اطلاعات سامانه پیامک تنظیم نشده است.', fallbackSafe: true };
  }

  const params = new URLSearchParams({
    Username: config.rastin.username,
    Password: config.rastin.password,
    From: config.rastin.sender,
    To: toPhone,
    Text: text,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${config.rastin.url}?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
    });
    const body = (await res.text()).trim();

    console.info(`[rastin-sms] ${toPhone} → status ${res.status}, response: ${body}`);
    // Positive number ID or '1' indicates successful SMS delivery
    if (res.ok && (body === '1' || Number(body) > 0)) {
      return { ok: true };
    }
    return { ok: false, error: `ارسال پیامک ناموفق بود (پاسخ: ${body}).`, fallbackSafe: true };
  } catch (err) {

    console.error(`[rastin-sms] error sending to ${toPhone}:`, err);
    return { ok: false, error: err instanceof Error ? err.message : 'خطا در ارتباط با سامانه پیامک', fallbackSafe: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Starts every attempt before awaiting any result; one accepted send is enough. */
export async function settleParallelSmsAttempts(
  attempts: SmsAttempt[],
): Promise<{ ok: boolean; error?: string }> {
  if (attempts.length === 0) return { ok: false, error: 'هیچ درگاه پیامکی برای ارسال مجدد تنظیم نشده است.' };
  const results = await Promise.all(attempts.map(async ({ label, send }) => {
    try {
      return { label, result: await send() };
    } catch {
      return { label, result: { ok: false, error: 'خطای پیش‌بینی‌نشده' } as SmsTransportResult };
    }
  }));
  if (results.some(({ result }) => result.ok)) return { ok: true };
  return {
    ok: false,
    error: results.map(({ label, result }) => `${label}: ${result.error ?? 'ناموفق'}`).join('؛ '),
  };
}

/** On an explicit resend, broadcasts one identical OTP through all configured routes. */
export async function resendOtpAcrossProviders(
  toPhone: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const config = await getSmsRuntimeConfig();
  const text = `کد تایید شما در تماس مارکت: ${code}`;
  const melipayamakTemplate: MelipayamakTemplate = {
    bodyId: config.melipayamak.otpBodyId,
    values: [code],
  };
  const attempts: SmsAttempt[] = [{
    label: 'درگاه اصلی',
    send: () => sendPrimarySms(config, toPhone, text, melipayamakTemplate),
  }];

  if (config.firstFallback === 'melipayamak' && config.smsProvider !== 'melipayamak') {
    attempts.push({
      label: 'ملی‌پیامک',
      send: () => sendMelipayamakPatternSms(melipayamakPatternInput(config, toPhone, melipayamakTemplate)),
    });
  }
  if (config.secondFallback === 'smsir') {
    attempts.push({
      label: 'sms.ir',
      send: () => config.smsir.otpTemplateId
        ? sendSmsIrVerify({
          ...smsIrBaseInput(config, toPhone),
          templateId: config.smsir.otpTemplateId,
          parameters: [{ name: config.smsir.otpParameter, value: code }],
        })
        : sendSmsIrBulk({
          ...smsIrBaseInput(config, toPhone),
          lineNumber: config.smsir.lineNumber,
          text,
        }),
    });
  }

  return settleParallelSmsAttempts(attempts);
}

export async function sendSms(
  toPhone: string,
  text: string,
  templates: SmsTemplates = {},
): Promise<{ ok: boolean; error?: string }> {
  const config = await getSmsRuntimeConfig();
  let result = await sendPrimarySms(config, toPhone, text, templates.melipayamak);
  if (result.ok) return { ok: true };

  const errors = [result.error ?? 'ارسال از سرویس اصلی ناموفق بود'];
  if (!result.fallbackSafe) return { ok: false, error: errors.join('؛ ') };

  if (config.firstFallback === 'melipayamak' && config.smsProvider !== 'melipayamak') {
    result = templates.melipayamak
      ? await sendMelipayamakPatternSms(melipayamakPatternInput(config, toPhone, templates.melipayamak))
      : await sendMelipayamakSms(melipayamakInput(config, toPhone, text));
    if (result.ok) return { ok: true };
    errors.push(`سرویس جایگزین اول: ${result.error ?? 'ناموفق بود'}`);
    if (!result.fallbackSafe) return { ok: false, error: errors.join('؛ ') };
  }

  if (config.secondFallback === 'smsir') {
    result = templates.smsir
      ? await sendSmsIrVerify({ ...smsIrBaseInput(config, toPhone), ...templates.smsir })
      : await sendSmsIrBulk({
        ...smsIrBaseInput(config, toPhone),
        lineNumber: config.smsir.lineNumber,
        text,
      });
    if (result.ok) return { ok: true };
    errors.push(`سرویس جایگزین دوم: ${result.error ?? 'ناموفق بود'}`);
  }

  return { ok: false, error: errors.join('؛ ') };
}

export async function testSmsProvider(
  provider: 'rastin' | 'payamresan' | 'melipayamak' | 'melipayamak-otp' | 'smsir' | 'chain' | 'chain-otp',
  toPhone: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (provider === 'chain') return sendSms(toPhone, text);
  const config = await getSmsRuntimeConfig();
  if (provider === 'chain-otp') {
    const templates: SmsTemplates = {
      melipayamak: { bodyId: config.melipayamak.otpBodyId, values: [text] },
    };
    if (config.smsir.otpTemplateId) {
      templates.smsir = {
        templateId: config.smsir.otpTemplateId,
        parameters: [{ name: config.smsir.otpParameter, value: text }],
      };
    }
    return sendSms(toPhone, `کد تایید شما در تماس مارکت: ${text}`, templates);
  }
  if (provider === 'melipayamak-otp') {
    return sendMelipayamakPatternSms(melipayamakPatternInput(config, toPhone, {
      bodyId: config.melipayamak.otpBodyId,
      values: ['12345'],
    }));
  }
  if (provider === 'smsir') {
    return sendSmsIrBulk({
      ...smsIrBaseInput(config, toPhone),
      lineNumber: config.smsir.lineNumber,
      text,
    });
  }
  return sendPrimarySms({ ...config, smsProvider: provider }, toPhone, text);
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

  const smsConfig = await getSmsRuntimeConfig();
  const isOtp = templateKey === 'sms_template_otp';
  const templates: SmsTemplates = {};
  if (isOtp && smsConfig.melipayamak.otpBodyId) {
    templates.melipayamak = {
      bodyId: smsConfig.melipayamak.otpBodyId,
      values: [variables.code ?? text],
    };
  }
  if (isOtp && smsConfig.smsir.otpTemplateId) {
    templates.smsir = {
      templateId: smsConfig.smsir.otpTemplateId,
      parameters: [{
        name: smsConfig.smsir.otpParameter,
        value: variables.code ?? text,
      }],
    };
  }

  return sendSms(toPhone, text, templates);
}

export function sendUserApprovedSms(toPhone: string): Promise<{ ok: boolean; error?: string }> {
  return sendTemplatedSms(
    toPhone,
    'sms_template_user_approved',
    {},
    'حساب کاربری شما در تماس مارکت تایید شد',
  );
}
