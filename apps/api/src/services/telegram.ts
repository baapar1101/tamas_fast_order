import https from 'node:https';
import { timingSafeEqual } from 'node:crypto';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { generateSecret, getAllSettings, setSetting } from './settings.js';

export const TELEGRAM_EVENTS = [
  'order.created',
  'order.items_changed',
  'order.status_changed',
  'payment.paid',
  'payment.failed',
  'payment.info_submitted',
  'user.registered',
  'user.profile_updated',
  'user.status_changed',
  'credit.application_submitted',
  'credit.application_status_changed',
  'credit.cheque_submitted',
  'credit.cheque_status_changed',
] as const;

export type TelegramEvent = (typeof TELEGRAM_EVENTS)[number];

export interface TelegramGroup {
  id: string;
  name: string;
  chatId: string;
  enabled: boolean;
  messageThreadId?: number;
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  proxyUrl: string;
  groups: TelegramGroup[];
  routes: Partial<Record<TelegramEvent, string[]>>;
  operationsEnabled: boolean;
  allowedUserIds: string[];
  webhookSecret: string;
  webhookUrl: string;
}

export interface TelegramButton {
  text: string;
  callbackData?: string;
  url?: string;
}

export interface TelegramNotification {
  title: string;
  fields?: Array<{ label: string; value: unknown }>;
  text?: string;
  keyboard?: TelegramButton[][];
}

function parseBool(value: string | undefined): boolean {
  return value != null && !['', 'false', '0', 'no', 'off'].includes(value.toLowerCase());
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function envValue(key: string): string {
  return process.env[key]?.trim() ?? '';
}

export function parseTelegramUserIds(value: string | undefined): string[] {
  return [...new Set(String(value ?? '').split(/[\s,،;]+/).map((item) => item.trim()).filter((item) => /^\d{3,20}$/.test(item)))];
}

export async function getTelegramConfig(): Promise<TelegramConfig> {
  const settings = await getAllSettings();
  const groups = parseJson<TelegramGroup[]>(settings.TELEGRAM_GROUPS ?? envValue('TELEGRAM_GROUPS'), []);
  const routes = parseJson<Partial<Record<TelegramEvent, string[]>>>(
    settings.TELEGRAM_ROUTES ?? envValue('TELEGRAM_ROUTES'),
    {},
  );

  return {
    enabled: parseBool(settings.TELEGRAM_ENABLED ?? envValue('TELEGRAM_ENABLED')),
    botToken: (settings.private_TELEGRAM_BOT_TOKEN ?? settings.TELEGRAM_BOT_TOKEN ?? envValue('TELEGRAM_BOT_TOKEN')).trim(),
    proxyUrl: (settings.TELEGRAM_PROXY_URL ?? envValue('TELEGRAM_PROXY_URL')).trim(),
    groups: Array.isArray(groups)
      ? groups.filter((group) => group && group.id && group.chatId).map((group) => ({ ...group, enabled: group.enabled !== false }))
      : [],
    routes: routes && typeof routes === 'object' ? routes : {},
    operationsEnabled: parseBool(settings.TELEGRAM_OPERATIONS_ENABLED ?? envValue('TELEGRAM_OPERATIONS_ENABLED')),
    allowedUserIds: parseTelegramUserIds(settings.TELEGRAM_ALLOWED_USER_IDS ?? envValue('TELEGRAM_ALLOWED_USER_IDS')),
    webhookSecret: (settings.private_TELEGRAM_WEBHOOK_SECRET ?? envValue('TELEGRAM_WEBHOOK_SECRET')).trim(),
    webhookUrl: (settings.TELEGRAM_WEBHOOK_URL ?? envValue('TELEGRAM_WEBHOOK_URL')).trim(),
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function formatTelegramMessage(notification: TelegramNotification): string {
  const lines = [`<b>${escapeHtml(notification.title)}</b>`];
  if (notification.text) lines.push('', escapeHtml(notification.text));
  if (notification.fields?.length) {
    lines.push('');
    for (const field of notification.fields) {
      if (field.value === undefined || field.value === null || field.value === '') continue;
      lines.push(`<b>${escapeHtml(field.label)}:</b> ${escapeHtml(field.value)}`);
    }
  }
  return lines.join('\n').slice(0, 4096);
}

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
  result?: unknown;
}

export function callTelegramApi(
  token: string,
  method: string,
  body: Record<string, unknown>,
  proxyUrl = '',
): Promise<TelegramApiResponse> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    let agent: https.Agent | undefined;
    try {
      agent = proxyUrl ? (new SocksProxyAgent(proxyUrl) as unknown as https.Agent) : undefined;
    } catch (error) {
      reject(new Error(`Invalid Telegram SOCKS proxy: ${(error as Error).message}`));
      return;
    }

    const request = https.request(
      {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${token}/${method}`,
        method: 'POST',
        agent,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        },
        timeout: 12_000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          let parsed: TelegramApiResponse;
          try {
            parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as TelegramApiResponse;
          } catch {
            reject(new Error(`Telegram returned HTTP ${response.statusCode ?? 0}`));
            return;
          }
          if (!parsed.ok) reject(new Error(parsed.description || `Telegram returned HTTP ${response.statusCode ?? 0}`));
          else resolve(parsed);
        });
      },
    );
    request.on('timeout', () => request.destroy(new Error('Telegram request timed out')));
    request.on('error', reject);
    request.end(payload);
  });
}

async function sendToGroup(config: TelegramConfig, group: TelegramGroup, text: string): Promise<void> {
  await callTelegramApi(
    config.botToken,
    'sendMessage',
    {
      chat_id: group.chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(group.messageThreadId ? { message_thread_id: group.messageThreadId } : {}),
    },
    config.proxyUrl,
  );
}

function keyboardPayload(keyboard?: TelegramButton[][]): Record<string, unknown> {
  if (!keyboard?.length) return {};
  return {
    reply_markup: {
      inline_keyboard: keyboard.map((row) => row.map((button) => ({
        text: button.text,
        ...(button.callbackData ? { callback_data: button.callbackData } : {}),
        ...(button.url ? { url: button.url } : {}),
      }))),
    },
  };
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  keyboard?: TelegramButton[][],
  messageThreadId?: number,
): Promise<void> {
  const config = await getTelegramConfig();
  if (!config.enabled || !config.botToken) throw new Error('ربات تلگرام فعال و تنظیم نشده است.');
  await callTelegramApi(config.botToken, 'sendMessage', {
    chat_id: chatId,
    text: text.slice(0, 4096),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...keyboardPayload(keyboard),
    ...(messageThreadId ? { message_thread_id: messageThreadId } : {}),
  }, config.proxyUrl);
}

export async function answerTelegramCallback(callbackQueryId: string, text: string, showAlert = false): Promise<void> {
  const config = await getTelegramConfig();
  if (!config.botToken) return;
  await callTelegramApi(config.botToken, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text.slice(0, 200),
    show_alert: showAlert,
  }, config.proxyUrl);
}

export function telegramSecretMatches(expected: string, received: string | undefined): boolean {
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function configureTelegramWebhook(webhookUrl: string): Promise<{ enabled: boolean; url: string; pendingUpdates: number }> {
  let config = await getTelegramConfig();
  if (!config.botToken) throw new Error('توکن ربات تلگرام تنظیم نشده است.');
  if (!/^https:\/\//i.test(webhookUrl)) throw new Error('آدرس وب‌هوک باید با https:// شروع شود.');

  if (!config.webhookSecret) {
    await setSetting('private_TELEGRAM_WEBHOOK_SECRET', await generateSecret());
    config = await getTelegramConfig();
  }

  if (!config.operationsEnabled) {
    await callTelegramApi(config.botToken, 'deleteWebhook', { drop_pending_updates: false }, config.proxyUrl);
    return { enabled: false, url: '', pendingUpdates: 0 };
  }

  await callTelegramApi(config.botToken, 'setWebhook', {
    url: webhookUrl,
    secret_token: config.webhookSecret,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  }, config.proxyUrl);
  await callTelegramApi(config.botToken, 'setMyCommands', {
    commands: [
      { command: 'start', description: 'منوی مدیریت تماس مارکت' },
      { command: 'pending', description: 'مشتریان در انتظار تأیید' },
      { command: 'orders', description: 'آخرین سفارش‌ها' },
      { command: 'id', description: 'نمایش شناسه تلگرام من' },
    ],
  }, config.proxyUrl);
  await setSetting('TELEGRAM_WEBHOOK_URL', webhookUrl);
  const info = await callTelegramApi(config.botToken, 'getWebhookInfo', {}, config.proxyUrl);
  const result = (info.result ?? {}) as { url?: string; pending_update_count?: number };
  return { enabled: true, url: result.url ?? webhookUrl, pendingUpdates: Number(result.pending_update_count ?? 0) };
}

/** Send one event to every enabled group assigned to it. A failed group never blocks the others. */
export async function sendTelegramNotification(
  event: TelegramEvent,
  notification: TelegramNotification,
): Promise<{ sent: number; errors: string[] }> {
  const config = await getTelegramConfig();
  if (!config.enabled || !config.botToken) return { sent: 0, errors: [] };

  const targetIds = new Set(config.routes[event] ?? []);
  const targets = config.groups.filter((group) => group.enabled && targetIds.has(group.id));
  if (targets.length === 0) return { sent: 0, errors: [] };

  const text = formatTelegramMessage(notification);
  const results = await Promise.allSettled(targets.map((group) => callTelegramApi(
    config.botToken,
    'sendMessage',
    {
      chat_id: group.chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...keyboardPayload(config.operationsEnabled ? notification.keyboard : undefined),
      ...(group.messageThreadId ? { message_thread_id: group.messageThreadId } : {}),
    },
    config.proxyUrl,
  ).then(() => undefined)));
  const errors: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected') errors.push(`${targets[index]!.name}: ${String(result.reason?.message ?? result.reason)}`);
  });
  if (errors.length > 0) console.warn(`[Telegram] ${event}: ${errors.join('; ')}`);
  return { sent: results.length - errors.length, errors };
}

export async function testTelegramGroup(groupId: string): Promise<{ botName: string; groupName: string }> {
  const config = await getTelegramConfig();
  if (!config.botToken) throw new Error('توکن ربات تلگرام تنظیم نشده است.');
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(config.botToken)) throw new Error('فرمت توکن ربات معتبر نیست.');
  const group = config.groups.find((item) => item.id === groupId);
  if (!group) throw new Error('گروه تلگرام پیدا نشد.');

  const me = await callTelegramApi(config.botToken, 'getMe', {}, config.proxyUrl);
  await sendToGroup(config, group, formatTelegramMessage({ title: 'پیام آزمایشی تماس مارکت', text: 'اتصال ربات با موفقیت برقرار شد.' }));
  const result = (me.result ?? {}) as { username?: string; first_name?: string };
  return { botName: result.username ? `@${result.username}` : result.first_name ?? 'Telegram Bot', groupName: group.name };
}
