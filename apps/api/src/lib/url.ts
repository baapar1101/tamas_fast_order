import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export function isPrivateAddress(address: string): boolean {
  const lower = address.toLowerCase();
  if (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  ) return true;

  const mappedV4 = lower.startsWith('::ffff:') ? address.slice(7) : address;
  if (isIP(mappedV4) !== 4) return false;
  const octets = mappedV4.split('.').map(Number);
  const a = octets[0] ?? 0;
  const b = octets[1] ?? 0;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export async function validatePublicTargetUrl(value: string): Promise<URL> {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('فقط لینک HTTP یا HTTPS مجاز است');
  if (url.username || url.password) throw new Error('لینک دارای نام کاربری یا رمز عبور مجاز نیست');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('آدرس داخلی مجاز نیست');
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('آدرس داخلی یا رزروشده مجاز نیست');
  }
  return url;
}
