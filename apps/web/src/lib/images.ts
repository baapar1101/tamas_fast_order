import type { SyntheticEvent } from 'react';

export function resolveImageUrl(value: string | null | undefined, fallback = '/logo.png'): string {
  const clean = String(value ?? '').trim();
  if (!clean) return fallback;
  if (clean.startsWith('data:') || clean.startsWith('/') || /^https?:\/\//i.test(clean)) return clean;
  return `/uploads/${clean.replace(/^\/+/, '')}`;
}

export function useImageFallback(event: SyntheticEvent<HTMLImageElement>, fallback = '/logo.png'): void {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === '1') return;
  image.dataset.fallbackApplied = '1';
  image.removeAttribute('crossorigin');
  image.src = fallback;
}

export async function waitForImages(container: HTMLElement | null, timeoutMs = 20_000): Promise<void> {
  if (!container) return;
  const images = Array.from(container.querySelectorAll('img'));
  const pending = images.map(async (image) => {
    if (image.complete) return;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      image.addEventListener('load', done, { once: true });
      image.addEventListener('error', done, { once: true });
    });
  });
  await Promise.race([
    Promise.all(pending).then(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

