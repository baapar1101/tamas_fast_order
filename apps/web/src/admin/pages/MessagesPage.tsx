import { Link } from 'react-router-dom';

export function MessagesPage() {
  return (
    <div className="a-page a-page--messages a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">پیام‌ها و اعلان‌ها</h2>
          <p className="a-subtitle">پیگیری اعلان‌های سیستمی و ارتباط با مشتریان</p>
        </div>
        <div className="a-page-actions">
          <span className="chip chip-aqua">مرکز ارتباطات</span>
        </div>
      </section>
      <section className="a-feature-grid">
        <article className="a-card">
          <span className="a-feature-icon a-feature-icon--green">✉</span>
          <h3 className="mt-5 font-bold a-title-fallback">صندوق پیام مشتریان</h3>
          <p className="mt-2 text-xs leading-7 a-muted">پیام‌های مشتریان پس از فعال‌سازی سرویس پیام‌رسان اینجا نمایش داده می‌شوند.</p>
        </article>
        <article className="a-card">
          <span className="a-feature-icon a-feature-icon--amber">●</span>
          <h3 className="mt-5 font-bold a-title-fallback">اعلان‌های مدیریتی</h3>
          <p className="mt-2 text-xs leading-7 a-muted">سفارش جدید، ثبت‌نام کاربر و خطاهای همگام‌سازی از هدر پنل قابل مشاهده‌اند.</p>
          <Link to="/admin/sync" className="a-btn a-btn--secondary mt-5">مشاهده وضعیت همگام‌سازی</Link>
        </article>
      </section>
    </div>
  );
}