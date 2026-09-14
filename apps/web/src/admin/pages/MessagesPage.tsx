import { Link } from 'react-router-dom';

export function MessagesPage() {
  return (
    <div className="admin-page space-y-6">
      <section className="admin-page-header animate-fade-up">
        <div>
          <span className="chip chip-aqua">مرکز ارتباطات</span>
          <h2 className="mt-3 text-xl font-extrabold text-white sm:text-2xl">پیام‌ها و اعلان‌ها</h2>
          <p className="mt-1 text-xs text-slate-400">پیگیری اعلان‌های سیستمی و ارتباط با مشتریان</p>
        </div>
      </section>
      <section className="admin-feature-grid">
        <article className="glass-card p-6">
          <span className="stat-icon bg-cyan-500/15 text-cyan-400">✉</span>
          <h3 className="mt-5 font-bold text-white">صندوق پیام مشتریان</h3>
          <p className="mt-2 text-xs leading-7 text-slate-400">پیام‌های مشتریان پس از فعال‌سازی سرویس پیام‌رسان اینجا نمایش داده می‌شوند.</p>
        </article>
        <article className="glass-card p-6">
          <span className="stat-icon bg-amber-500/15 text-amber-400">●</span>
          <h3 className="mt-5 font-bold text-white">اعلان‌های مدیریتی</h3>
          <p className="mt-2 text-xs leading-7 text-slate-400">سفارش جدید، ثبت‌نام کاربر و خطاهای همگام‌سازی از هدر پنل قابل مشاهده‌اند.</p>
          <Link to="/admin/sync" className="huma-btn-secondary mt-5">مشاهده وضعیت همگام‌سازی</Link>
        </article>
      </section>
    </div>
  );
}
