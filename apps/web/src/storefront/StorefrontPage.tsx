import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { Icon } from '../components/Icon';
import './storefront.css';

const SORT_LABELS: Record<CatalogFilters['sort'], string> = {
  price_asc: 'ارزان‌ترین',
  price_desc: 'گران‌ترین',
  newest: 'جدیدترین',
  title: 'حروف الفبا',
};

const HERO_SLIDES = [
  '/assets/slides/slide-01.jpg',
  '/assets/slides/slide-02.jpg',
  '/assets/slides/slide-03.jpg',
];

function ProductSkeletons({ viewMode }: { viewMode: 'list' | 'grid' }) {
  if (viewMode === 'grid') {
    return (
      <div className="products-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="product-card">
            <div className="skeleton" style={{ width: '100%', height: 160, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 18, width: '75%', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 16 }} />
            <div className="skeleton" style={{ height: 38, width: '100%' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="products-list">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="product" style={{ display: 'flex', gap: 14 }}>
          <div className="skeleton" style={{ width: 200, height: 200, flexShrink: 0 }} />
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

  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState<string | null>(searchParams.get('cat') || null);
  const [brands, setBrands] = useState<string[]>(searchParams.get('brand') ? searchParams.get('brand')!.split(',') : []);
  const [promotion, setPromotion] = useState(searchParams.get('promo') === '1');
  const [inStockOnly, setInStockOnly] = useState(searchParams.get('stock') !== '0');
  const [sort, setSort] = useState<CatalogFilters['sort']>((searchParams.get('sort') as CatalogFilters['sort']) || 'price_asc');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>((searchParams.get('view') as 'list' | 'grid') || 'grid');
  const [mobileTab, setMobileTab] = useState<'home' | 'categories' | 'search' | 'cart' | 'profile'>('home');

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (search) params.set('q', search); else params.delete('q');
    if (category) params.set('cat', category); else params.delete('cat');
    if (brands.length > 0) params.set('brand', brands.join(',')); else params.delete('brand');
    if (promotion) params.set('promo', '1'); else params.delete('promo');
    if (!inStockOnly) params.set('stock', '0'); else params.delete('stock');
    if (sort !== 'price_asc') params.set('sort', sort); else params.delete('sort');
    if (page > 1) params.set('page', String(page)); else params.delete('page');
    if (viewMode !== 'grid') params.set('view', viewMode); else params.delete('view');

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [search, category, brands, promotion, inStockOnly, sort, page, viewMode, searchParams, setSearchParams]);

  useEffect(() => {
    setSearch(searchParams.get('q') || '');
    setCategory(searchParams.get('cat') || null);
    setBrands(searchParams.get('brand') ? searchParams.get('brand')!.split(',') : []);
    setPromotion(searchParams.get('promo') === '1');
    setInStockOnly(searchParams.get('stock') !== '0');
    setSort((searchParams.get('sort') as CatalogFilters['sort']) || 'price_asc');
    setPage(Number(searchParams.get('page')) || 1);
    setViewMode((searchParams.get('view') as 'list' | 'grid') || 'grid');
  }, [searchParams]);

  const [activeSlide, setActiveSlide] = useState(0);

  const [authOpen, setAuthOpen] = useState(false);
  const [authStep, setAuthStep] = useState<'phone' | 'profile'>('phone');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [brandsCollapsed, setBrandsCollapsed] = useState(true);

  // Auto advance slide carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

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

  /** Brands shown in sidebar narrow to the selected category. */
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
    if (!user.isActive) {
      toast.error('حساب همکاری شما هنوز تأیید نشده است.');
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
  const canViewPrices = Boolean(user?.isActive);
  const groups = products.data?.groups ?? [];
  const total = products.data?.total ?? 0;
  const perPage = products.data?.perPage ?? 24;
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="shell">
      <header className="topbar">
        {/* Top promo strip */}
        <div className="topbar-promo">
          <div className="promo-sheen" aria-hidden="true" />
          <div className="promo-inner">
            <div className="promo-copy">
              <strong className="promo-title">با هم، سریع‌تر و بهتر رشد می‌کنیم!</strong>
              <span className="promo-text">
                همکاری با ما از چیزی که فکرش رو می‌کنید راحت‌تره. با ثبت‌نام در پنل همکاران، بلافاصله به قیمت‌های ویژه، تامین مطمئن و پشتیبانی اختصاصی دسترسی پیدا کنید.
              </span>
            </div>
            <button
              type="button"
              className="promo-cta"
              onClick={() => {
                setAuthStep('phone');
                setAuthOpen(true);
              }}
            >
              ثبت‌نام در چند ثانیه
            </button>
          </div>
        </div>

        {/* Topbar Header */}
        <div className="topbar-inner">
          <Link to="/" className="logo">
            <img src="/logo.png" alt={settings.store_name || 'تماس مارکت'} />
            <span className="logo-tagline">{settings.store_tagline || 'مرجع تخصصی فروش عمده کالای دیجیتال'}</span>
          </Link>

          <div className="search-wrapper">
            <span className="search-icon" aria-hidden>
              <Icon name="search" />
            </span>
            <input
              type="search"
              className="search-input"
              placeholder="جستجو بر اساس نام محصول، مدل، برند..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPage();
              }}
              aria-label="جستجو"
            />
            {search && (
              <button type="button" className="search-clear" onClick={() => setSearch('')} aria-label="پاک کردن جستجو">
                ✕
              </button>
            )}
            <span className="search-shortcut">Ctrl + /</span>
          </div>

          <div className="user-actions">
            <button
              type="button"
              className="btn btn-icon-only"
              onClick={() => document.getElementById('cart')?.scrollIntoView({ behavior: 'smooth' })}
              title="علاقه‌مندی‌ها"
            >
              <Icon name="heart" />
            </button>
            {user ? (
              <div className="profile-dropdown-wrapper" style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn primary"
                  onClick={(e) => {
                    const dropdown = e.currentTarget.nextElementSibling as HTMLElement;
                    if (dropdown) dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';
                  }}
                >
                  <Icon name="user" />
                  <span>{`${user.name || 'حساب'} ${user.lastName}`.trim()}</span>
                </button>
                <div 
                  className="profile-dropdown-menu" 
                  style={{ 
                    display: 'none', position: 'absolute', top: '110%', left: 0, 
                    backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', 
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', minWidth: '180px', padding: '8px', zIndex: 100,
                    flexDirection: 'column', gap: '4px'
                  }}
                >
                  <Link to="/orders" style={{ display: 'block', padding: '10px 16px', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
                    <Icon name="bag" style={{ marginInlineEnd: 8 }} /> سفارش‌های من
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" style={{ display: 'block', padding: '10px 16px', borderRadius: '8px', color: '#059669', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
                      <Icon name="grid" style={{ marginInlineEnd: 8 }} /> پنل مدیریت
                    </Link>
                  )}
                  <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
                  <button 
                    type="button" 
                    onClick={() => {
                      localStorage.removeItem('tamas_session');
                      window.location.reload();
                    }}
                    style={{ width: '100%', textAlign: 'right', padding: '10px 16px', borderRadius: '8px', color: '#e11d48', backgroundColor: 'transparent', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <Icon name="chevron" style={{ marginInlineEnd: 8, transform: 'rotate(180deg)' }} /> خروج از حساب
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setAuthStep('phone');
                  setAuthOpen(true);
                }}
              >
                <Icon name="user" />
                <span>ورود / ثبت‌نام همکار</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {user && !complete && (
        <div className="profile-notice">
          <div className="profile-notice-inner">
            <span>برای ثبت سفارش، اطلاعات حساب خود را کامل کنید.</span>
            <button
              type="button"
              className="btn sm teal"
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

      <main className="container" data-mobile-tab={mobileTab}>
        {/* Mobile-only Categories View */}
        <div className="mobile-only-categories">
          <div style={{ padding: '20px 16px', background: '#fff', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, zIndex: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>دسته‌بندی محصولات</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, padding: 16 }}>
            {(bootstrap.data?.categories ?? []).map((c) => {
              const iconSrc = c.iconUrl ? c.iconUrl.startsWith('http') || c.iconUrl.startsWith('/') ? c.iconUrl : c.iconUrl.startsWith('img_') ? `/uploads/${c.iconUrl}` : `/assets/category/${c.iconUrl}` : null;
              return (
                <button
                  key={c.id}
                  type="button"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 12px', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}
                  onClick={() => { setCategory(c.name); setBrands([]); resetPage(); setMobileTab('home'); }}
                >
                  {iconSrc ? <img src={iconSrc} alt="" loading="lazy" style={{ width: 48, height: 48, objectFit: 'contain' }} /> : <span style={{ fontSize: 32, color: 'var(--primary)' }}><Icon name="box" /></span>}
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{c.faName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile-only Cart View */}
        <div className="mobile-only-cart" style={{ background: '#f8fafc' }}>
          <CartPanel onCheckout={openCheckout} canViewPrices={canViewPrices} />
        </div>

        {/* Mobile-only Profile View */}
        <div className="mobile-only-profile" style={{ padding: 16, background: '#f8fafc' }}>
          {user ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.02)', textAlign: 'center' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--brand)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, margin: '0 auto 16px' }}>{user.name?.[0] || 'U'}</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{user.name} {user.lastName}</h2>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>{user.phone}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Link to="/orders" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#f1f5f9', borderRadius: 12, color: '#334155', textDecoration: 'none', fontWeight: 600 }}><Icon name="bag" /> سفارش‌های من</Link>
                {isAdmin && <Link to="/admin" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#ecfdf5', borderRadius: 12, color: '#059669', textDecoration: 'none', fontWeight: 600 }}><Icon name="grid" /> پنل مدیریت</Link>}
                <button type="button" onClick={() => { localStorage.removeItem('tamas_session'); window.location.reload(); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#fff1f2', borderRadius: 12, color: '#e11d48', border: 'none', fontWeight: 600, cursor: 'pointer' }}><Icon name="chevron" style={{ transform: 'rotate(180deg)' }} /> خروج از حساب</button>
              </div>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 2px 10px rgba(0,0,0,0.02)', textAlign: 'center', marginTop: 40 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f1f5f9', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px' }}><Icon name="user" /></div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>وارد حساب کاربری شوید</h2>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>برای مشاهده قیمت‌های همکاری و ثبت سفارش، لطفاً وارد شوید.</p>
              <button type="button" className="btn primary w-full" onClick={() => { setAuthStep('phone'); setAuthOpen(true); }}>ورود / ثبت‌نام</button>
            </div>
          )}
        </div>
        {/* Hero Carousel Slider */}
        <div className="hero-slider">
          {HERO_SLIDES.map((src, i) => (
            <img key={src} className={`hero-slide${i === activeSlide ? ' active' : ''}`} src={src} alt={`Slide ${i + 1}`} />
          ))}
          <div className="slider-overlay" />
          <div className="slider-nav">
            <button type="button" className="slider-arrow" onClick={() => setActiveSlide((activeSlide - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}>
              ‹
            </button>
            <button type="button" className="slider-arrow" onClick={() => setActiveSlide((activeSlide + 1) % HERO_SLIDES.length)}>
              ›
            </button>
          </div>
          <div className="slider-dots">
            {HERO_SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`slider-dot${i === activeSlide ? ' active' : ''}`}
                onClick={() => setActiveSlide(i)}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Horizontal Category Toolbar */}
        <div className="category-toolbar">
          <div className="categories">
            <button
              type="button"
              className={`category-chip${category === null ? ' active' : ''}`}
              onClick={() => {
                setCategory(null);
                setBrands([]);
                resetPage();
              }}
            >
              <span className="chip-icon">
                <Icon name="grid" />
              </span>
              <span className="chip-title">همه کالاها</span>
            </button>
            {(bootstrap.data?.categories ?? []).map((c) => {
              const iconSrc = c.iconUrl
                ? c.iconUrl.startsWith('http') || c.iconUrl.startsWith('/')
                  ? c.iconUrl
                  : c.iconUrl.startsWith('img_')
                    ? `/uploads/${c.iconUrl}`
                    : `/assets/category/${c.iconUrl}`
                : null;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`category-chip${category === c.name ? ' active' : ''}`}
                  onClick={() => {
                    setCategory(category === c.name ? null : c.name);
                    setBrands([]);
                    resetPage();
                  }}
                >
                  {iconSrc ? (
                    <img className="chip-icon" src={iconSrc} alt="" loading="lazy" />
                  ) : (
                    <span className="chip-icon">
                      <Icon name="box" />
                    </span>
                  )}
                  <span className="chip-title">{c.faName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3-Column Layout Grid */}
        <div className="layout">
          {/* Sidebar (Right Column in RTL) */}
          <aside className={`sidebar${filtersOpen ? ' open' : ''}`}>
            <div className="sidebar-body">
              <div className="side-title accordion-title" onClick={() => setBrandsCollapsed(!brandsCollapsed)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  برندها
                  <Icon name="chevron" className="mobile-chevron" style={{ transform: brandsCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', fontSize: 14 }} />
                </span>
                <button type="button" onClick={(e) => { e.stopPropagation(); setBrands([]); }} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  همه
                </button>
              </div>
              <div className={`brand-icons${brandsCollapsed ? ' collapsed-mobile' : ''}`}>
              {visibleBrands.slice(0, 18).map((b) => {
                const on = brands.includes(b.name);
                const iconSrc = b.iconUrl
                  ? b.iconUrl.startsWith('http') || b.iconUrl.startsWith('/')
                    ? b.iconUrl
                    : b.iconUrl.startsWith('img_')
                      ? `/uploads/${b.iconUrl}`
                      : `/assets/brand/${b.iconUrl}`
                  : null;
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`brand-icon-btn${on ? ' active' : ''}`}
                    onClick={() => {
                      setBrands(on ? brands.filter((x) => x !== b.name) : [...brands, b.name]);
                      resetPage();
                    }}
                  >
                    {iconSrc ? <img src={iconSrc} alt={b.faName} loading="lazy" /> : <Icon name="mobile" style={{ fontSize: 16 }} />}
                    <span className="brand-name">{b.name}</span>
                  </button>
                );
              })}
              </div>

              <div className="side-title" style={{ marginTop: 20 }}>فیلترهای سریع</div>
              <div className="switch-row">
                <span>فقط کالاهای موجود</span>
                <button type="button" className={`switch${inStockOnly ? ' on' : ''}`} onClick={() => setInStockOnly(!inStockOnly)}>
                  <i />
                </button>
              </div>
              <div className="switch-row">
                <span>پیشنهاد ویژه</span>
                <button
                  type="button"
                  className={`switch${promotion ? ' on' : ''}`}
                  onClick={() => {
                    setPromotion(!promotion);
                    resetPage();
                  }}
                >
                  <i />
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content (Center Column) */}
          <section className="main-content">
            <div className="toolbar">
              <div className="toolbar-left">
                <button
                  type="button"
                  className={`view-btn${viewMode === 'grid' ? ' active' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  <Icon name="grid" style={{ marginInlineEnd: 4 }} /> شبکه‌ای
                </button>
                <button
                  type="button"
                  className={`view-btn${viewMode === 'list' ? ' active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <Icon name="filter" style={{ marginInlineEnd: 4 }} /> لیستی (عمده)
                </button>

                <span className="results-count">تعداد {formatNumber(total)} کالا پیدا شد</span>

                <div className="sort-control">
                  <label htmlFor="sort">مرتب‌سازی:</label>
                  <select
                    id="sort"
                    className="select sort-select"
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
                </div>
              </div>

              <div className="toolbar-right">
                {(brands.length > 0 || category || promotion || search) && (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      setSearch('');
                      setCategory(null);
                      setBrands([]);
                      setPromotion(false);
                      setInStockOnly(false);
                      resetPage();
                    }}
                  >
                    پاکسازی فیلترها
                  </button>
                )}
              </div>
            </div>

            {!canViewPrices && (
              <div className="price-lock-note">
                <span>{user ? 'قیمت‌ها پس از تأیید حساب همکاری شما نمایش داده می‌شوند.' : 'برای مشاهده قیمت‌های عمده وارد حساب همکار شوید.'}</span>
                {!user && (
                  <button
                    type="button"
                    className="btn-lock-auth"
                    onClick={() => {
                      setAuthStep('phone');
                      setAuthOpen(true);
                    }}
                  >
                    ورود / ثبت‌نام
                  </button>
                )}
              </div>
            )}

            {products.isLoading ? (
              <ProductSkeletons viewMode={viewMode} />
            ) : products.isError ? (
              <div className="card" style={{ textAlign: 'center', color: 'var(--danger)', padding: 32 }}>
                دریافت کالاها ناموفق بود. صفحه را دوباره بارگذاری کنید.
              </div>
            ) : groups.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
                محصولی با این مشخصات پیدا نشد.
              </div>
            ) : (
              <>
                <div className={viewMode === 'grid' ? 'products-grid' : 'products-list'} style={{ opacity: products.isFetching ? 0.65 : 1, transition: 'opacity .15s' }}>
                  {groups.map((g) => (
                    <ProductCard key={g.key} group={g} colorMap={colorMap} canViewPrices={canViewPrices} viewMode={viewMode} onAdd={handleAdd} onPreview={setPreview} />
                  ))}
                </div>

                {pageCount > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 24 }}>
                    <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      قبلی
                    </button>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
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
          <CartPanel onCheckout={openCheckout} canViewPrices={canViewPrices} />
        </div>
      </main>

      <footer className="site-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <img src="/logo.png" alt="تماس مارکت" className="footer-logo" />
            <div className={`footer-about${aboutOpen ? ' open' : ''}`}>
              <h4 className="footer-title">درباره تماس مارکت (از سال ۱۳۹۰)</h4>
              <div className="footer-about-text">
                <p>
                  داستان ما در تماس مارکت از سال ۱۳۹۰ با نام تجاری «موبایل تماس» آغاز شد. در ابتدا، تمرکز ما بر ارائه خدمات در حوزه موبایل بود، اما با شناخت عمیق‌تر نیازهای بازار و رشد چشمگیر صنعت، از سال ۱۳۹۴ مسیر فعالیتمان را به سمت فروش عمده لوازم جانبی موبایل سوق دادیم.
                </p>
                <p>
                  در سال ۱۳۹۸، با هدف گسترش دامنه خدمات، بازار و ایجاد یک هویت تجاری مدرن‌تر، نام تجاری خود را به «تماس مارکت» تغییر دادیم. از سال ۱۳۹۹، با افتخار و تمرکز بر ارتقاء تجربه مشتریان، بستری جامع برای فروش آنلاین فراهم آورده‌ایم تا بتوانیم به صورت گسترده‌تر و کارآمدتر در خدمت شما عزیزان باشیم.
                </p>
                <p>
                  امروز، تماس مارکت با پشتوانه سال‌ها تجربه و دانش تخصصی در حوزه فروش عمده کالای دیجیتال، به عنوان یکی از نام‌های شناخته شده در این صنعت، آماده ارائه بهترین خدمات و محصولات به شما همکاران گرامی است.
                </p>
              </div>
              <button type="button" className="footer-more" onClick={() => setAboutOpen(!aboutOpen)}>
                <span>{aboutOpen ? 'بستن' : 'مشاهده بیشتر'}</span>
                <Icon name="chevron" style={{ transform: aboutOpen ? 'rotate(180deg)' : 'none', transition: 'transform .3s ease' }} />
              </button>
            </div>
          </div>

          <div className="footer-benefits">
            <h3 className="footer-title">چرا همکاری با ما؟</h3>
            <p className="footer-text">
              <Icon name="money" /> <span><strong>قیمت‌های استثنایی:</strong> دسترسی مستقیم به قیمت‌های عمده و لحظه‌ای.</span>
            </p>
            <p className="footer-text">
              <Icon name="bolt" /> <span><strong>سرعت در سفارش:</strong> فرآیند ثبت و تأیید سریع برای اینکه وقت شما تلف نشود.</span>
            </p>
            <p className="footer-text">
              <Icon name="chart" /> <span><strong>پنل کاربری هوشمند:</strong> مدیریت آسان فاکتورها، موجودی و سفارشات در یک‌جا.</span>
            </p>
            <p className="footer-text">
              <Icon name="handshake" /> <span><strong>پشتیبانی همیشگی:</strong> تیم ما همیشه کنار شماست تا در مسیر کسب‌وکارتان کمکی کند.</span>
            </p>
          </div>

          <div className="footer-contact">
            <h3 className="footer-title">ارتباط با ما</h3>
            <p className="footer-text">
              <Icon name="phone" /> <span><strong>شماره تماس:</strong> <a href={`tel:${settings.support_phone || '09135006644'}`} className="footer-phone">{settings.support_phone || '۰۹۱۳۵۰۰۶۶۴۴'}</a></span>
            </p>
            <p className="footer-text">
              <Icon name="pin" /> <span><strong>آدرس:</strong> {settings.store_address || 'کرمان، خیابان شهید نامجو، بعد از کوچه ۹، پلاک ۱۰۹'}</span>
            </p>
            <p className="footer-text">
              <Icon name="mail" /> <span><strong>کد پستی:</strong> ۷۶۱۹۷۴۴۵۶۸</span>
            </p>
            <p className="footer-text">
              <Icon name="clock" /> <span><strong>ساعات کاری:</strong> شنبه تا پنجشنبه از ساعت ۹:۰۰ الی ۲۱:۰۰</span>
            </p>
            <div className="footer-socials" aria-label="شبکه‌های اجتماعی">
              <a className="footer-social-link whatsapp" href="https://whatsapp.com/channel/0029Vb4s4DUJf05jmXNTbq1q" target="_blank" rel="noopener noreferrer">
                <Icon name="support" />
                <span>واتس‌اپ</span>
              </a>
              <a className="footer-social-link instagram" href="https://www.instagram.com/tamasmarket.ir?stkn=MXV3enBoZHhpcHRrdQ==" target="_blank" rel="noopener noreferrer">
                <Icon name="eye" />
                <span>اینستاگرام</span>
              </a>
            </div>
          </div>

          <div className="footer-enamad">
            <h3 className="footer-title">نماد اعتماد</h3>
            <div className="enamad-box">
              <a referrerPolicy="origin" target="_blank" rel="noopener noreferrer" href="https://trustseal.enamad.ir/?id=553708&Code=Xw8AUVHGeMUsBwbqomP1VmI7XdD6Oruw">
                <img
                  referrerPolicy="origin"
                  src="https://trustseal.enamad.ir/logo.aspx?id=553708&Code=Xw8AUVHGeMUsBwbqomP1VmI7XdD6Oruw"
                  alt="نماد اعتماد الکترونیکی"
                />
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <nav className="footer-legal" aria-label="پیوندهای مهم">
            <Link to="/terms"><Icon name="book" style={{ marginInlineEnd: 4 }} /> شرایط و قوانین همکاری</Link>
            <Link to="/terms#faq"><Icon name="help" style={{ marginInlineEnd: 4 }} /> سؤالات متداول</Link>
            <Link to="/terms#sales-terms"><Icon name="receipt" style={{ marginInlineEnd: 4 }} /> روش‌های پرداخت و تسویه‌حساب</Link>
          </nav>
          <p className="footer-copy">© تمامی حقوق برای تماس مارکت محفوظ است.</p>
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

      {/* Mobile Bottom Navigation Bar */}
      <nav className="tabbar" aria-label="ناوبری موبایل">
        <button type="button" className={`tabbar-item ${mobileTab === 'home' ? 'active' : ''}`} onClick={() => { setSearch(''); setCategory(null); setBrands([]); setPromotion(false); setInStockOnly(false); resetPage(); setMobileTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <span className="tabbar-icon"><Icon name="home" /></span><span>صفحه اصلی</span>
        </button>
        <button type="button" className={`tabbar-item ${mobileTab === 'categories' ? 'active' : ''}`} onClick={() => setMobileTab('categories')}>
          <span className="tabbar-icon"><Icon name="grid" /></span><span>دسته‌بندی‌ها</span>
        </button>
        <button type="button" className={`tabbar-item ${mobileTab === 'search' ? 'active' : ''}`} onClick={() => setMobileTab('search')}>
          <span className="tabbar-icon"><Icon name="search" /></span><span>جستجو</span>
        </button>
        <button type="button" className={`tabbar-item ${mobileTab === 'cart' ? 'active' : ''}`} onClick={() => setMobileTab('cart')}>
          <span className="tabbar-icon"><Icon name="bag" />{lines.length > 0 && <span className="badge-count">{formatNumber(cartCount(lines))}</span>}</span><span>سبد خرید</span>
        </button>
        <button type="button" className={`tabbar-item ${mobileTab === 'profile' ? 'active' : ''}`} onClick={() => setMobileTab('profile')}>
          <span className="tabbar-icon"><Icon name="user" /></span><span>{user ? 'حساب کاربری' : 'ورود / عضویت'}</span>
        </button>
      </nav>
    </div>
  );
}
