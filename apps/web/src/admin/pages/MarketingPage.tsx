import { Link } from 'react-router-dom';

export function MarketingPage() {
  return (
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">بازاریابی و پیشنهادها</h2>
          <p className="a-subtitle">مدیریت محصولات ویژه، تخفیف‌ها و محتوای تبلیغاتی</p>
        </div>
        <div className="a-page-actions">
          <span className="chip chip-amber">ابزار رشد فروش</span>
        </div>
      </section>
      <section className="a-feature-grid">
        <article className="a-card">
          <span className="a-feature-icon a-feature-icon--green">٪</span>
          <h3 className="mt-5 font-bold a-title-fallback">محصولات ویژه</h3>
          <p className="mt-2 text-xs leading-7 a-muted">از صفحه محصولات، کالاها را به کمپین ویژه اضافه یا قیمت آن‌ها را گروهی ویرایش کنید.</p>
          <Link to="/admin/products" className="a-btn a-btn--primary mt-5">مدیریت محصولات</Link>
        </article>
        <article className="a-card">
          <span className="a-feature-icon a-feature-icon--rose">▣</span>
          <h3 className="mt-5 font-bold a-title-fallback">بنرها و رسانه‌ها</h3>
          <p className="mt-2 text-xs leading-7 a-muted">تصاویر کمپین و فایل‌های تبلیغاتی را در کتابخانه رسانه بارگذاری و مدیریت کنید.</p>
          <Link to="/admin/uploads" className="a-btn a-btn--secondary mt-5">کتابخانه رسانه</Link>
        </article>
      </section>
    </div>
  );
}