import * as xlsx from '@e965/xlsx';
import type { PriceListDTO } from '@tamas/shared';
import { getPriceListsConfig, priceList } from './price-lists.js';
import { getTelegramConfig, sendTelegramDocument, sendTelegramMessage } from './telegram.js';

const TELEGRAM_TEXT_LIMIT = 3900;

function escapeHtml(value: unknown): string {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function tehranMoment(date = new Date()): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: 'Asia/Tehran', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
}

/**
 * One list as Telegram messages: a title line, then each brand with its rows
 * («گلکسی A55 مشکی — ۲۰٬۰۰۰٬۰۰۰»). Split on brand or row boundaries so every
 * message stays under Telegram's 4096-character limit.
 */
export function priceListMessages(list: PriceListDTO, now = new Date()): string[] {
  const header = `📋 <b>${escapeHtml(list.title)}</b>\n🕒 ${tehranMoment(now)} · قیمت‌ها به تومان`;
  const messages: string[] = [];
  let current = header;
  const push = (block: string) => {
    if (current.length + block.length + 2 > TELEGRAM_TEXT_LIMIT) {
      messages.push(current);
      current = `📋 <b>${escapeHtml(list.title)}</b> (ادامه)`;
    }
    current += `\n\n${block}`;
  };
  for (const group of list.groups) {
    const rows = group.rows
      .filter((row) => row.inStock && row.price != null)
      .map((row) => `▫️ ${escapeHtml(row.title)}${row.color ? ` ${escapeHtml(row.color)}` : ''} — <b>${row.price!.toLocaleString('fa-IR')}</b>`);
    if (!rows.length) continue;
    let block = `🔹 <b>${escapeHtml(group.brand)}</b>`;
    for (const row of rows) {
      if (block.length + row.length + 1 > TELEGRAM_TEXT_LIMIT - 200) {
        push(block);
        block = `🔹 <b>${escapeHtml(group.brand)}</b> (ادامه)`;
      }
      block += `\n${row}`;
    }
    push(block);
  }
  // `current` is still the bare header only when no brand had a row to show.
  messages.push(current === header ? `${header}\n\nفعلاً کالای موجودی در این لیست نیست.` : current);
  return messages;
}

export function priceListWorkbook(list: PriceListDTO): Buffer {
  const rows: unknown[][] = [['برند', 'کالا', 'رنگ', 'قیمت (تومان)', 'وضعیت']];
  for (const group of list.groups) {
    for (const row of group.rows) rows.push([group.brand, row.title, row.color ?? '', row.price ?? '', row.inStock ? 'موجود' : 'ناموجود']);
  }
  const sheet = xlsx.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 14 }, { wch: 48 }, { wch: 14 }, { wch: 16 }, { wch: 10 }];
  const book = xlsx.utils.book_new();
  book.Workbook = { Views: [{ RTL: true }] };
  xlsx.utils.book_append_sheet(book, sheet, 'قیمت');
  return Buffer.from(xlsx.write(book, { type: 'buffer', bookType: 'xlsx' }));
}

/** Every published list, with prices (the target chat is chosen by an admin). */
async function publishedLists(): Promise<PriceListDTO[]> {
  const config = await getPriceListsConfig();
  const lists = await Promise.all(config.lists.filter((list) => list.enabled).map((list) => priceList(list.id, { showPrices: true })));
  return lists.filter((list): list is PriceListDTO => Boolean(list));
}

/** Sends the current price lists (text and an Excel file each) to one chat. */
export async function sendPriceListsToChat(chatId: string | number, threadId?: number): Promise<number> {
  const lists = await publishedLists();
  if (!lists.length) {
    await sendTelegramMessage(chatId, 'هیچ لیست قیمتی منتشر نشده است. در پنل ← «لیست‌های قیمت» یک لیست را فعال کنید.', undefined, threadId);
    return 0;
  }
  for (const list of lists) {
    for (const text of priceListMessages(list)) await sendTelegramMessage(chatId, text, undefined, threadId);
    await sendTelegramDocument(chatId, {
      buffer: priceListWorkbook(list),
      fileName: `${list.title}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }, `📎 ${escapeHtml(list.title)} (اکسل)`, threadId);
  }
  return lists.length;
}

/** Publishes to the group chosen under «لیست‌های قیمت». */
export async function publishPriceListsToGroup(): Promise<{ groupName: string; lists: number }> {
  const [config, telegram] = await Promise.all([getPriceListsConfig(), getTelegramConfig()]);
  const group = telegram.groups.find((item) => item.id === config.telegram.groupId && item.enabled);
  if (!group) throw new Error('گروه تلگرام لیست قیمت انتخاب نشده یا غیرفعال است.');
  const lists = await sendPriceListsToChat(group.chatId, group.messageThreadId);
  return { groupName: group.name, lists };
}

// Several updates in a row (two files, a fix right after) publish once.
const AUTO_PUBLISH_DELAY_MS = 60_000;
let autoPublishTimer: NodeJS.Timeout | null = null;

/** After a price update: publish again a minute later, if the admin turned that on. */
export function schedulePriceListAutoPublish(): void {
  if (autoPublishTimer) clearTimeout(autoPublishTimer);
  autoPublishTimer = setTimeout(() => {
    autoPublishTimer = null;
    void (async () => {
      const config = await getPriceListsConfig();
      if (!config.telegram.autoPublish || !config.telegram.groupId) return;
      await publishPriceListsToGroup();
    })().catch((error) => console.warn('[price lists] Telegram auto-publish failed:', error instanceof Error ? error.message : error));
  }, AUTO_PUBLISH_DELAY_MS);
  autoPublishTimer.unref();
}
