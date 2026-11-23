import { randomBytes } from 'node:crypto';
import { logAction } from './audit.js';
import { schedulePriceListAutoPublish } from './price-list-telegram.js';
import { processExcelUpload, type ExcelSyncReport } from './sheets/excel-sync.js';
import { downloadTelegramFile, sendTelegramMessage, type TelegramButton } from './telegram.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PENDING_TTL_MS = 30 * 60 * 1000;
const PREVIEW_ROWS = 15;
const ERROR_ROWS = 8;

export interface TelegramDocument {
  file_id: string;
  file_name?: string;
  file_size?: number;
}

interface Actor {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

/** Previews waiting for Apply, kept in memory: a restart simply asks for the file again. */
const pending = new Map<string, { buffer: Buffer; fileName: string; planHash: string; actorId: number; createdAt: number }>();

function escapeHtml(value: unknown): string {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function actorLabel(user: Actor): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return name || (user.username ? `@${user.username}` : String(user.id));
}

function n(value: number): string {
  return value.toLocaleString('fa-IR');
}

function prune(now = Date.now()): void {
  for (const [id, item] of pending) if (now - item.createdAt > PENDING_TTL_MS) pending.delete(id);
}

export function isPriceUpdateFile(document: TelegramDocument | undefined): boolean {
  return Boolean(document?.file_name && /\.(xlsx|xls)$/i.test(document.file_name));
}

/** The preview text: counts, the first changes (suspicious first) and the first errors. */
export function previewText(fileName: string, report: ExcelSyncReport): string {
  const changes = report.rows.filter((row) => row.status === 'updated');
  const unchanged = report.rows.filter((row) => row.status === 'unchanged').length;
  const errors = report.rows.filter((row) => row.status === 'error');
  const ordered = [...changes.filter((row) => row.warning), ...changes.filter((row) => !row.warning)];
  const lines = [
    `📄 <b>پیش‌نمایش «${escapeHtml(fileName)}»</b> — هنوز چیزی تغییر نکرده است.`,
    `✏️ تغییر: <b>${n(changes.length)}</b> · ➖ بدون تغییر: ${n(unchanged)} · ❌ خطا: ${n(errors.length)}${report.warnings ? ` · ⚠️ مشکوک: <b>${n(report.warnings)}</b>` : ''}`,
  ];
  if (ordered.length) {
    lines.push('');
    for (const row of ordered.slice(0, PREVIEW_ROWS)) {
      const parts: string[] = [];
      if (row.old && row.next && row.old.price !== row.next.price) parts.push(`قیمت ${n(row.old.price)} ← <b>${n(row.next.price)}</b>`);
      if (row.old && row.next && row.old.stock !== row.next.stock) parts.push(`موجودی ${n(row.old.stock)} ← ${n(row.next.stock)}`);
      if (row.old && row.next && row.next.campaignPoints !== undefined && row.old.campaignPoints !== row.next.campaignPoints) {
        parts.push(`امتیاز ${n(row.old.campaignPoints ?? 0)} ← ${n(row.next.campaignPoints)}`);
      }
      lines.push(`${row.warning ? '⚠️' : '•'} ${escapeHtml(row.title ?? row.sku)}: ${parts.join('، ')}${row.warning ? `\n   <i>${escapeHtml(row.warning)}</i>` : ''}`);
    }
    if (ordered.length > PREVIEW_ROWS) lines.push(`… و ${n(ordered.length - PREVIEW_ROWS)} تغییر دیگر`);
  }
  if (errors.length) {
    lines.push('', '<b>خطاها:</b>');
    for (const row of errors.slice(0, ERROR_ROWS)) lines.push(`ردیف ${n(row.rowNumber)}: ${escapeHtml(row.message)}`);
    if (errors.length > ERROR_ROWS) lines.push(`… و ${n(errors.length - ERROR_ROWS)} خطای دیگر`);
  }
  return lines.join('\n');
}

/** A price/stock Excel sent to the bot: preview it and offer Apply / Cancel. */
export async function handlePriceUpdateDocument(
  chatId: number,
  threadId: number | undefined,
  document: TelegramDocument,
  actor: Actor,
): Promise<void> {
  prune();
  if ((document.file_size ?? 0) > MAX_FILE_BYTES) throw new Error('حجم فایل اکسل بیشتر از ۱۰ مگابایت است.');
  const fileName = document.file_name ?? 'prices.xlsx';
  await sendTelegramMessage(chatId, `⏳ در حال بررسی «${escapeHtml(fileName)}»…`, undefined, threadId);
  const buffer = await downloadTelegramFile(document.file_id, MAX_FILE_BYTES);
  const report = await processExcelUpload(buffer, { dryRun: true });
  const updates = report.rows.filter((row) => row.status === 'updated').length;
  const keyboard: TelegramButton[][] = [];
  if (updates && report.planHash) {
    const id = randomBytes(6).toString('hex');
    pending.set(id, { buffer, fileName, planHash: report.planHash, actorId: actor.id, createdAt: Date.now() });
    keyboard.push([
      { text: `✅ اعمال ${n(updates)} تغییر`, callbackData: `tp1|apply|${id}` },
      { text: '❌ انصراف', callbackData: `tp1|cancel|${id}` },
    ]);
  }
  await sendTelegramMessage(chatId, previewText(fileName, report), keyboard, threadId);
}

export function isPriceUpdateCallback(data: string | undefined): boolean {
  return Boolean(data?.startsWith('tp1|'));
}

export async function handlePriceUpdateCallback(
  chatId: number,
  threadId: number | undefined,
  data: string,
  actor: Actor,
): Promise<void> {
  prune();
  const [, action, id] = data.split('|');
  const item = id ? pending.get(id) : undefined;
  if (!item) throw new Error('این پیش‌نمایش منقضی شده یا قبلاً استفاده شده است. فایل را دوباره بفرستید.');
  pending.delete(id!);
  if (action === 'cancel') {
    await sendTelegramMessage(chatId, `🚫 «${escapeHtml(item.fileName)}» اعمال نشد.`, undefined, threadId);
    return;
  }
  if (action !== 'apply') throw new Error('عملیات شناخته نشد.');
  const report = await processExcelUpload(item.buffer, { expectedPlanHash: item.planHash });
  await logAction(null, 'sync:excel-telegram', 'sheets', null, {
    telegramUser: `${actorLabel(actor)} (${actor.id})`,
    file: item.fileName,
    updated: report.updated,
    skipped: report.skipped,
  });
  schedulePriceListAutoPublish();
  const notes = report.errors.filter((error) => !error.startsWith('ردیف')).slice(0, 5);
  await sendTelegramMessage(
    chatId,
    `✅ <b>${n(report.updated)}</b> کالا از «${escapeHtml(item.fileName)}» به‌روز شد (توسط ${escapeHtml(actorLabel(actor))}).${notes.length ? `\n\n${notes.map(escapeHtml).join('\n')}` : ''}`,
    undefined,
    threadId,
  );
}
