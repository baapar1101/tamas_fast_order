import { useState } from 'react';
import { Icon } from '../components/Icon';
import { ANDROID_APP, ANDROID_SUGGESTION_DELAY, ANDROID_SUGGESTION_KEY, isAndroidSuggestionDismissed } from './androidApp';
import './android-app-banner.css';

export function AndroidAppBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return isAndroidSuggestionDismissed(window.localStorage.getItem(ANDROID_SUGGESTION_KEY));
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(ANDROID_SUGGESTION_KEY, String(Date.now() + ANDROID_SUGGESTION_DELAY));
    } catch { /* Browsing and downloading must still work when browser storage is unavailable. */ }
  };

  const restore = () => {
    setDismissed(false);
    try {
      window.localStorage.removeItem(ANDROID_SUGGESTION_KEY);
    } catch { /* The in-memory preference is enough for this page. */ }
  };

  // The large desktop footer is hidden on mobile; keep a compact, permanent
  // download entry here instead of making the APK inaccessible after dismissal.
  if (dismissed) return (
    <aside className="android-app-shortcut" aria-label="دریافت اپلیکیشن اندروید">
      <a href={ANDROID_APP.url} download={ANDROID_APP.filename}><Icon name="mobile" /> دانلود اپلیکیشن اندروید</a>
      <button type="button" className="btn" onClick={restore}>نمایش راهنمای نصب</button>
    </aside>
  );

  return (
    <section className="android-app-banner" aria-labelledby="android-app-heading">
      <div className="android-app-banner__icon"><Icon name="mobile" /></div>
      <div className="android-app-banner__copy">
        <h2 id="android-app-heading">اپلیکیشن اندروید تماس مارکت</h2>
        <p>با همان حساب سایت، خرید کنید و سفارش‌ها و اقساطتان را پیگیری کنید.</p>
        <span className="android-app-banner__meta">
          نسخهٔ {ANDROID_APP.version.replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]!)} · فایل APK · حدود {Math.ceil(ANDROID_APP.bytes / 1_000_000).toLocaleString('fa-IR')} مگابایت
        </span>
      </div>
      <a className="btn primary android-app-banner__download" href={ANDROID_APP.url} download={ANDROID_APP.filename}>
        دانلود و نصب اندروید
      </a>
      <details className="android-app-banner__help">
        <summary>راهنمای نصب</summary>
        <p>مخصوص اندروید {ANDROID_APP.minimumAndroid.toLocaleString('fa-IR')} و بالاتر است. پس از دانلود، فایل APK را باز کنید و نصب را در پیام اندروید تأیید کنید. سپس با شمارهٔ موبایل حساب سایت وارد شوید. این فایل برای آیفون قابل نصب نیست.</p>
      </details>
      <button type="button" className="android-app-banner__dismiss" onClick={dismiss} aria-label="بستن پیشنهاد نصب اپلیکیشن برای هفت روز" title="فعلاً نمایش نده">×</button>
    </section>
  );
}
