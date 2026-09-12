import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProductDTO, Warehouse } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { useToast } from '../components/Toast';
import { useAuth } from '../store/auth';
import { cartCount, useCart } from '../store/cart';
import { AuthDialog } from './AuthDialog';
import { CartPanel } from './CartPanel';
import { CheckoutDialog } from './CheckoutDialog';
import { ProductCard } from './ProductCard';
import { useBootstrap, useDebounced, useProducts, type CatalogFilters } from './hooks';
import './storefront.css';

const SORT_LABELS: Record<CatalogFilters['sort'], string> = {
  price_asc: 'ارزان‌ترین',
  price_desc: 'گران‌ترین',
  newest: 'جدیدترین',
  title: 'حروف الفبا',
};

function ProductSkeletons() {
  return (
    <div className="products">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="product" style={{ display: 'flex', gap: 14 }}>
          <div className="skeleton" style={{ width: 180, height: 180, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 18, width: '70%', marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 40, width: '100%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StorefrontPage() {
  const toast = useToast();
  const { user, complete, isAdmin } = useAuth();
  const addToCart = useCart((s) => s.add);
  const lines = useCart((s) => s.lines);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [brands, setBrands] = useState<string[]>([]);
  const [promotion, setPromotion] = useState(false);
  const [sort, setSort] = useState<CatalogFilters['sort']>('price_asc');
  const [page, setPage] = useState(1);

  const [authOpen, setAuthOpen] = useState(false);
  const [authStep, setAuthStep] = useState<'phone' | 'profile'>('phone');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search);
  const filters: CatalogFilters = useMemo(
    () => ({ q: debouncedSearch, category, brands, promotion, sort, page }),
    [debouncedSearch, category, brands, promotion, sort, page],
  );

  const bootstrap = useBootstrap();
  const products = useProducts(filters);

  /** code/name → hex, so a variant swatch can be resolved without extra requests. */
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of bootstrap.data?.colors ?? []) {
      const hex = c.code?.trim();
      if (!hex) continue;
      const value = hex.startsWith('#') ? hex : `#${hex}`;
      if (c.name) map.set(c.name.toLowerCase(), value);
      if (c.faName) map.set(c.faName.toLowerCase(), value);
    }
    return map;
  }, [bootstrap.data?.colors]);

  /** Brands shown narrow to the selected category. */
  const visibleBrands = useMemo(() => {
    const all = bootstrap.data?.brands ?? [];
    if (!category) return all;
    const cat = bootstrap.data?.categories.find((c) => c.name === category || c.faName === category);
    if (!cat || cat.brandNames.length === 0) return all;
    const allowed = new Set(cat.brandNames.map((b) => b.toLowerCase()));
    const narrowed = all.filter((b) => allowed.has(b.faName.toLowerCase()) || allowed.has(b.name.toLowerCase()));
    return narrowed.length > 0 ? narrowed : all;
  }, [bootstrap.data, category]);

  const resetPage = useCallback(() => setPage(1), []);

  const handleAdd = useCallback(
    (product: ProductDTO, warehouse: Warehouse) => {
      const result = addToCart(product, warehouse);
      if (!result.ok) toast.error(result.message ?? 'افزودن به سبد ممکن نشد.');
      else toast.ok('به سبد خرید اضافه شد.');
    },
    [addToCart, toast],
  );

  const openCheckout = useCallback(() => {
    if (lines.length === 0) {
      toast.error('سبد خرید شما خالی است.');
      return;
    }
    if (!user) {
      setAuthStep('phone');
      setAuthOpen(true);
      return;
    }
    if (!complete) {
      setAuthStep('profile');
      setAuthOpen(true);
      return;
    }
    setCheckoutOpen(true);
  }, [lines.length, user, complete, toast]);

  const settings = bootstrap.data?.settings ?? {};
  const groups = products.data?.groups ?? [];
  const total = products.data?.total ?? 0;
  const perPage = products.data?.perPage ?? 24;
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-promo">
          <div className="promo-sheen" />
          <div className="promo-inner">
            <div className="promo-copy">
              <span className="promo-title">تخفیف‌های شگفت‌انگیز تماس مارکت</span>
              <span className="promo-text">مرجع تخصصی پخش و فروش عمده لوازم جانبی موبایل و دیجیتال در سراسر کشور</span>
            </div>
          </div>
        </div>

        <div className="topbar-inner">
          <Link to="/" className="logo">
            <img src="/logo.png" alt={settings.store_name || 'تماس مارکت'} />
            <span className="logo-tagline">{settings.store_tagline || 'مرجع تخصصی فروش عمده لوازم جانبی موبایل'}</span>
          </Link>

          <div className="search-box">
            <input
              type="search"
              placeholder="جستجو در محصولات: نام، برند، کد کالا…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPage();
              }}
              aria-label="جستجو"
            />
            <span className="search-icon" aria-hidden>
              🔍
            </span>
          </div>

          <div className="top-actions">
            {isAdmin && (
              <Link to="/admin" className="top-btn secondary">
                پنل مدیریت
              </Link>
            )}
            {user && (
              <Link to="/orders" className="top-btn secondary">
                سفارش‌های من
              </Link>
            )}
            <button
              type="button"
              className="top-btn"
              onClick={() => {
                setAuthStep('phone');
                setAuthOpen(true);
              }}
            >
              {user ? `${user.name || 'حساب'} ${user.lastName}`.trim() : 'ورود / ثبت‌نام'}
            </button>
            <button type="button" className="top-btn" onClick={() => document.getElementById('cart')?.scrollIntoView({ behavior: 'smooth' })}>
              🛒
              {lines.length > 0 && <span className="cart-pill">{formatNumber(cartCount(lines))}</span>}
            </button>
          </div>
        </div>
      </header>

      {user && !complete && (
        <div className="profile-notice">
          <div className="profile-notice-inner">
            <span>برای ثبت سفارش، اطلاعات حساب خود را کامل کنید.</span>
            <button
              type="button"
              className="btn sm primary"
              onClick={() => {
                setAuthStep('profile');
                setAuthOpen(true);
              }}
            >
              تکمیل اطلاعات
            </button>
          </div>
        </div>
      )}

      <main className="container">
        <div className="layout">
          {/* Sidebar (Right Column) */}
          <aside className="sidebar">
            <div className="side-title">
              <span>برندهای برتر</span>
            </div>
            <div className="brand-icons">
              {visibleBrands.slice(0, 16).map((b) => {
                const on = brands.includes(b.name);
                const iconSrc = b.iconUrl
                  ? b.iconUrl.startsWith('http') || b.iconUrl.startsWith('/')
                    ? b.iconUrl
                    : `/assets/brand/${b.iconUrl}`
                  : null;
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`brand-icon-btn${on ? ' active' : ''}`}
                    title={b.faName}
                    onClick={() => {
                      setBrands(on ? brands.filter((x) => x !== b.name) : [...brands, b.name]);
                      resetPage();
                    }}
                  >
                    {iconSrc ? <img src={iconSrc} alt={b.faName} loading="lazy" /> : <span>{b.faName.slice(0, 2)}</span>}
                  </button>
                );
              })}
            </div>

            <div className="side-title">
              <span>دسته‌بندی محصولات</span>
            </div>
            <div className="category-list">
              <button
                type="button"
                className={`category-item${category === null ? ' active' : ''}`}
                onClick={() => {
                  setCategory(null);
                  setBrands([]);
                  resetPage();
                }}
              >
                <span>📦 همه دسته‌بندی‌ها</span>
              </button>
              {(bootstrap.data?.categories ?? []).map((c) => {
                const iconSrc = c.iconUrl
                  ? c.iconUrl.startsWith('http') || c.iconUrl.startsWith('/')
                    ? c.iconUrl
                    : `/assets/category/${c.iconUrl}`
                  : null;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`category-item${category === c.name ? ' active' : ''}`}
                    onClick={() => {
                      setCategory(category === c.name ? null : c.name);
                      setBrands([]);
                      resetPage();
                    }}
                  >
                    {iconSrc && <img src={iconSrc} alt="" loading="lazy" />}
                    <span style={{ flex: 1 }}>{c.faName}</span>
                    {c.productCount ? <span style={{ opacity: 0.7, fontSize: 11 }}>({formatNumber(c.productCount)})</span> : null}
                  </button>
                );
              })}
            </div>

            <div className="switch-row">
              <span>پیشنهادهای ویژه</span>
              <button
                type="button"
                className={`switch${promotion ? ' on' : ''}`}
                onClick={() => {
                  setPromotion(!promotion);
                  resetPage();
                }}
                aria-label="فقط پیشنهاد ویژه"
              >
                <i />
              </button>
            </div>
          </aside>

          {/* Main Content (Center Column) */}
          <section className="content">
            {settings.hero_image ? (
              <div className="promo-banner">
                <img src={settings.hero_image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.2 }} />
                <div className="promo-banner-copy" style={{ position: 'relative', zIndex: 2 }}>
                  <strong>{settings.store_name || 'تماس مارکت'}</strong>
                  <small>{settings.store_tagline || 'مرجع تخصصی فروش عمده لوازم جانبی موبایل'}</small>
                </div>
              </div>
            ) : (
              <div className="promo-banner">
                <div className="promo-banner-copy">
                  <strong>پخش عمده لوازم جانبی موبایل</strong>
                  <small>ضمانت اصالت، بهترین قیمت همکاری و ارسال سریع به سراسر ایران</small>
                </div>
              </div>
            )}

            <div className="toolbar">
              <label htmlFor="sort" style={{ fontSize: 13, color: 'var(--muted)' }}>
                مرتب‌سازی:
              </label>
              <select
                id="sort"
                className="select"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as CatalogFilters['sort']);
                  resetPage();
                }}
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <span style={{ marginInlineStart: 'auto', fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>
                {formatNumber(total)} کالا
              </span>

              {(brands.length > 0 || category || promotion || search) && (
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setSearch('');
                    setCategory(null);
                    setBrands([]);
                    setPromotion(false);
                    resetPage();
                  }}
                >
                  حذف فیلترها
                </button>
              )}
            </div>

            {products.isLoading ? (
              <ProductSkeletons />
            ) : products.isError ? (
              <div className="product" style={{ textAlign: 'center', color: 'var(--danger)', padding: 32 }}>
                دریافت کالاها ناموفق بود. صفحه را دوباره بارگذاری کنید.
              </div>
            ) : groups.length === 0 ? (
              <div className="product" style={{ textAlign: 'center', color: 'var(--muted)', padding: 48 }}>
                محصولی با این مشخصات پیدا نشد.
              </div>
            ) : (
              <>
                <div className="products" style={{ opacity: products.isFetching ? 0.65 : 1, transition: 'opacity .15s' }}>
                  {groups.map((g) => (
                    <ProductCard key={g.key} group={g} colorMap={colorMap} onAdd={handleAdd} onPreview={setPreview} />
                  ))}
                </div>

                {pageCount > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 24 }}>
                    <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      قبلی
                    </button>
                    <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
                      صفحه {formatNumber(page)} از {formatNumber(pageCount)}
                    </span>
                    <button type="button" className="btn" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                      بعدی
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Cart Panel (Left Column) */}
          <CartPanel onCheckout={openCheckout} />
        </div>
      </main>

      <footer className="site-footer">
        <div>
          <h4 className="footer-title">{settings.store_name || 'تماس مارکت'}</h4>
          <p className="footer-text">{settings.store_tagline || 'مرجع تخصصی پخش و فروش عمده لوازم جانبی موبایل و تبلت در سراسر کشور.'}</p>
        </div>
        <div>
          <h4 className="footer-title">دسترسی سریع</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <Link to="/terms" style={{ color: '#d9edf0' }}>
              شرایط و قوانین همکاری
            </Link>
            {user && (
              <Link to="/orders" style={{ color: '#d9edf0' }}>
                سفارش‌های من
              </Link>
            )}
          </div>
        </div>
        <div>
          <h4 className="footer-title">ارتباط با ما</h4>
          {settings.support_phone && <p className="footer-text ltr">تلفن: {settings.support_phone}</p>}
          {settings.store_address && <p className="footer-text">آدرس: {settings.store_address}</p>}
        </div>
        <div>
          <div className="enamad-box">نماد اعتماد و مجوزهای رسمی پخش</div>
        </div>
      </footer>

      <AuthDialog
        open={authOpen}
        initialStep={authStep}
        onClose={() => setAuthOpen(false)}
        onReady={() => {
          if (lines.length > 0) setCheckoutOpen(true);
        }}
      />

      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onNeedsProfile={() => {
          setAuthStep('profile');
          setAuthOpen(true);
        }}
      />

      {preview && (
        <div className="lightbox" onClick={() => setPreview(null)} role="presentation">
          <img src={preview} alt="" />
        </div>
      )}
    </div>
  );
}
