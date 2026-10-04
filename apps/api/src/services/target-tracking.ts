import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export interface TargetSiteSnapshot {
  inStock: boolean;
  quantity: number;
  statusText: string;
  price: number | null;
  error: string | null;
}

function isPrivateAddress(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || /^fe[89ab]/.test(lower)) return true;
  const mappedV4 = lower.startsWith('::ffff:') ? address.slice(7) : address;
  if (isIP(mappedV4) !== 4) return false;
  const [a = 0, b = 0] = mappedV4.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

async function validatePublicUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('فقط لینک HTTP یا HTTPS مجاز است');
  if (url.username || url.password) throw new Error('لینک دارای نام کاربری یا رمز عبور مجاز نیست');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('آدرس داخلی مجاز نیست');
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('آدرس داخلی یا رزروشده مجاز نیست');
  return url;
}

async function fetchPublic(value: string): Promise<Response> {
  let url = await validatePublicUrl(value);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TamasTrackingBot/3.0)',
        Accept: 'text/html,application/xhtml+xml;q=0.9',
        'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.7',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) throw new Error('پاسخ تغییر مسیر معتبر نیست');
    url = await validatePublicUrl(new URL(location, url).toString());
  }
  throw new Error('تعداد تغییر مسیرهای سایت بیش از حد مجاز است');
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error('حجم پاسخ سایت بیش از حد مجاز است');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('حجم پاسخ سایت بیش از حد مجاز است');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

function extractPrice(html: string): number | null {
  const normalized = normalizeDigits(html);
  const patterns = [
    /(?:property=["']product:price:amount["'][^>]*content|itemprop=["']price["'][^>]*content)=["']([\d,._]+)["']/i,
    /(?:content=["']([\d,._]+)["'][^>]*(?:property=["']product:price:amount["']|itemprop=["']price["']))/i,
    /["']price["']\s*:\s*["']?([\d,._]+)/i,
    /([\d,._]{3,})\s*(?:تومان|ریال)/i,
  ];
  for (const pattern of patterns) {
    const raw = normalized.match(pattern)?.[1];
    if (!raw) continue;
    const value = Number(raw.replace(/[,._]/g, ''));
    if (Number.isSafeInteger(value) && value > 0) return value;
  }
  return null;
}

export async function fetchTargetSiteSnapshot(targetUrl: string): Promise<TargetSiteSnapshot> {
  try {
    const response = await fetchPublic(targetUrl);
    if (!response.ok) return { inStock: false, quantity: 0, price: null, error: `HTTP ${response.status}`, statusText: `خطای HTTP ${response.status}` };
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return { inStock: false, quantity: 0, price: null, error: 'پاسخ HTML نیست', statusText: 'پاسخ سایت HTML نیست' };
    }
    const html = await readLimitedText(response);
    const lower = html.toLowerCase();
    const price = extractPrice(html);
    const unavailable = ['ناموجود', 'عدم موجودی', 'موجودی نیست', 'out of stock', 'outofstock', 'اتمام موجودی'].some((text) => lower.includes(text));
    if (unavailable) return { inStock: false, quantity: 0, price, error: null, statusText: 'ناموجود' };
    const available = ['موجود در انبار', 'افزودن به سبد خرید', 'خرید آنلاین', 'in stock', 'instock'].some((text) => lower.includes(text));
    if (available) return { inStock: true, quantity: 10, price, error: null, statusText: 'موجود' };
    return { inStock: false, quantity: 0, price, error: null, statusText: 'وضعیت موجودی تشخیص داده نشد' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'پاسخی دریافت نشد';
    return { inStock: false, quantity: 0, price: null, error: message, statusText: `خطا: ${message}` };
  }
}
