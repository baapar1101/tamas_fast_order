import { Link } from 'react-router-dom';
import { SmsInboxPanel } from './SmsInboxPanel';

export function MessagesPage() {
  return (
    <div className="a-page a-page--messages a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">پیام‌ها و اعلان‌ها</h2>
          <p className="a-subtitle">پیامک‌هایی که مشتریان به خط پیام‌رسان فرستاده‌اند و اعلان‌های سیستمی</p>
        </div>
        <div className="a-page-actions">
          <Link to="/admin/sms" className="a-btn a-btn--secondary">ارسال پیامک به مشتریان</Link>
        </div>
      </section>

      <SmsInboxPanel />

      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">اعلان‌های مدیریتی</h3>
            <p className="a-card-desc">سفارش جدید، ثبت‌نام کاربر و خطاهای همگام‌سازی از هدر پنل قابل مشاهده‌اند.</p>
          </div>
          <Link to="/admin/sync" className="a-btn a-btn--secondary">مشاهده وضعیت همگام‌سازی</Link>
        </div>
      </section>
    </div>
  );
}
