const START_COMMAND = /^\/start(?:@\w+)?(?:\s+(.+))?$/i;
const LINK_TOKEN = /^[A-Za-z0-9_-]{12,128}$/;

export function parseCustomerTelegramLinkToken(text: string | undefined): string | null {
  if (!text) return null;
  const payload = START_COMMAND.exec(text.trim())?.[1]?.trim() ?? '';
  if (!payload.startsWith('link_')) return null;
  const token = payload.slice(5);
  return LINK_TOKEN.test(token) ? token : null;
}

export function telegramContactBelongsToSender(contactUserId: number | undefined, senderId: number): boolean {
  return Number.isSafeInteger(contactUserId) && contactUserId === senderId;
}

export function normalizeTelegramBotUsername(value: string | undefined): string {
  const input = String(value ?? '').trim();
  const fromUrl = /^https?:\/\/(?:www\.)?t\.me\/([A-Za-z0-9_]{5,64})(?:[/?#]|$)/i.exec(input)?.[1];
  const candidate = fromUrl ?? input.replace(/^@+/, '');
  return /^[A-Za-z0-9_]{5,64}$/.test(candidate) ? candidate : '';
}
