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
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="card" style={{ padding: 14, display: 'flex', gap: 14 }}>
          <div className="skeleton" style={{ width: 116, height: 116, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 16, width: '70%', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 12, width: '40%', marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 34, width: '100%' }} />
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

  /** Brands shown in the strip narrow to the selected category. */
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
        <div className="topbar-inner">
          <Link to="/" className="logo">
            <img src="/logo.png" alt={settings.store_name || 'تماس مارکت'} />
            <span className="logo-tagline">{settings.store_tagline || 'مرجع تخصصی فروش عمده لوازم جانبی موبایل'}</span>
          </Link>

          <div className="search-box">
            <input
              type="search"
              placeholder="جستجو کنید: برند، مدل، کد کالا…"
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
              <Link to="/admin" className="top-btn">
                پنل مدیریت
              </Link>
            )}
            {user && (
              <Link to="/orders" className="top-btn">
                سفارش‌ها
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
              {user ? `${user.name || 'حساب'} ${user.lastName}`.trim() : 'ورود / ثبت نام'}
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
              className="btn sm"
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
        {settings.hero_image && (
          <div className="hero">
            <img src={settings.hero_image} alt="" />
          </div>
        )}

        <div className="shop-grid">
          <div style={{ minWidth: 0 }}>
            <div className="filters">
              <div className="chip-row" role="group" aria-label="دسته‌بندی‌ها">
                <button type="button" className={`chip${category === null ? ' on' : ''}`} onClick={() => { setCategory(null); setBrands([]); resetPage(); }}>
                  همه دسته‌ها
                </button>
                {(bootstrap.data?.categories ?? []).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`chip${category === c.name ? ' on' : ''}`}
                    onClick={() => {
                      setCategory(category === c.name ? null : c.name);
                      setBrands([]);
                      resetPage();
                    }}
                  >
                    {c.iconUrl && <img src={c.iconUrl.startsWith('http') || c.iconUrl.startsWith('/') ? c.iconUrl : `/assets/category/${c.iconUrl}`} alt="" loading="lazy" />}
                    {c.faName}
                    {c.productCount ? <span className="count">({formatNumber(c.productCount)})</span> : null}
                  </button>
                ))}
              </div>

              <div className="chip-row" role="group" aria-label="برندها">
                {visibleBrands.map((b) => {
                  const on = brands.includes(b.name);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={`chip${on ? ' on' : ''}`}
                      onClick={() => {
                        setBrands(on ? brands.filter((x) => x !== b.name) : [...brands, b.name]);
                        resetPage();
                      }}
                    >
                      {b.iconUrl && <img src={b.iconUrl.startsWith('http') || b.iconUrl.startsWith('/') ? b.iconUrl : `/assets/brand/${b.iconUrl}`} alt="" loading="lazy" />}
                      {b.faName}
                    </button>
                  );
                })}
              </div>

              <div className="toolbar">
                <button
                  type="button"
                  className={`switch${promotion ? ' on' : ''}`}
                  onClick={() => {
                    setPromotion(!promotion);
                    resetPage();
                  }}
                  aria-label="فقط پیشنهاد ویژه"
                  aria-pressed={promotion}
                />
                <span>فقط پیشنهاد ویژه</span>

                <span className="spacer" />

                <label htmlFor="sort" className="muted">
                  مرتب‌سازی
                </label>
                <select
                  id="sort"
                  className="select"
                  style={{ width: 'auto' }}
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

                <span className="badge">{formatNumber(total)} کالا</span>
              </div>

              {(brands.length > 0 || category || promotion || search) && (
                <button
                  type="button"
                  className="btn sm"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => {
                    setSearch('');
                    setCategory(null);
                    setBrands([]);
                    setPromotion(false);
                    resetPage();
                  }}
                >
                  حذف همه فیلترها
                </button>
              )}
            </div>

            {products.isLoading ? (
              <ProductSkeletons />
            ) : products.isError ? (
              <div className="alert error">دریافت کالاها ناموفق بود. صفحه را دوباره بارگذاری کنید.</div>
            ) : groups.length === 0 ? (
              <div className="card empty">محصولی با این مشخصات پیدا نشد.</div>
            ) : (
              <>
                <div className="products" style={{ opacity: products.isFetching ? 0.6 : 1, transition: 'opacity .15s' }}>
                  {groups.map((g) => (
                    <ProductCard key={g.key} group={g} colorMap={colorMap} onAdd={handleAdd} onPreview={setPreview} />
                  ))}
                </div>

                {pageCount > 1 && (
                  <div className="pager">
                    <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      قبلی
                    </button>
                    <span className="muted">
                      صفحه {formatNumber(page)} از {formatNumber(pageCount)}
                    </span>
                    <button type="button" className="btn" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                      بعدی
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <CartPanel onCheckout={openCheckout} />
        </div>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <h4>{settings.store_name || 'تماس مارکت'}</h4>
            <p style={{ margin: 0 }}>{settings.store_tagline || 'مرجع تخصصی فروش عمده لوازم جانبی موبایل'}</p>
          </div>
          <div>
            <h4>دسترسی سریع</h4>
            <div className="stack" style={{ gap: 5 }}>
              <Link to="/terms">شرایط و قوانین همکاری</Link>
              {user && <Link to="/orders">سفارش‌های من</Link>}
            </div>
          </div>
          <div>
            <h4>تماس با ما</h4>
            {settings.support_phone && <div className="ltr">{settings.support_phone}</div>}
            {settings.store_address && <div>{settings.store_address}</div>}
          </div>
        </div>
        <div className="footer-bottom">© {new Date().getFullYear()} — تمامی حقوق محفوظ است.</div>
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
