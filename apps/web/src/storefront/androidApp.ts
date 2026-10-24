/** Public release information only. Never include signing keys or FCM credentials. */
export const ANDROID_APP = {
  version: '1.0.0',
  url: '/downloads/tamas-market-1.0.0.apk',
  filename: 'tamas-market-1.0.0.apk',
  bytes: 61_958_708,
  sha256: 'afedefa84410bcca200315110460b5d782eee0f5f9cf5faae4c4c6bd5b19caad',
  minimumAndroid: 7,
} as const;

export const ANDROID_SUGGESTION_KEY = `tamas.android-install.${ANDROID_APP.version}.dismissed-until`;
export const ANDROID_SUGGESTION_DELAY = 7 * 24 * 60 * 60 * 1000;

export function isAndroidSuggestionDismissed(value: string | null, now = Date.now()): boolean {
  const until = Number(value);
  return Number.isFinite(until) && until > now && until <= now + ANDROID_SUGGESTION_DELAY;
}

export function isAndroidBrowser(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}
