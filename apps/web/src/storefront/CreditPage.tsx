import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../store/auth';
import { AuthDialog } from './AuthDialog';
import { CreditDashboard } from './CreditDashboard';
import { StoreFooter } from './StoreFooter';
import './storefront.css';
import './credit-page.css';

export function CreditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, ready } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const savedReturn = (location.state as { returnTo?: unknown } | null)?.returnTo;
  const returnTo = typeof savedReturn === 'string' && savedReturn.startsWith('/') && !savedReturn.startsWith('//')
    ? savedReturn
    : '/';

  return (
    <div className="shell credit-shell">
      <header className="topbar">
        <div className="topbar-inner credit-topbar-inner">
          <Link to={returnTo} className="credit-back" aria-label="بازگشت به فروشگاه"><Icon name="chevron" style={{ transform: 'rotate(-90deg)' }} /></Link>
          <Link to="/" className="logo">
            <img src="/logo.png" alt="تماس مارکت" />
            <span className="logo-tagline">مرجع تخصصی فروش عمده کالای دیجیتال</span>
          </Link>
          <span className="spacer" />
          <Link to={returnTo} className="btn credit-back-label">بازگشت به فروشگاه</Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="credit-page">
        <div className="credit-page-heading">
          <span>خدمات مالی همکاران</span>
          <h1>💳 پنل خریداران اعتباری تماس مارکت</h1>
          <p>وضعیت اعتبار، چک‌ها، سررسیدها و مدارک پروندهٔ خود را در همین صفحه مدیریت کنید.</p>
        </div>

        {!ready ? (
          <div className="card credit-page-state">در حال بررسی حساب کاربری…</div>
        ) : !user ? (
          <div className="card credit-page-state">
            <Icon name="user" />
            <h2>برای مشاهدهٔ پروندهٔ اعتباری وارد شوید</h2>
            <p>پس از ورود، اطلاعات پرونده در همین صفحه نمایش داده می‌شود.</p>
            <button type="button" className="btn primary" onClick={() => setAuthOpen(true)}>ورود / ثبت‌نام</button>
          </div>
        ) : (
          <CreditDashboard onBack={() => navigate(returnTo)} />
        )}
      </main>

      <StoreFooter />
      <AuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onReady={() => setAuthOpen(false)}
      />
    </div>
  );
}
