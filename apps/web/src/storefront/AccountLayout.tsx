import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatNumber, type OrderDTO } from '@tamas/shared';
import { Icon, type IconName } from '../components/Icon';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { cartCount, useCart } from '../store/cart';
import { AuthDialog } from './AuthDialog';
import { MobileAppNavigation, type MobileAppTab } from './MobileAppNavigation';
import { SiteHeader } from './SiteHeader';
import { StoreFooter } from './StoreFooter';
import { DocumentRequestsNotice } from './DocumentRequestsPage';
import './storefront.css';
import './shopping-flow.css';
import './account-page.css';

export interface AccountOutletContext {
  returnTo: string;
}

const ACCOUNT_APP_LINKS = {
  home: '/',
  categories: '/?tab=categories',
  search: '/?tab=search',
  cart: '/?tab=cart',
  profile: '/account',
} satisfies Record<MobileAppTab, string>;

interface AccountSection {
  to: string;
  icon: IconName;
  title: string;
  hint: string;
  customerOnly?: boolean;
}

const SECTIONS: AccountSection[] = [
  { to: '/account', icon: 'bag', title: 'سفارش‌های من', hint: 'پیگیری، پرداخت و فاکتور' },
  { to: '/account/wallet', icon: 'wallet', title: 'کیف پول', hint: 'موجودی و تراکنش‌ها' },
  { to: '/account/credit', icon: 'card', title: 'پرونده اعتباری', hint: 'خرید چکی و اعتبار هفتگی' },
  { to: '/account/telegram', icon: 'send', title: 'ربات تلگرام و بله', hint: 'اعلان سفارش‌ها در پیام‌رسان', customerOnly: true },
  { to: '/account/documents', icon: 'doc', title: 'مدارک و درخواست‌ها', hint: 'تکمیل و ارسال مدارک حساب' },
];

interface WalletSummary {
  wallet: { balance: number };
  config: { enabled: boolean };
}

function initials(name: string, lastName: string): string {
  return name.trim()[0] || lastName.trim()[0] || 'م';
}

function isOpenOrder(order: OrderDTO) {
  return order.status !== 'delivered' && order.status !== 'cancelled';
}

function awaitsPayment(order: OrderDTO) {
  return order.status !== 'cancelled' && order.paymentStatus !== 'paid';
}

export function AccountLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, ready, isAdmin, complete, logout } = useAuth();
  const lines = useCart((state) => state.lines);
  const [authOpen, setAuthOpen] = useState(false);
  const [authStep, setAuthStep] = useState<'phone' | 'profile'>('phone');
  const savedReturn = (location.state as { returnTo?: unknown } | null)?.returnTo;
  const returnTo = typeof savedReturn === 'string' && savedReturn.startsWith('/') && !savedReturn.startsWith('//')
    ? savedReturn
    : '/';

  // Same query keys as the orders and wallet pages, so the summary shares their cache.
  const orders = useQuery({
    queryKey: ['my-orders', user?.id ?? null],
    queryFn: () => api.get<{ orders: OrderDTO[] }>('/orders'),
    enabled: Boolean(user),
  });
  const wallet = useQuery({
    queryKey: ['wallet', user?.id ?? null],
    queryFn: () => api.get<WalletSummary>('/wallet'),
    enabled: Boolean(user),
    retry: false,
  });

  const sections = SECTIONS.filter((section) => !section.customerOnly || user?.role === 'customer');
  const current = sections.find((section) => section.to === location.pathname.replace(/\/$/, '')) ?? sections[0];

  const openLogin = (step: 'phone' | 'profile' = 'phone') => {
    setAuthStep(step);
    setAuthOpen(true);
  };

  const signOut = async () => {
    await logout();
    toast.ok('از حساب خود خارج شدید.');
    navigate('/', { replace: true });
  };

  const orderList = orders.data?.orders ?? [];
  const stats: { label: string; value: string; tone?: string; to: string }[] = [
    { label: 'کل سفارش‌ها', value: formatNumber(orderList.length), to: '/account' },
    { label: 'سفارش‌های جاری', value: formatNumber(orderList.filter(isOpenOrder).length), to: '/account' },
    {
      label: 'در انتظار پرداخت',
      value: formatNumber(orderList.filter(awaitsPayment).length),
      tone: orderList.some(awaitsPayment) ? 'warn' : undefined,
      to: '/account',
    },
  ];
  if (wallet.data?.config.enabled) {
    stats.push({ label: 'موجودی کیف پول', value: `${formatNumber(wallet.data.wallet.balance)} تومان`, to: '/account/wallet' });
  }

  const fullName = user ? `${user.name || ''} ${user.lastName || ''}`.trim() || 'کاربر تماس مارکت' : '';
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long' }) : '';

  return (
    <div className="shell account-shell" dir="rtl">
      <SiteHeader onRequestLogin={() => openLogin('phone')} />

      <main className="account-page">
        <nav className="account-crumbs" aria-label="مسیر">
          <Link to="/">خانه</Link>
          <Icon name="chevron" className="account-crumb-sep" aria-hidden="true" />
          <Link to="/account">حساب کاربری</Link>
          {user && current && current.to !== '/account' && (
            <>
              <Icon name="chevron" className="account-crumb-sep" aria-hidden="true" />
              <span aria-current="page">{current.title}</span>
            </>
          )}
        </nav>

        {!ready ? (
          <div className="account-skeleton" aria-busy="true">
            <div className="skeleton" style={{ height: 150, borderRadius: 20 }} />
            <div className="account-grid">
              <div className="skeleton" style={{ height: 320, borderRadius: 18 }} />
              <div className="skeleton" style={{ height: 320, borderRadius: 18 }} />
            </div>
          </div>
        ) : !user ? (
          <section className="account-guest">
            <span className="account-guest-icon"><Icon name="user" /></span>
            <h1>ورود به حساب کاربری</h1>
            <p>برای پیگیری سفارش‌ها، کیف پول و پرونده اعتباری، با شماره موبایل خود وارد شوید.</p>
            <button type="button" className="btn primary" onClick={() => openLogin('phone')}>ورود / ثبت‌نام همکار</button>
            <ul className="account-guest-points">
              <li><Icon name="bag" /> پیگیری وضعیت و پرداخت سفارش‌ها</li>
              <li><Icon name="card" /> خرید چکی و اعتبار هفتگی</li>
              <li><Icon name="printer" /> دریافت و چاپ فاکتور</li>
            </ul>
          </section>
        ) : (
          <>
            <section className="account-hero" aria-label="خلاصه حساب">
              <div className="account-hero-profile">
                <span className="account-avatar" aria-hidden="true">{initials(user.name || '', user.lastName || '')}</span>
                <div className="account-hero-id">
                  <div className="account-hero-name">
                    <h1>{fullName}</h1>
                    {user.isActive ? (
                      <span className="account-pill is-ok"><Icon name="check" /> همکار تأییدشده</span>
                    ) : (
                      <span className="account-pill is-wait"><Icon name="clock" /> در انتظار تأیید</span>
                    )}
                  </div>
                  <div className="account-hero-meta">
                    {user.storeName && <span><Icon name="home" /> {user.storeName}</span>}
                    <span><Icon name="phone" /> <bdi className="ltr-inline">{user.phone}</bdi></span>
                    {memberSince && <span><Icon name="calendar" /> عضویت از {memberSince}</span>}
                  </div>
                </div>
                <div className="account-hero-actions">
                  {!complete && (
                    <button type="button" className="btn primary sm" onClick={() => openLogin('profile')}>
                      <Icon name="warn" /> تکمیل اطلاعات حساب
                    </button>
                  )}
                  {isAdmin && (
                    <Link to="/admin" className="btn sm"><Icon name="grid" /> پنل مدیریت</Link>
                  )}
                  <button type="button" className="btn ghost sm account-logout" onClick={() => void signOut()}>
                    <Icon name="logout" /> خروج
                  </button>
                </div>
              </div>

              <dl className="account-stats">
                {stats.map((stat) => (
                  <Link key={stat.label} to={stat.to} state={{ returnTo }} className={`account-stat${stat.tone ? ` is-${stat.tone}` : ''}`}>
                    <dt>{stat.label}</dt>
                    <dd>{orders.isLoading && stat.to === '/account' ? '…' : stat.value}</dd>
                  </Link>
                ))}
              </dl>
            </section>

            <div className="account-grid">
              <aside className="account-sidebar">
                <nav className="account-nav" aria-label="بخش‌های حساب کاربری">
                  {sections.map((section) => (
                    <NavLink
                      key={section.to}
                      to={section.to}
                      end={section.to === '/account'}
                      state={{ returnTo }}
                      className={({ isActive }) => `account-nav-item${isActive ? ' active' : ''}`}
                    >
                      <span className="account-nav-icon"><Icon name={section.icon} /></span>
                      <span className="account-nav-text">
                        <b>{section.title}</b>
                        <small>{section.hint}</small>
                      </span>
                      <Icon name="chevron" className="account-nav-arrow" aria-hidden="true" />
                    </NavLink>
                  ))}
                </nav>
                <div className="account-sidebar-foot">
                  <Link to={returnTo} className="account-foot-link"><Icon name="bag" /> ادامه خرید</Link>
                  <button type="button" className="account-foot-link is-danger" onClick={() => void signOut()}>
                    <Icon name="logout" /> خروج از حساب
                  </button>
                </div>
              </aside>

              <div className="account-content">
                <DocumentRequestsNotice />
                <Outlet context={{ returnTo } satisfies AccountOutletContext} />
              </div>
            </div>
          </>
        )}
      </main>

      <StoreFooter />
      <MobileAppNavigation activeTab="profile" cartItemCount={cartCount(lines)} links={ACCOUNT_APP_LINKS} />
      <AuthDialog
        open={authOpen}
        initialStep={authStep}
        onClose={() => setAuthOpen(false)}
        onOpenCredit={() => navigate('/account/credit')}
        onReady={() => setAuthOpen(false)}
      />
    </div>
  );
}
