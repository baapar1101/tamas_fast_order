import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../store/auth';
import { useCart } from '../store/cart';
import { AuthDialog } from './AuthDialog';
import { CheckoutFlow } from './CheckoutFlow';
import { StoreFooter } from './StoreFooter';
import './storefront.css';
import './checkout-page.css';

export function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, ready, complete } = useAuth();
  const lines = useCart((state) => state.lines);
  const [profileOpen, setProfileOpen] = useState(false);
  // Keep the post-order instructions mounted after the successful order clears the cart.
  const [hasStarted, setHasStarted] = useState(lines.length > 0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    if (lines.length > 0) setHasStarted(true);
  }, [lines.length]);

  const savedReturn = (location.state as { returnTo?: unknown } | null)?.returnTo;
  const returnTo = typeof savedReturn === 'string' && savedReturn.startsWith('/') && !savedReturn.startsWith('//')
    ? savedReturn
    : '/#cart';

  return (
    <div className="shell checkout-shell">
      <header className="topbar">
        <div className="topbar-inner checkout-topbar-inner">
          <Link to={returnTo} className="checkout-back" aria-label="بازگشت به سبد خرید"><Icon name="chevron" style={{ transform: 'rotate(-90deg)' }} /></Link>
          <Link to="/" className="logo">
            <img src="/logo.png" alt="تماس مارکت" />
            <span className="logo-tagline">مرجع تخصصی فروش عمده کالای دیجیتال</span>
          </Link>
          <span className="spacer" />
          <Link to={returnTo} className="btn checkout-back-label">بازگشت به سبد خرید</Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="checkout-page">
        <div className="checkout-page-heading">
          <span className="checkout-page-step">مرحله نهایی خرید</span>
          <h1>تأیید و ثبت سفارش</h1>
          <p>نشانی تحویل، روش پرداخت و جزئیات سفارش را بررسی کنید.</p>
        </div>

        {!ready ? (
          <div className="card checkout-page-state">در حال بررسی حساب کاربری…</div>
        ) : !user ? (
          <div className="card checkout-page-state">
            <Icon name="user" />
            <h2>برای ادامه وارد شوید</h2>
            <p>سبد خرید شما حفظ می‌شود و پس از ورود می‌توانید سفارش را تکمیل کنید.</p>
            <button type="button" className="btn primary" onClick={() => setProfileOpen(true)}>ورود / ثبت‌نام</button>
          </div>
        ) : !user.isActive ? (
          <div className="card checkout-page-state">
            <Icon name="warn" />
            <h2>حساب همکاری در انتظار تأیید است</h2>
            <p>پس از تأیید حساب، امکان ثبت سفارش فعال می‌شود.</p>
            <Link to={returnTo} className="btn">بازگشت به فروشگاه</Link>
          </div>
        ) : !complete ? (
          <div className="card checkout-page-state">
            <Icon name="user" />
            <h2>اطلاعات حساب را کامل کنید</h2>
            <p>برای ثبت سفارش، اطلاعات ضروری پروفایل باید تکمیل شود.</p>
            <button type="button" className="btn primary" onClick={() => setProfileOpen(true)}>تکمیل حساب</button>
          </div>
        ) : !hasStarted ? (
          <div className="card checkout-page-state">
            <Icon name="bag" />
            <h2>سبد خرید شما خالی است</h2>
            <p>ابتدا کالاهای موردنظرتان را به سبد اضافه کنید.</p>
            <Link to={returnTo} className="btn primary">بازگشت به فروشگاه</Link>
          </div>
        ) : (
          <CheckoutFlow
            onCancel={() => navigate(returnTo)}
            onFinished={() => navigate('/account', { replace: true })}
            onNeedsProfile={() => setProfileOpen(true)}
          />
        )}
      </main>

      <StoreFooter />
      <AuthDialog
        open={profileOpen}
        initialStep={user ? 'profile' : 'phone'}
        onClose={() => setProfileOpen(false)}
        onReady={() => setProfileOpen(false)}
      />
    </div>
  );
}
