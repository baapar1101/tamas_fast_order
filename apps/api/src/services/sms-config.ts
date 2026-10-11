import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../env.js';
import { getAllSettings, setSetting } from './settings.js';

export type SmsPrimaryProvider = 'rastin' | 'payamresan' | 'melipayamak';
export type SmsFirstFallback = 'none' | 'melipayamak';
export type SmsSecondFallback = 'none' | 'smsir';

export interface SmsRuntimeConfig {
  smsProvider: SmsPrimaryProvider;
  firstFallback: SmsFirstFallback;
  secondFallback: SmsSecondFallback;
  rastin: { username: string; password: string; sender: string; url: string };
  payamresan: { apiKey: string; sender: string; baseUrl: string };
  melipayamak: { username: string; apiKey: string; sender: string; baseUrl: string };
  smsir: { apiKey: string; lineNumber: string; baseUrl: string; otpTemplateId: string; otpParameter: string };
}

export interface SmsConfigUpdate {
  smsProvider?: SmsPrimaryProvider;
  firstFallback?: SmsFirstFallback;
  secondFallback?: SmsSecondFallback;
  rastinUsername?: string;
  rastinPassword?: string;
  rastinSender?: string;
  rastinUrl?: string;
  payamresanApiKey?: string;
  payamresanSender?: string;
  payamresanBaseUrl?: string;
  melipayamakUsername?: string;
  melipayamakApiKey?: string;
  melipayamakSender?: string;
  melipayamakBaseUrl?: string;
  smsirApiKey?: string;
  smsirLineNumber?: string;
  smsirBaseUrl?: string;
  smsirOtpTemplateId?: string;
  smsirOtpParameter?: string;
}

const PREFIX = 'sms_config_';
const PRIVATE_PREFIX = `private_${PREFIX}`;

function encryptionKey(): Buffer {
  return createHash('sha256').update(`${env.APP_SECRET}:sms-config:v1`).digest();
}

export function encryptSmsSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptSmsSecret(value: string): string {
  if (!value.startsWith('enc:v1:')) return '';
  try {
    const [, , ivText, tagText, ciphertextText] = value.split(':');
    if (!ivText || !tagText || ciphertextText == null) return '';
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return '';
  }
}

function value(settings: Record<string, string>, key: string, fallback: string): string {
  return settings[`${PREFIX}${key}`]?.trim() || fallback.trim();
}

function secret(settings: Record<string, string>, key: string, fallback: string): string {
  const stored = settings[`${PRIVATE_PREFIX}${key}`];
  return stored ? decryptSmsSecret(stored) : fallback.trim();
}

export async function getSmsRuntimeConfig(): Promise<SmsRuntimeConfig> {
  const settings = await getAllSettings();
  return {
    smsProvider: value(settings, 'provider', env.SMS_PROVIDER) as SmsPrimaryProvider,
    firstFallback: value(settings, 'first_fallback', env.SMS_FALLBACK_PROVIDER) as SmsFirstFallback,
    secondFallback: value(settings, 'second_fallback', env.SMS_SECOND_FALLBACK_PROVIDER) as SmsSecondFallback,
    rastin: {
      username: value(settings, 'rastin_username', env.RASTIN_SMS_USERNAME),
      password: secret(settings, 'rastin_password', env.RASTIN_SMS_PASSWORD),
      sender: value(settings, 'rastin_sender', env.RASTIN_SMS_FROM),
      url: value(settings, 'rastin_url', env.RASTIN_SMS_URL),
    },
    payamresan: {
      apiKey: secret(settings, 'payamresan_api_key', env.PAYAMRESAN_API_KEY),
      sender: value(settings, 'payamresan_sender', env.PAYAMRESAN_SENDER),
      baseUrl: value(settings, 'payamresan_base_url', env.PAYAMRESAN_BASE_URL),
    },
    melipayamak: {
      username: value(settings, 'melipayamak_username', env.MELIPAYAMAK_USERNAME),
      apiKey: secret(settings, 'melipayamak_api_key', env.MELIPAYAMAK_API_KEY),
      sender: value(settings, 'melipayamak_sender', env.MELIPAYAMAK_FROM),
      baseUrl: value(settings, 'melipayamak_base_url', env.MELIPAYAMAK_BASE_URL),
    },
    smsir: {
      apiKey: secret(settings, 'smsir_api_key', env.SMSIR_API_KEY),
      lineNumber: value(settings, 'smsir_line_number', env.SMSIR_LINE_NUMBER),
      baseUrl: value(settings, 'smsir_base_url', env.SMSIR_BASE_URL),
      otpTemplateId: value(settings, 'smsir_otp_template_id', env.SMSIR_OTP_TEMPLATE_ID),
      otpParameter: value(settings, 'smsir_otp_parameter', env.SMSIR_OTP_PARAMETER),
    },
  };
}

const NORMAL_FIELDS: Array<[keyof SmsConfigUpdate, string]> = [
  ['smsProvider', 'provider'],
  ['firstFallback', 'first_fallback'],
  ['secondFallback', 'second_fallback'],
  ['rastinUsername', 'rastin_username'],
  ['rastinSender', 'rastin_sender'],
  ['rastinUrl', 'rastin_url'],
  ['payamresanSender', 'payamresan_sender'],
  ['payamresanBaseUrl', 'payamresan_base_url'],
  ['melipayamakUsername', 'melipayamak_username'],
  ['melipayamakSender', 'melipayamak_sender'],
  ['melipayamakBaseUrl', 'melipayamak_base_url'],
  ['smsirLineNumber', 'smsir_line_number'],
  ['smsirBaseUrl', 'smsir_base_url'],
  ['smsirOtpTemplateId', 'smsir_otp_template_id'],
  ['smsirOtpParameter', 'smsir_otp_parameter'],
];

const SECRET_FIELDS: Array<[keyof SmsConfigUpdate, string]> = [
  ['rastinPassword', 'rastin_password'],
  ['payamresanApiKey', 'payamresan_api_key'],
  ['melipayamakApiKey', 'melipayamak_api_key'],
  ['smsirApiKey', 'smsir_api_key'],
];

export async function updateSmsRuntimeConfig(input: SmsConfigUpdate): Promise<void> {
  for (const [field, key] of NORMAL_FIELDS) {
    const next = input[field];
    if (typeof next === 'string') await setSetting(`${PREFIX}${key}`, next.trim());
  }
  for (const [field, key] of SECRET_FIELDS) {
    const next = input[field];
    // Empty secret inputs intentionally preserve the current secret.
    if (typeof next === 'string' && next.trim()) {
      await setSetting(`${PRIVATE_PREFIX}${key}`, encryptSmsSecret(next.trim()));
    }
  }
}

export function smsConfigForAdmin(config: SmsRuntimeConfig) {
  return {
    smsProvider: config.smsProvider,
    firstFallback: config.firstFallback,
    secondFallback: config.secondFallback,
    rastinUsername: config.rastin.username,
    rastinPasswordSet: Boolean(config.rastin.password),
    rastinSender: config.rastin.sender,
    rastinUrl: config.rastin.url,
    payamresanApiKeySet: Boolean(config.payamresan.apiKey),
    payamresanSender: config.payamresan.sender,
    payamresanBaseUrl: config.payamresan.baseUrl,
    melipayamakUsername: config.melipayamak.username,
    melipayamakApiKeySet: Boolean(config.melipayamak.apiKey),
    melipayamakSender: config.melipayamak.sender,
    melipayamakBaseUrl: config.melipayamak.baseUrl,
    smsirApiKeySet: Boolean(config.smsir.apiKey),
    smsirLineNumber: config.smsir.lineNumber,
    smsirBaseUrl: config.smsir.baseUrl,
    smsirOtpTemplateId: config.smsir.otpTemplateId,
    smsirOtpParameter: config.smsir.otpParameter,
  };
}
