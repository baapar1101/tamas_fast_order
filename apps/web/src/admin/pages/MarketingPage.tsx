import { Link } from 'react-router-dom';

export function MarketingPage() {
  return (
    <div className="admin-page space-y-6">
      <section className="admin-page-header animate-fade-up">
        <div>
          <span className="chip chip-amber">ابزار رشد فروش</span>
          <h2 className="mt-3 text-xl font-extrabold text-white sm:text-2xl">بازاریابی و پیشنهادها</h2>
          <p className="mt-1 text-xs text-slate-400">مدیریت محصولات ویژه، تخفیف‌ها و محتوای تبلیغاتی</p>
        </div>
      </section>
      <section className="admin-feature-grid">
        <article className="glass-card p-6">
          <span className="stat-icon bg-emerald-500/15 text-emerald-400">٪</span>
          <h3 className="mt-5 font-bold text-white">محصولات ویژه</h3>
          <p className="mt-2 text-xs leading-7 text-slate-400">از صفحه محصولات، کالاها را به کمپین ویژه اضافه یا قیمت آن‌ها را گروهی ویرایش کنید.</p>
          <Link to="/admin/products" className="huma-btn-primary mt-5">مدیریت محصولات</Link>
        </article>
        <article className="glass-card p-6">
          <span className="stat-icon bg-rose-500/15 text-rose-400">▣</span>
          <h3 className="mt-5 font-bold text-white">بنرها و رسانه‌ها</h3>
          <p className="mt-2 text-xs leading-7 text-slate-400">تصاویر کمپین و فایل‌های تبلیغاتی را در کتابخانه رسانه بارگذاری و مدیریت کنید.</p>
          <Link to="/admin/uploads" className="huma-btn-secondary mt-5">کتابخانه رسانه</Link>
        </article>
      </section>
    </div>
  );
}
