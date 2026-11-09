import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { formatNumber } from '@tamas/shared';
import { Icon } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';
import { useAuth } from '../store/auth';
import { useFavorites } from '../store/favorites';
import { FavoritesDialog } from './FavoritesDialog';
import { useBootstrap } from './hooks';

interface SiteHeaderProps {
  /** Controlled search (home page filters as you type). Without it, Enter opens the results on the home page. */
  search?: string;
  onSearchChange?: (value: string) => void;
  /** Opens the sign-in dialog of the page that renders the header. */
  onRequestLogin: () => void;
}

/** The storefront's main header, shared by the home page and the account area. */
export function SiteHeader({ search, onSearchChange, onRequestLogin }: SiteHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const settings = useBootstrap().data?.settings ?? {};
  const favoritesCount = useFavorites((state) => state.items.length);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [promoOrange, setPromoOrange] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const controlled = onSearchChange !== undefined;
  const value = controlled ? search ?? '' : draft;
  const onAccount = location.pathname.startsWith('/account');

  // Switch the promo strip to the orange credit message a few seconds after login.
  useEffect(() => {
    if (!user) {
      setPromoOrange(false);
      return;
    }
    const timer = setTimeout(() => setPromoOrange(true), 3000);
    return () => clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setValue = (next: string) => {
    if (controlled) onSearchChange(next);
    else setDraft(next);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (controlled) return;
    const q = draft.trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : '/');
  };

  const openCredit = () => {
    if (user) navigate('/account/credit', { state: { returnTo: `${location.pathname}${location.search}` } });
    else onRequestLogin();
  };

  return (
    <header className="topbar">
      <div className={`topbar-promo${promoOrange ? ' promo-orange' : ''}`}>
        <div className="promo-sheen" aria-hidden="true" />
        <div className="promo-inner">
          <div className="promo-copy">
            <strong className="promo-title">
              {promoOrange ? 'رشد کسب‌وکار خود را با اعتبار ما تسریع کنید!' : 'با هم، سریع‌تر و بهتر رشد می‌کنیم!'}
            </strong>
            <span className="promo-text">
              {promoOrange
                ? 'برای خرید کالاهای پرگردش، نیازی به پرداخت نقدی ندارید، فایل اعتباری خود را بسازید و با خرید چکی یا اعتبار هفتگی، بدون پرداخت نقدی موجودی فروشگاهتان را تأمین کنید.'
                : 'همکاری با ما از چیزی که فکرش رو می‌کنید راحت‌تره. با ثبت‌نام در پنل همکاران، بلافاصله به قیمت‌های ویژه، تامین مطمئن و پشتیبانی اختصاصی دسترسی پیدا کنید.'}
            </span>
          </div>
          <button type="button" className="promo-cta" onClick={openCredit}>
            {promoOrange ? 'ایجاد فایل اعتباری' : 'ثبت‌نام در چند ثانیه'}
          </button>
        </div>
      </div>

      <div className="topbar-inner">
        <Link to="/" className="logo">
          <img src="/logo.png" alt={settings.store_name || 'تماس مارکت'} />
          <span className="logo-tagline">{settings.store_tagline || 'مرجع تخصصی فروش عمده کالای دیجیتال'}</span>
        </Link>

        <form className="search-wrapper" role="search" onSubmit={submit}>
          <span className="search-icon" aria-hidden>
            <Icon name="search" />
          </span>
          <input
            ref={inputRef}
            type="search"
            className="search-input"
            placeholder="جستجو بر اساس نام محصول، مدل، برند..."
            value={value}
            onChange={(event) => setValue(event.target.value)}
            enterKeyHint="search"
            aria-label="جستجو"
          />
          {value && (
            <button type="button" className="search-clear" onClick={() => setValue('')} aria-label="پاک کردن جستجو">
              ✕
            </button>
          )}
          <span className="search-shortcut">Ctrl + /</span>
        </form>

        <div className="user-actions">
          <ThemeToggle />
          <button
            type="button"
            className="btn btn-icon-only fav-header-btn"
            onClick={() => setFavoritesOpen(true)}
            title="علاقه‌مندی‌ها"
            aria-label={favoritesCount > 0 ? `علاقه‌مندی‌ها (${formatNumber(favoritesCount)})` : 'علاقه‌مندی‌ها'}
          >
            <Icon name={favoritesCount > 0 ? 'heart-fill' : 'heart'} />
            {favoritesCount > 0 && <span className="badge-count" aria-hidden="true">{formatNumber(favoritesCount)}</span>}
          </button>
          {user ? (
            <Link
              to="/account"
              state={{ returnTo: onAccount ? '/' : `${location.pathname}${location.search}` }}
              className="btn primary"
              aria-label="رفتن به حساب کاربری"
              aria-current={onAccount ? 'page' : undefined}
            >
              <Icon name="user" />
              <span>{`${user.name || 'حساب'} ${user.lastName || ''}`.trim()}</span>
            </Link>
          ) : (
            <button type="button" className="btn primary" onClick={onRequestLogin}>
              <Icon name="user" />
              <span>ورود / ثبت‌نام همکار</span>
            </button>
          )}
        </div>
      </div>

      <FavoritesDialog open={favoritesOpen} onClose={() => setFavoritesOpen(false)} />
    </header>
  );
}
