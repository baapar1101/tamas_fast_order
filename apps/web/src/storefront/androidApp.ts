/** Public release information only. Never include signing keys or FCM credentials. */
export const ANDROID_APP = {
  version: '1.0.2',
  url: '/downloads/tamas-market-1.0.2.apk',
  filename: 'tamas-market-1.0.2.apk',
  bytes: 61_966_872,
  sha256: 'cc3a64a9a31badb1662087e658b9594f1d059871462244bd85bf27b8b0904e80',
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
