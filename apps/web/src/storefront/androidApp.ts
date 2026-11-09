/** Public release information only. Never include signing keys or FCM credentials. */
export const ANDROID_APP = {
  version: '1.1.0',
  url: '/downloads/tamas-market-1.1.0.apk',
  filename: 'tamas-market-1.1.0.apk',
  bytes: 62_507_873,
  sha256: 'cf072301fd8f875caf2db77929fcd3fc5a404475137623bff59a47e826453f8f',
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

export function isAppleDevice(userAgent: string, platform = ''): boolean {
  // iPad's desktop mode identifies itself as a Mac. AppleWebKit alone is also
  // used by Android/Windows browsers and must not hide their download links.
  return /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(userAgent)
    || /^(Mac|iPhone|iPad|iPod)/i.test(platform);
}
