import { Component, type ErrorInfo, type ReactNode } from 'react';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render failed', error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="ds-recovery" dir="rtl" role="alert">
        <section className="ds-surface">
          <h1>نمایش این صفحه با مشکل روبه‌رو شد</h1>
          <p>صفحه را دوباره بارگذاری کنید یا به فروشگاه برگردید.</p>
          <div className="ds-recovery__actions">
            <button type="button" className="ds-button ds-button--primary" onClick={() => window.location.reload()}>بارگذاری دوباره</button>
            <a className="ds-button" href="/">بازگشت به فروشگاه</a>
          </div>
        </section>
      </main>
    );
  }
}
