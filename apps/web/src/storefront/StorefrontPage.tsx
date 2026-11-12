import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { ProductDTO, Warehouse } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { useToast } from '../components/Toast';
import { useAuth } from '../store/auth';
import { cartCount, useCart } from '../store/cart';
import { AuthDialog } from './AuthDialog';
import { CartPanel } from './CartPanel';
import { InstallBanner } from './InstallBanner';
import { AndroidAppBanner } from './AndroidAppBanner';
import { ProductCard } from './ProductCard';
import { ProductImagePreview } from './ProductImagePreview';
import { createColorMap } from './productColor';
import { PRODUCTS_PER_PAGE, useBootstrap, useDebounced, useProducts, type CatalogFilters, type StorefrontSlide } from './hooks';
import { Icon } from '../components/Icon';
import { useDarkTheme } from '../components/useDarkTheme';
import { CrmChat } from '../components/CrmChat';
import { StoreFooter } from './StoreFooter';
import { IncompleteProfilePopup } from './IncompleteProfilePopup';
import { GuestPromoPopup } from './GuestPromoPopup';
import { GoldenCampaignCopy } from './GoldenCampaignCopy';
import { GOLDEN_CAMPAIGN_END_AT, GOLDEN_CAMPAIGN_IMAGE_URL, GOLDEN_CAMPAIGN_LIGHT_IMAGE_URL, isGoldenCampaignSlide, visibleCampaignSlides } from './goldenCampaign';
import { MobileAppNavigation, type MobileAppTab } from './MobileAppNavigation';
import { SiteHeader } from './SiteHeader';
import { scrollPageToTop } from '../lib/scroll';
import { shopHref } from './landing/shopLinks';
import './storefront.css';

const SORT_LABELS: Record<CatalogFilters['sort'], string> = {
  price_asc: 'ارزان‌ترین',
  price_desc: 'گران‌ترین',
  newest: 'جدیدترین',
  title: 'حروف الفبا',
};

const FALLBACK_HERO_SLIDES: StorefrontSlide[] = [
  { id: -1, title: 'گوشی‌های اپل', imageUrl: '/assets/slides/slide-01.jpg', mobileImageUrl: null, linkUrl: '/shop?brand=Apple' },
  { id: -2, title: 'گوشی‌های شیائومی', imageUrl: '/assets/slides/slide-02.jpg', mobileImageUrl: null, linkUrl: '/shop?brand=Xiaomi' },
  { id: -3, title: 'گوشی‌های سامسونگ', imageUrl: '/assets/slides/slide-03.jpg', mobileImageUrl: null, linkUrl: '/shop?brand=Samsung' },
];

const MOBILE_APP_TABS = new Set<MobileAppTab>(['home', 'categories', 'search', 'cart', 'profile']);
const ACCOUNT_TAB_LINKS = { profile: '/account' } satisfies Partial<Record<MobileAppTab, string>>;

function parseMobileTab(value: string | null): MobileAppTab {
  return value && MOBILE_APP_TABS.has(value as MobileAppTab) ? value as MobileAppTab : 'home';
}

function ProductSkeletons({ viewMode }: { viewMode: 'list' | 'grid' }) {
  if (viewMode === 'grid') {
    return (
      <div className="products-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="product-card">
            <div className="skeleton" style={{ width: '100%', height: 160, marginBottom: "var(--ds-space-3)" }} />
            <div className="skeleton" style={{ height: 18, width: '75%', marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: "var(--ds-space-4)" }} />
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
            <div className="skeleton" style={{ height: 18, width: '70%', marginBottom: "var(--ds-space-3)" }} />
            <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: "var(--ds-space-4)" }} />
            <div className="skeleton" style={{ height: 40, width: '100%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StorefrontPage() {
  const toast = useToast();
  const isDarkTheme = useDarkTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, complete, logout } = useAuth();
  const addToCart = useCart((s) => s.add);
  const lines = useCart((s) => s.lines);

  const [searchParams, setSearchParams] = useSearchParams();
  const observedUrlRef = useRef(searchParams.toString());

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState<string | null>(searchParams.get('cat') || null);
  const [brands, setBrands] = useState<string[]>(searchParams.get('brand') ? searchParams.get('brand')!.split(',') : []);
  const [promotion, setPromotion] = useState(searchParams.get('promo') === '1');
  const [basketOnly, setBasketOnly] = useState(searchParams.get('basket') === '1' || searchParams.get('credit') === '1');
  const [sort, setSort] = useState<CatalogFilters['sort']>((searchParams.get('sort') as CatalogFilters['sort']) || 'price_asc');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>((searchParams.get('view') as 'list' | 'grid') || 'grid');
  const [mobileTab, setMobileTab] = useState<MobileAppTab>(() => (
    location.hash === '#cart' ? 'cart' : parseMobileTab(searchParams.get('tab'))
  ));

  // The tab is written to the URL by the same effect as every other filter.
  // A separate setSearchParams call here raced that effect: tapping «صفحه اصلی»
  // after a filter change was overwritten and the old tab came back.
  const selectMobileTab = useCallback((tab: MobileAppTab) => {
    setMobileTab(tab);
    scrollPageToTop();
  }, []);

  useEffect(() => {
    if (location.hash === '#cart') setMobileTab('cart');
  }, [location.hash]);

  const brandsStr = brands.join(',');

  useEffect(() => {
    // An external URL change (back/forward or a link) must update local state
    // before the local-to-URL effect is allowed to write again.
    if (searchParams.toString() !== observedUrlRef.current) return;
    const params = new URLSearchParams(searchParams);
    if (search) params.set('q', search); else params.delete('q');
    if (category) params.set('cat', category); else params.delete('cat');
    if (brandsStr) params.set('brand', brandsStr); else params.delete('brand');
    if (promotion) params.set('promo', '1'); else params.delete('promo');
    if (basketOnly) params.set('basket', '1'); else params.delete('basket');
    params.delete('credit');
    // Legacy links: stock is always enforced and the list loads endlessly.
    params.delete('stock');
    if (sort !== 'price_asc') params.set('sort', sort); else params.delete('sort');
    params.delete('page');
    if (viewMode !== 'grid') params.set('view', viewMode); else params.delete('view');
    if (mobileTab !== 'home') params.set('tab', mobileTab); else params.delete('tab');

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [search, category, brandsStr, promotion, basketOnly, sort, viewMode, mobileTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (searchParams.toString() === observedUrlRef.current) return;
    observedUrlRef.current = searchParams.toString();
    const q = searchParams.get('q') || '';
    if (search !== q) setSearch(q);

    const cat = searchParams.get('cat') || null;
    if (category !== cat) setCategory(cat);

    const brandParam = searchParams.get('brand') || '';
    if (brands.join(',') !== brandParam) {
      setBrands(brandParam ? brandParam.split(',') : []);
    }

    const promo = searchParams.get('promo') === '1';
    if (promotion !== promo) setPromotion(promo);

    const basket = searchParams.get('basket') === '1' || searchParams.get('credit') === '1';
    if (basketOnly !== basket) setBasketOnly(basket);

    const s = (searchParams.get('sort') as CatalogFilters['sort']) || 'price_asc';
    if (sort !== s) setSort(s);

    const v = (searchParams.get('view') as 'list' | 'grid') || 'grid';
    if (viewMode !== v) setViewMode(v);

    const requestedTab = location.hash === '#cart' ? 'cart' : parseMobileTab(searchParams.get('tab'));
    if (mobileTab !== requestedTab) setMobileTab(requestedTab);
  }, [searchParams]);

  const [activeSlide, setActiveSlide] = useState(0);
  const [campaignExpired, setCampaignExpired] = useState(() => Date.now() >= GOLDEN_CAMPAIGN_END_AT);

  useEffect(() => {
    if (campaignExpired) return undefined;
    const timer = window.setTimeout(
      () => setCampaignExpired(true),
      Math.max(0, GOLDEN_CAMPAIGN_END_AT - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [campaignExpired]);

  const [authOpen, setAuthOpen] = useState(false);
  const [authStep, setAuthStep] = useState<'phone' | 'profile'>('phone');
  const [preview, setPreview] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const productsTopRef = useRef<HTMLElement>(null);
  const [brandsCollapsed, setBrandsCollapsed] = useState(true);

  const debouncedSearch = useDebounced(search);
  const filters: CatalogFilters = useMemo(
    () => ({ q: debouncedSearch, category, brands, promotion, basketOnly, sort }),
    [debouncedSearch, category, brands, promotion, basketOnly, sort],
  );

  const bootstrap = useBootstrap();
  const products = useProducts(filters);
  const heroSlides = useMemo(
    () => visibleCampaignSlides(bootstrap.data?.slides ?? FALLBACK_HERO_SLIDES, campaignExpired ? GOLDEN_CAMPAIGN_END_AT : Date.now()),
    [bootstrap.data?.slides, campaignExpired],
  );

  useEffect(() => {
    setActiveSlide((current) => Math.min(current, Math.max(0, heroSlides.length - 1)));
    if (heroSlides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  /** code/name → hex, so a variant swatch can be resolved without extra requests. */
  const colorMap = useMemo(() => createColorMap(bootstrap.data?.colors), [bootstrap.data?.colors]);

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


  const setQty = useCart((s) => s.setQty);

  const handleUpdateQty = useCallback((key: string, newQty: number) => {
    if (!user) {
      setAuthStep('phone');
      setAuthOpen(true);
      return;
    }
    setQty(key, newQty);
  }, [setQty, user]);

  const handleAdd = useCallback(
    (product: ProductDTO, warehouse: Warehouse) => {
      if (!user) {
        setAuthStep('phone');
        setAuthOpen(true);
        return;
      }
      const result = addToCart(product, warehouse);
      if (!result.ok) toast.error(result.message ?? 'افزودن به سبد ممکن نشد.');
      else toast.ok('به سبد خرید اضافه شد.');
    },
    [addToCart, toast, user],
  );

  const goToCheckout = useCallback(() => {
    navigate('/checkout', { state: { returnTo: `${location.pathname}${location.search}#cart` } });
  }, [navigate, location.pathname, location.search]);

  const goToCredit = useCallback(() => {
    navigate('/account/credit', { state: { returnTo: `${location.pathname}${location.search}` } });
  }, [navigate, location.pathname, location.search]);

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
    goToCheckout();
  }, [lines.length, user, complete, toast, goToCheckout]);

  const canViewPrices = Boolean(user?.isActive);

  const groups = useMemo(() => {
    const seen = new Set<string>();
    return (products.data?.pages ?? []).flatMap((page) => page.groups).filter((group) => {
      if (seen.has(group.key)) return false;
      seen.add(group.key);
      return true;
    });
  }, [products.data]);
  const total = products.data?.pages.at(-1)?.total ?? 0;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = products;
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Load the next page shortly before the shopper reaches the end of the list.
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasNextPage) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: '900px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, groups.length]);

  return (
    <div className="shell">
      <SiteHeader
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          // Results only render on the home/search tabs; typing from the
          // categories, cart or profile tab used to look like it did nothing.
          if (mobileTab !== 'home' && mobileTab !== 'search') setMobileTab('search');
        }}
        onRequestLogin={() => {
          setAuthStep('phone');
          setAuthOpen(true);
        }}
      />

      <main className="container" data-mobile-tab={mobileTab}>
        {mobileTab === 'home' && <AndroidAppBanner />}
        {bootstrap.isError && (
          <div className="card" role="alert" style={{ color: 'var(--danger)', padding: "var(--ds-space-5)", marginBottom: "var(--ds-space-5)" }}>
            دریافت دسته‌بندی‌ها و تنظیمات فروشگاه ناموفق بود. برای نمایش اطلاعات به‌روز، صفحه را دوباره بارگذاری کنید.
          </div>
        )}
        {/* Mobile-only Categories View */}
        <div className="mobile-only-categories">
          <div style={{ padding: "var(--ds-space-5) var(--ds-space-4)", background: 'var(--card)', borderBottom: '1px solid var(--tamas-border)', position: 'sticky', top: 0, zIndex: 10 }}>
            <h2 style={{ fontSize: "var(--ds-text-lead)", fontWeight: 800, color: 'var(--tamas-fg)' }}>دسته‌بندی محصولات</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: "var(--ds-space-3)", padding: "var(--ds-space-4)" }}>
            {(bootstrap.data?.categories ?? []).map((c) => {
              const iconSrc = c.iconUrl ? c.iconUrl.startsWith('http') || c.iconUrl.startsWith('/') ? c.iconUrl : c.iconUrl.startsWith('img_') ? `/uploads/${c.iconUrl}` : `/assets/category/${c.iconUrl}` : null;
              return (
                <button
                  key={c.id}
                  type="button"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: "var(--ds-space-3)", padding: "var(--ds-space-6) var(--ds-space-3)", background: 'var(--card)', borderRadius: 16, border: '1px solid var(--tamas-border)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}
                  onClick={() => { setCategory(c.name); setBrands([]); selectMobileTab('home'); }}
                >
                  {iconSrc ? <img src={iconSrc} alt="" loading="lazy" style={{ width: 48, height: 48, objectFit: 'contain' }} /> : <span style={{ fontSize: "var(--ds-text-3xl)", color: 'var(--tamas-accent)' }}><Icon name="box" /></span>}
                  <span style={{ fontSize: "var(--ds-text-sm)", fontWeight: 700, color: 'var(--tamas-fg)' }}>{c.faName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile-only Cart View */}
        <div className="mobile-only-cart" style={{ paddingBottom: 100 }}>
          <CartPanel onCheckout={openCheckout} canViewPrices={canViewPrices} hidePrintLayout onBrowse={() => selectMobileTab('home')} />
        </div>

        {/* Mobile-only Profile View */}
        <div className="mobile-only-profile" style={{ padding: "var(--ds-space-4)", paddingBottom: 100 }}>
          {user ? (
            <div style={{ background: 'var(--card)', borderRadius: 16, padding: "var(--ds-space-5)", boxShadow: '0 2px 10px rgba(0,0,0,0.02)', textAlign: 'center', border: '1px solid var(--tamas-border)' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--tamas-accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: "var(--ds-text-3xl)", fontWeight: 800, margin: "0 auto var(--ds-space-4)" }}>{user.name?.[0] || 'U'}</div>
              <h2 style={{ fontSize: "var(--ds-text-xl)", fontWeight: 800, color: 'var(--tamas-fg)', marginBottom: "var(--ds-space-1)" }}>{user.name} {user.lastName}</h2>
              <p style={{ fontSize: "var(--ds-text-md)", color: 'var(--tamas-muted)', marginBottom: "var(--ds-space-6)" }}>{user.phone}</p>
              <Link to="/account" state={{ returnTo: `${location.pathname}${location.search}` }} className="btn primary w-full">ورود به صفحهٔ حساب کاربری</Link>
            </div>
          ) : (
            <div style={{ background: 'var(--card)', borderRadius: 16, padding: "var(--ds-space-8)", boxShadow: '0 2px 10px rgba(0,0,0,0.02)', textAlign: 'center', marginTop: "var(--ds-space-10)", border: '1px solid var(--tamas-border)' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--tamas-info-bg)', color: 'var(--tamas-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: "var(--ds-text-2xl)", margin: "0 auto var(--ds-space-4)" }}><Icon name="user" /></div>
              <h2 style={{ fontSize: "var(--ds-text-lead)", fontWeight: 800, color: 'var(--tamas-fg)', marginBottom: "var(--ds-space-3)" }}>وارد حساب کاربری شوید</h2>
              <p style={{ fontSize: "var(--ds-text-sm)", color: 'var(--tamas-muted)', marginBottom: "var(--ds-space-6)", lineHeight: 1.6 }}>برای مشاهده قیمت‌های همکاری و ثبت سفارش، لطفاً وارد شوید.</p>
              <button type="button" className="btn primary w-full" onClick={() => { setAuthStep('phone'); setAuthOpen(true); }}>ورود / ثبت‌نام</button>
            </div>
          )}
        </div>
        {/* Hero Carousel Slider */}
        {heroSlides.length > 0 && <section className={`hero-slider${heroSlides[activeSlide]?.imageUrl === GOLDEN_CAMPAIGN_IMAGE_URL ? ' hero-slider--golden' : ''}${/\/2026-11\/(phone-|festival-)/.test(heroSlides[activeSlide]?.imageUrl ?? '') ? ' hero-slider--phone-models' : ''}`} aria-label="بنرهای فروشگاه" aria-roledescription="carousel">
          {heroSlides.map((slide, i) => {
            const isGoldenCampaign = isGoldenCampaignSlide(slide);
            const imageUrl = isGoldenCampaign && !isDarkTheme ? GOLDEN_CAMPAIGN_LIGHT_IMAGE_URL : slide.imageUrl;
            const mobileImageUrl = isGoldenCampaign ? imageUrl : slide.mobileImageUrl;
            const picture = (
              <picture>
                {mobileImageUrl && <source media="(max-width: 768px)" srcSet={mobileImageUrl} />}
                <img
                  className="hero-slide-image"
                  src={imageUrl}
                  alt={isGoldenCampaign ? '' : slide.title || `بنر ${i + 1}`}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                />
              </picture>
            );
            const linkedPicture = slide.linkUrl
              ? /^https?:\/\//i.test(slide.linkUrl)
                ? <a href={slide.linkUrl} target="_blank" rel="noreferrer" tabIndex={i === activeSlide ? 0 : -1} aria-label={slide.title || 'مشاهده بنر'}>{picture}</a>
                : <Link to={shopHref(slide.linkUrl)} tabIndex={i === activeSlide ? 0 : -1} aria-label={slide.title || 'مشاهده بنر'}>{picture}</Link>
              : picture;
            return (
              <div key={slide.id} className={`hero-slide${i === activeSlide ? ' active' : ''}${slide.mobileImageUrl ? ' has-mobile-art' : ''}${isGoldenCampaign ? ' hero-slide--golden' : ''}`} aria-hidden={i !== activeSlide}>
                {linkedPicture}
                {isGoldenCampaign && <GoldenCampaignCopy />}
              </div>
            );
          })}
          {heroSlides.length > 1 && <div className="slider-nav">
            <button type="button" className="slider-arrow" aria-label="بنر قبلی" onClick={() => setActiveSlide((activeSlide - 1 + heroSlides.length) % heroSlides.length)}>‹</button>
            <button type="button" className="slider-arrow" aria-label="بنر بعدی" onClick={() => setActiveSlide((activeSlide + 1) % heroSlides.length)}>›</button>
          </div>}
          {heroSlides.length > 1 && <div className="slider-dots">
            {heroSlides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                className={`slider-dot${i === activeSlide ? ' active' : ''}`}
                onClick={() => setActiveSlide(i)}
                aria-label={`نمایش بنر ${i + 1}`}
                aria-current={i === activeSlide ? 'true' : undefined}
              />
            ))}
          </div>}
        </section>}

        {/* Horizontal Category Toolbar */}
        <div className="category-toolbar">
          <div className="categories">
            <button
              type="button"
              className={`category-chip${category === null ? ' active' : ''}`}
              onClick={() => {
                setCategory(null);
                setBrands([]);
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
              <div className="side-title accordion-title">
                <button type="button" className="brand-toggle" aria-expanded={!brandsCollapsed} aria-controls="storefront-brands" onClick={() => setBrandsCollapsed((collapsed) => !collapsed)}>
                  برندها
                  <Icon name="chevron" className="accordion-chevron" style={{ transform: brandsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.25s ease', fontSize: "var(--ds-text-md)" }} />
                </button>
                {brands.length > 0 && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setBrands([]); }} style={{ fontSize: "var(--ds-text-caption)", color: 'var(--tamas-accent)', background: 'none', border: 'none', padding: "var(--ds-space-0)", cursor: 'pointer' }}>
                    همه (پاک‌سازی)
                  </button>
                )}
              </div>
              <div id="storefront-brands" inert={brandsCollapsed} className={`brand-icons-wrapper${brandsCollapsed ? ' collapsed' : ''}`}>
                <div className="brand-icons">
                  {visibleBrands.map((b) => {
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
                        }}
                      >
                        {iconSrc ? <img src={iconSrc} alt={b.faName} loading="lazy" /> : <Icon name="mobile" style={{ fontSize: "var(--ds-text-lg)" }} />}
                        <span className="brand-name">{b.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </aside>

          {/* Main Content (Center Column) */}
          <section className="main-content" ref={productsTopRef}>
            <div className="toolbar" aria-label="کنترل نمایش محصولات">
              <div className="toolbar-head">
                <div className="toolbar-result">
                  <strong>{formatNumber(total)}</strong>
                  <span>کالا پیدا شد</span>
                </div>
                {(brands.length > 0 || category || promotion || basketOnly || search) && (
                  <button
                    type="button"
                    className="btn sm toolbar-reset"
                    onClick={() => {
                      setSearch('');
                      setCategory(null);
                      setBrands([]);
                      setPromotion(false);
                      setBasketOnly(false);
                    }}
                  >
                    پاک‌کردن فیلترها
                  </button>
                )}
              </div>

              <div className="toolbar-controls">
                <div className="view-control">
                  <span id="view-mode-label" className="toolbar-control-label">نحوه نمایش</span>
                  <div className="view-btn-group" role="group" aria-labelledby="view-mode-label">
                    <button
                      type="button"
                      className={`view-btn${viewMode === 'list' ? ' active' : ''}`}
                      aria-pressed={viewMode === 'list'}
                      onClick={() => setViewMode('list')}
                    >
                      <Icon name="filter" /> خرید سریع
                    </button>
                    <button
                      type="button"
                      className={`view-btn${viewMode === 'grid' ? ' active' : ''}`}
                      aria-pressed={viewMode === 'grid'}
                      onClick={() => setViewMode('grid')}
                    >
                      <Icon name="grid" /> شبکه‌ای
                    </button>
                  </div>
                </div>

                <div className="sort-control">
                  <label htmlFor="sort"><Icon name="sort" /> مرتب‌سازی</label>
                  <select
                    id="sort"
                    className="select sort-select"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value as CatalogFilters['sort']);
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
              <div className="card" style={{ textAlign: 'center', color: 'var(--danger)', padding: "var(--ds-space-8)" }}>
                دریافت کالاها ناموفق بود. صفحه را دوباره بارگذاری کنید.
              </div>
            ) : groups.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: "var(--ds-space-12)" }}>
                محصولی با این مشخصات پیدا نشد.
              </div>
            ) : (
              <>
                <div className={viewMode === 'grid' ? 'products-grid' : 'products-list'} style={{ opacity: products.isFetching && !isFetchingNextPage ? 0.65 : 1, transition: 'opacity .15s' }}>
                  {groups.map((g) => (
                    <ProductCard key={g.key} group={g} colorMap={colorMap} canViewPrices={canViewPrices} viewMode={viewMode} cartLines={lines} onAdd={handleAdd} onUpdateQty={handleUpdateQty} onPreview={setPreview} />
                  ))}
                </div>

                <div ref={loadMoreRef} className="catalog-more" aria-live="polite">
                  {isFetchingNextPage ? (
                    <span className="catalog-more-loading"><span className="catalog-more-spinner" aria-hidden="true" /> در حال بارگذاری کالاهای بیشتر…</span>
                  ) : hasNextPage ? (
                    <button type="button" className="btn" onClick={() => void fetchNextPage()}>نمایش کالاهای بیشتر</button>
                  ) : groups.length > PRODUCTS_PER_PAGE ? (
                    <span className="catalog-more-end">همهٔ {formatNumber(total)} کالا نمایش داده شد.</span>
                  ) : null}
                </div>
              </>
            )}
          </section>

          {/* Cart Panel (Left Column) */}
          <CartPanel onCheckout={openCheckout} canViewPrices={canViewPrices} />
        </div>
      </main>

      <StoreFooter />

      <AuthDialog
        open={authOpen}
        initialStep={authStep}
        onClose={() => setAuthOpen(false)}
        onOpenCredit={goToCredit}
        onReady={() => {
          if (lines.length > 0) goToCheckout();
        }}
      />

      <IncompleteProfilePopup
        show={!!user && !complete}
        onComplete={() => { setAuthStep('profile'); setAuthOpen(true); }}
        onLogout={async () => {
          await logout();
          toast.ok('از حساب خارج شدید.');
        }}
      />

      <GuestPromoPopup
        show={!user}
        onAuth={() => { setAuthStep('phone'); setAuthOpen(true); }}
      />

      <ProductImagePreview src={preview} onClose={() => setPreview(null)} />


      <MobileAppNavigation
        activeTab={mobileTab}
        cartItemCount={cartCount(lines)}
        links={user ? ACCOUNT_TAB_LINKS : undefined}
        accountReturnTo={`${location.pathname}${location.search}${location.hash}`}
        profileLabel={user ? undefined : 'ورود / عضویت'}
        onSelect={(tab) => {
          if (tab === 'home') {
            setSearch('');
            setCategory(null);
            setBrands([]);
            setPromotion(false);
            setBasketOnly(false);
          }
          selectMobileTab(tab);
          if (tab === 'search') {
            window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.search-input')?.focus());
          }
        }}
      />

      {/* CRM Chat Widget */}
      <CrmChat user={user || undefined} />

      {/* PWA Install Banner */}
      <InstallBanner />
    </div>
  );
}
