import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';
import { useToast } from '../components/Toast';
import { useAuth } from '../store/auth';
import { AuthDialog } from './AuthDialog';
import { StoreFooter } from './StoreFooter';
import './storefront.css';
import './account-page.css';

export interface AccountOutletContext {
  returnTo: string;
}

export function AccountLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, ready, isAdmin, logout } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const savedReturn = (location.state as { returnTo?: unknown } | null)?.returnTo;
  const returnTo = typeof savedReturn === 'string' && savedReturn.startsWith('/') && !savedReturn.startsWith('//')
    ? savedReturn
    : '/';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const signOut = async () => {
    await logout();
    toast.ok('از حساب خود خارج شدید.');
    navigate('/', { replace: true });
  };

  return (
    <div className="shell account-shell" dir="rtl">
      <header className="topbar">
        <div className="topbar-inner account-topbar-inner">
          <Link to={returnTo} className="account-header-back" aria-label="بازگشت به فروشگاه"><Icon name="home" /></Link>
          <Link to="/" className="logo">
            <img src="/logo.png" alt="تماس مارکت" />
            <span className="logo-tagline">مرجع تخصصی فروش عمده کالای دیجیتال</span>
          </Link>
          <span className="spacer" />
          <Link to={returnTo} className="btn account-header-shop">بازگشت به فروشگاه</Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="account-page">
        <div className="account-heading">
          <span>حساب کاربری تماس مارکت</span>
          <h1>حساب من</h1>
          <p>سفارش‌ها و خدمات مالی خود را در یک جا پیگیری کنید.</p>
        </div>

        {!ready ? (
          <div className="card account-state">در حال بررسی حساب کاربری…</div>
        ) : !user ? (
          <div className="card account-state">
            <Icon name="user" />
            <h2>برای مشاهدهٔ حساب خود وارد شوید</h2>
            <p>پس از ورود، سفارش‌ها و خدمات مالی در همین صفحه نمایش داده می‌شوند.</p>
            <button type="button" className="btn primary" onClick={() => setAuthOpen(true)}>ورود / ثبت‌نام</button>
          </div>
        ) : (
          <div className="account-grid">
            <aside className="account-sidebar">
              <div className="account-identity">
                <span className="account-avatar" aria-hidden="true">{user.name?.[0] || 'م'}</span>
                <div>
                  <strong>{`${user.name || 'حساب'} ${user.lastName || ''}`.trim()}</strong>
                  <small className="ltr-inline">{user.phone}</small>
                </div>
              </div>

              <nav className="account-nav" aria-label="بخش‌های حساب کاربری">
                <NavLink to="/account" end state={{ returnTo }} className={({ isActive }) => `account-nav-item${isActive ? ' active' : ''}`}>
                  <Icon name="bag" /> <span>سفارش‌های من</span>
                </NavLink>
                <NavLink to="/account/wallet" state={{ returnTo }} className={({ isActive }) => `account-nav-item${isActive ? ' active' : ''}`}>
                  <span className="account-nav-glyph" aria-hidden="true">◈</span> <span>کیف پول من</span>
                </NavLink>
                <NavLink to="/account/credit" state={{ returnTo }} className={({ isActive }) => `account-nav-item${isActive ? ' active' : ''}`}>
                  <span className="account-nav-glyph" aria-hidden="true">💳</span> <span>پرونده اعتباری</span>
                </NavLink>
                {isAdmin && (
                  <Link to="/admin" className="account-nav-item account-nav-admin">
                    <Icon name="grid" /> <span>پنل مدیریت</span>
                  </Link>
                )}
              </nav>

              <div className="account-sidebar-actions">
                <Link to={returnTo} className="account-nav-item"><Icon name="home" /> <span>بازگشت به فروشگاه</span></Link>
                <button type="button" className="account-nav-item account-nav-logout" onClick={() => void signOut()}>
                  <Icon name="chevron" style={{ transform: 'rotate(180deg)' }} /> <span>خروج از حساب</span>
                </button>
              </div>
            </aside>

            <div className="account-content">
              <Outlet context={{ returnTo } satisfies AccountOutletContext} />
            </div>
          </div>
        )}
      </main>

      <StoreFooter />
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onReady={() => setAuthOpen(false)} />
    </div>
  );
}
