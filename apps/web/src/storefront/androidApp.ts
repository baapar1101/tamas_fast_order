/** Public release information only. Never include signing keys or FCM credentials. */
export const ANDROID_APP = {
  version: '1.0.1',
  url: '/downloads/tamas-market-1.0.1.apk',
  filename: 'tamas-market-1.0.1.apk',
  bytes: 61_963_144,
  sha256: 'd383ae24b9755cb3e7ade0dd5f96a20fd1718606fc960a431d1d28bef4059da6',
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
