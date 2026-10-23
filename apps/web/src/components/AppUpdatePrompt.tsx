import { useEffect, useState } from 'react';
import { forceReloadLatestApp, subscribeAppUpdates } from '../lib/forceAppUpdate';

export function AppUpdatePrompt() {
  const [build, setBuild] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);
  useEffect(() => subscribeAppUpdates(setBuild), []);
  if (build === null || build === dismissed) return null;
  return <aside className="ds-update-prompt" role="status" aria-live="polite">
    <div><strong>نسخهٔ جدید آماده است</strong><p>برای حفظ اطلاعات فرم، ابتدا کارتان را ذخیره کنید؛ سپس به‌روزرسانی کنید.</p></div>
    <div className="ds-update-prompt__actions">
      <button className="ds-button ds-button--primary" type="button" onClick={() => void forceReloadLatestApp(build)}>به‌روزرسانی</button>
      <button className="ds-button" type="button" onClick={() => setDismissed(build)}>بعداً</button>
    </div>
  </aside>;
}
