import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

const LEGACY_IMAGE_RE = /^img_[0-9a-f]{12}\.(?:avif|gif|jpe?g|png|webp)$/i;

export function legacyImageFilename(value: string): string | null {
  const clean = value.trim().split(/[?#]/, 1)[0] ?? '';
  const filename = clean.replace(/\\/g, '/').split('/').pop() ?? '';
  return LEGACY_IMAGE_RE.test(filename) ? filename : null;
}

export function legacyCacheStemForUrl(value: string): string {
  return `img_${createHash('md5').update(value.trim()).digest('hex').slice(0, 12)}`;
}

export function isRemoteImageUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

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

export function isStoredImageUrl(value: string, publicBase: string): boolean {
  const clean = value.trim();
  if (!clean || clean.startsWith('data:') || legacyImageFilename(clean)) return false;
  const base = publicBase.replace(/\/$/, '');
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return clean === base || clean.startsWith(`${base}/`);
  }
  return clean === base || clean.startsWith(`${base}/`);
}

export function normalizeStoredImageUrl(value: string, publicBase: string): string {
  const clean = value.trim().replace(/^\.\//, '');
  if (!clean || clean.startsWith('/') || clean.startsWith('data:') || isRemoteImageUrl(clean)) return clean;
  return `${publicBase.replace(/\/$/, '')}/${clean.replace(/^\/+/, '')}`;
}

