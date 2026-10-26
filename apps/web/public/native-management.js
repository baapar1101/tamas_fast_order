// This entry is used only inside the app's management WebView. Android's
// incognito flag clears cookies/cache but does not clear Web Storage.
(async function () {
  const status = document.getElementById('status');
  if (!window.ReactNativeWebView) {
    status.textContent = 'این صفحه مخصوص پنل مدیریت داخل اپ است.';
    return;
  }
  try {
    const previous = localStorage.getItem('tamas_auth_token');
    localStorage.removeItem('tamas_auth_token');
    sessionStorage.clear();
    const response = await fetch('/api/auth/logout', {
      method: 'POST', credentials: 'same-origin',
      headers: previous ? { Authorization: `Bearer ${previous}` } : {},
    });
    if (!response.ok && response.status !== 401) throw new Error('session_reset_failed');
    window.location.replace('/admin');
  } catch {
    // Do not enter management with an uncertain previous browser session.
    status.textContent = 'آماده‌سازی ورود امن انجام نشد. به اپ برگردید و دوباره پنل مدیریت را باز کنید.';
  }
})();
