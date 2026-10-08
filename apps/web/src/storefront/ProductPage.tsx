import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { BundleContentDTO, ProductDTO, ProductGroupDTO, Warehouse } from '@tamas/shared';
import { WAREHOUSE_LABELS, formatNumber, hasRealDiscount } from '@tamas/shared';
import { api, ApiRequestError } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../store/auth';
import { cartCount, isProductUnavailable, stockFor, useCart } from '../store/cart';
import { AuthDialog } from './AuthDialog';
import { CrmChat } from '../components/CrmChat';
import { Price } from '../components/Price';
import { Icon } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';
import { ProductCard } from './ProductCard';
import { createColorMap, resolveProductColor } from './productColor';
import { isPhoneMediaOnlyProduct, isPhoneProduct, phoneDefaultVariantIndex, phoneDisplayVariants, phoneModelImages } from './productVariants';
import { StoreFooter } from './StoreFooter';
import { IncompleteProfilePopup } from './IncompleteProfilePopup';
import { useBootstrap } from './hooks';
import './storefront.css';
import './product-page.css';

interface ProductDetailResponse {
  product: ProductDTO;
  variants: ProductDTO[];
  bundleContents: BundleContentDTO[];
}

const WAREHOUSE_ORDER: Warehouse[] = ['kerman', 'tehran'];

function normalizeBundleSearch(value: string): string {
  return value.toLocaleLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();
}

function imageSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.startsWith('http') || raw.startsWith('/') ? raw : `/uploads/${raw}`;
}

function getWarehouseButtons(product: ProductDTO): Warehouse[] {
  const hasSplit = product.kermanStock + product.tehranStock > 0;
  if (hasSplit) return WAREHOUSE_ORDER.filter((w) => stockFor(product, w) > 0);
  return stockFor(product, 'site') > 0 ? ['site'] : [];
}

function ShareIcon() {
  return (
    <svg className="pp-share-svg" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5.5" cy="12" r="2.2" />
      <circle cx="12" cy="5.5" r="2.2" />
      <circle cx="12" cy="18.5" r="2.2" />
      <path d="M7 10.6l3.6-3.5M7 13.4l3.6 3.5M14.4 6.8H17a2 2 0 0 1 2 2v6.4a2 2 0 0 1-2 2h-2.6" />
    </svg>
  );
}

export function ProductPage({ adminPreview = false }: { adminPreview?: boolean }) {
  const { productId } = useParams<{ productId: string }>();
  const toast = useToast();
  const { user, complete } = useAuth();
  const addToCart = useCart((s) => s.add);
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [relatedPreview, setRelatedPreview] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'desc' | 'specs'>('desc');
  const [bundleSearch, setBundleSearch] = useState('');
  const [authStep, setAuthStep] = useState<'phone' | 'profile'>('phone');
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);
  const previewDialogRef = useRef<HTMLDivElement>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const query = useQuery({
    queryKey: ['product', productId, adminPreview],
    queryFn: async ({ signal }) =>
      api.get<ProductDetailResponse>(
        adminPreview
          ? `/admin/products/preview/${encodeURIComponent(productId ?? '')}`
          : `/catalog/products/${encodeURIComponent(productId ?? '')}`,
        undefined,
        signal,
      ),
    enabled: Boolean(productId),
    retry: false,
  });

  const variants = query.data?.variants ?? [];
  const main = query.data?.product ?? null;
  const isPhone = Boolean(main && isPhoneProduct(main));
  const displayVariants = useMemo(() => isPhone ? phoneDisplayVariants(variants) : variants, [isPhone, variants]);
  const requested = variants.find((v) => v.productId === (selectedId ?? main?.productId)) ?? main;
  const selected = isPhone && requested && isPhoneMediaOnlyProduct(requested)
    ? displayVariants[phoneDefaultVariantIndex(displayVariants)] ?? requested
    : requested ?? displayVariants[0] ?? null;
  const isBundle = selected?.type === 'bundle';
  const bundleContents = isBundle
    ? (query.data?.bundleContents?.length
      ? query.data.bundleContents
      : selected.bundleItems.map((item) => ({ ...item, title: `کالا با کد ${item.productId}` })))
    : [];
  const bundleQuantity = bundleContents.reduce((total, item) => total + item.qty, 0);
  const bundleSearchTerm = normalizeBundleSearch(bundleSearch);
  const filteredBundleContents = bundleContents
    .map((item, index) => ({ ...item, position: index + 1 }))
    .filter((item) => !bundleSearchTerm || normalizeBundleSearch(`${item.title} ${item.productId}`).includes(bundleSearchTerm));

  useEffect(() => {
    setActiveTab(main?.type === 'bundle' ? 'specs' : 'desc');
    setBundleSearch('');
  }, [main?.productId, main?.type]);

  const colorGroups = useMemo(() => {
    if (isPhone) return displayVariants;
    const seen = new Map<string, ProductDTO>();
    for (const v of variants) {
      const key = (v.color || v.colorEn || 'default').trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, v);
    }
    return [...seen.values()];
  }, [displayVariants, isPhone, variants]);

  const images = useMemo(() => {
    if (!selected) return [];
    const sources = isPhone ? phoneModelImages(variants.length ? variants : [selected]) : [selected.imageUrl, ...selected.gallery];
    const list = sources
      .map((src) => imageSrc(src))
      .filter((s): s is string => Boolean(s));
    if (list.length === 0) list.push('/logo.png');
    return [...new Set(list)];
  }, [isPhone, selected, variants]);

  const previewOpen = previewIndex !== null;
  const showPreviewImage = (direction: -1 | 1) => {
    if (images.length < 2) return;
    setPreviewIndex((current) => current === null ? null : (current + direction + images.length) % images.length);
  };

  useEffect(() => {
    if (!previewOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    previewCloseRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewIndex(null);
        return;
      }
      if (event.key === 'Tab') {
        const controls = previewDialogRef.current?.querySelectorAll<HTMLButtonElement>('button');
        if (controls?.length) {
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (first && last && event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (first && last && !event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
      if (images.length < 2) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPreviewIndex((current) => current === null ? null : (current + 1) % images.length);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPreviewIndex((current) => current === null ? null : (current - 1 + images.length) % images.length);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [previewOpen, images.length]);

  const bootstrap = useBootstrap();

  const colorMap = useMemo(() => createColorMap(bootstrap.data?.colors), [bootstrap.data?.colors]);

  const relatedQuery = useQuery({
    queryKey: ['related', selected?.productId],
    queryFn: async ({ signal }) => {
      const response = await api.get<{ groups: ProductGroupDTO[]; total: number }>(
        '/catalog/products',
        {
          category: selected?.categoryName ?? selected?.categoryFaName ?? undefined,
          page: 1,
          perPage: 10,
        },
        signal,
      );
      return (response.groups ?? [])
        .filter((g) => !g.variants.some((v) => v.productId === selected?.productId))
        .slice(0, 6);
    },
    enabled: !adminPreview && Boolean(selected?.productId) && Boolean(selected?.categoryName || selected?.categoryFaName),
    staleTime: 60_000,
    retry: false,
  });

  const relatedGroups = relatedQuery.data ?? [];

  const isPromo = Boolean(selected?.promotion);
  const canViewPrices = adminPreview || Boolean(user?.isActive);
  const cartTotalQty = cartCount(lines);
  const shareUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const trackedShareUrl = (source: string) => `${shareUrl}?utm_source=${encodeURIComponent(source)}&utm_medium=share&utm_campaign=product-share`;

  function handleAdd(product: ProductDTO, warehouse: Warehouse) {
    if (adminPreview || product.price <= 0 || product.status !== 'active') return;
    if (!user) {
      setAuthStep('phone');
      setAuthOpen(true);
      return;
    }
    const result = addToCart(product, warehouse);
    if (!result.ok) toast.error(result.message ?? 'افزودن به سبد ممکن نشد.');
    else toast.ok('به سبد خرید اضافه شد.');
  }

  function handleUpdateQty(key: string, qty: number) {
    if (adminPreview) return;
    if (!user) {
      setAuthStep('phone');
      setAuthOpen(true);
      return;
    }
    setQty(key, qty);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(trackedShareUrl('copy-link'));
      toast.ok('لینک محصول کپی شد.');
    } catch {
      toast.error('کپی لینک ممکن نشد.');
    }
    setShareOpen(false);
  }

  async function nativeShare() {
    const title = selected?.title ?? 'تماس مارکت';
    try {
      if (navigator.share) {
        await navigator.share({ title, url: trackedShareUrl('native-share') });
      } else {
        await copyLink();
      }
    } catch {
      /* user cancelled the native sheet */
    }
    setShareOpen(false);
  }

  const shareText = `${selected?.title ?? 'محصول'} — ${trackedShareUrl('whatsapp')}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const tgLink = `https://t.me/share/url?url=${encodeURIComponent(trackedShareUrl('telegram'))}&text=${encodeURIComponent(selected?.title ?? '')}`;
  const eitaaLink = `https://eitaa.com/share/url?url=${encodeURIComponent(trackedShareUrl('eitaa'))}&text=${encodeURIComponent(selected?.title ?? '')}`;

  if (query.isLoading) {
    return (
      <div className="shell">
        <header className="topbar">
          <div className="pp-header">
            <Link to="/" className="logo">
              <img src="/logo.png" alt="تماس مارکت" />
              <span className="logo-tagline">مرجع تخصصی فروش عمده کالای دیجیتال</span>
            </Link>
            <div className="pp-header-actions">
              <Link to="/" className="btn">بازگشت به فروشگاه</Link>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="pp-wrap">
          <div className="pp-skeleton-grid">
            <div className="skeleton pp-skel-big" />
            <div>
              <div className="skeleton" style={{ height: 26, width: '70%', marginBottom: 14 }} />
              <div className="skeleton" style={{ height: 16, width: '45%', marginBottom: 22 }} />
              <div className="skeleton" style={{ height: 120, width: '100%', marginBottom: 16 }} />
              <div className="skeleton" style={{ height: 44, width: '100%' }} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (query.isError || !selected || !main) {
    return (
      <div className="shell">
        <header className="topbar">
          <div className="pp-header">
            <Link to="/" className="logo">
              <img src="/logo.png" alt="تماس مارکت" />
              <span className="logo-tagline">مرجع تخصصی فروش عمده کالای دیجیتال</span>
            </Link>
            <div className="pp-header-actions">
              <Link to="/" className="btn">بازگشت به فروشگاه</Link>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="pp-wrap">
          <div className="pp-not-found">
            <div className="pp-not-found-icon"><Icon name="box" /></div>
            <h1>{adminPreview && query.error instanceof ApiRequestError && [401, 403].includes(query.error.status) ? 'دسترسی به پیش‌نمایش مجاز نیست' : 'محصول مورد نظر پیدا نشد'}</h1>
            <p>{adminPreview
              ? 'برای دیدن پیش‌نمایش باید با حسابی دارای دسترسی مدیریت محصولات وارد شوید.'
              : 'این کالا غیرفعال شده یا آدرس آن اشتباه است.'}</p>
            <Link to={adminPreview ? '/admin/products' : '/'} className="btn primary">{adminPreview ? 'بازگشت به مدیریت محصولات' : 'مشاهده همه کالاها'}</Link>
          </div>
        </main>
      </div>
    );
  }

  const brand = selected.brandFaName || selected.brandName || 'متفرقه';
  const category = selected.categoryFaName || selected.categoryName || '';
  const selectedUnavailable = isProductUnavailable(selected);
  const whButtons = !adminPreview && selected.status === 'active' && selected.price > 0
    ? getWarehouseButtons(selected)
    : [];

  return (
    <div className="shell">
      <header className="topbar">
        <div className="pp-header">
          <Link to="/" className="logo">
            <img src="/logo.png" alt="تماس مارکت" />
            <span className="logo-tagline">مرجع تخصصی فروش عمده کالای دیجیتال</span>
          </Link>
          <div className="pp-header-actions">
            <Link to="/" className="btn pp-back-btn"><Icon name="home" /> <span className="pp-back-text">بازگشت به فروشگاه</span></Link>
            <Link to="/" className="btn btn-icon-only pp-cart-btn" title="سبد خرید">
              <Icon name="bag" />
              {cartTotalQty > 0 && <span className="badge-count">{formatNumber(cartTotalQty)}</span>}
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="pp-wrap">
        {adminPreview && (
          <div className="pp-admin-preview-notice" role="status">
            پیش‌نمایش مدیریت — این حالت فقط برای مدیران است و امکان خرید در آن غیرفعال است.
            <Link to="/admin/products">بازگشت به محصولات</Link>
          </div>
        )}
        <nav className="pp-crumbs" aria-label="مسیر">
          <Link to="/">خانه</Link>
          {category && <><span className="pp-crumb-sep">/</span><Link to={`/?cat=${encodeURIComponent(category)}`}>{category}</Link></>}
          <span className="pp-crumb-sep">/</span>
          <span className="pp-crumb-current">{selected.title}</span>
        </nav>

        <div className="pp-grid">
          <div className="pp-gallery">
            <button
              type="button"
              className="pp-main-img"
              onClick={() => setPreviewIndex(0)}
              aria-label="بزرگ‌نمایی تصویر"
            >
              {isPromo && (
                <div className="pp-promo-tag">
                  <Icon name="star-fill" /> پیشنهاد ویژه
                </div>
              )}
              {selected.ribbon && <div className="pp-ribbon">{selected.ribbon}</div>}
              <img
                src={images[0]}
                alt={selected.title}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/logo.png';
                }}
              />
            </button>
            {images.length > 1 && (
              <div className="pp-thumbs">
                {images.map((src, index) => (
                  <button
                    key={src}
                    type="button"
                    className={`pp-thumb${src === images[0] ? ' active' : ''}`}
                    onClick={() => setPreviewIndex(index)}
                    aria-label={`مشاهده تصویر ${formatNumber(index + 1)} از ${formatNumber(images.length)}`}
                  >
                    <img src={src} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.png'; }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pp-info">
            <h1 className="pp-title">
              {isPromo && <Icon name="star-fill" />}
              {selected.title}
            </h1>
            {selected.subTitle && <p className="pp-subtitle">{selected.subTitle}</p>}

            <div className="pp-meta">
              <span className="pp-meta-item"><b>برند:</b> {brand}</span>
              {selected.sku && <span className="pp-meta-item"><b>کد کالا:</b> <b className="ltr-inline">{selected.sku}</b></span>}
              {selected.model && <span className="pp-meta-item"><b>مدل:</b> <b className="ltr-inline">{selected.model}</b></span>}
              {selected.warranty && <span className="pp-meta-item"><b>گارانتی:</b> {selected.warranty}</span>}
              {selected.rating != null && (
                <span className="pp-rating" aria-label={`امتیاز ${(selected.rating / 100).toFixed(2)} از ۵`}>
                  <span aria-hidden="true">★</span>
                  <b>{(selected.rating / 100).toLocaleString('fa-IR', { maximumFractionDigits: 2 })}</b>
                  <small>از ۵{selected.ratingCount > 0 ? ` (${formatNumber(selected.ratingCount)} رأی)` : ''}</small>
                </span>
              )}
            </div>

            {colorGroups.length > 1 && (
              <div className="pp-colors">
                <span className="pp-label">رنگ:</span>
                <div className="pp-swatches">
                  {colorGroups.map((v) => (
                    <button
                      key={v.productId}
                      type="button"
                      className={`pp-swatch${v.productId === selected.productId ? ' active' : ''}`}
                      style={{ background: resolveProductColor(v, colorMap) }}
                      onClick={() => setSelectedId(v.productId)}
                      title={`${v.color || v.colorEn || 'رنگ'}`}
                      aria-label={`انتخاب رنگ ${v.color || v.colorEn}`}
                    />
                  ))}
                </div>
                <span className="pp-color-name">{selected.color || selected.colorEn || ''}</span>
              </div>
            )}

            {colorGroups.length > 1 && (
              <div className="pp-colors">
                <span className="pp-label">تعداد رنگ:</span>
                <span className="pp-color-name">{formatNumber(colorGroups.length)}</span>
              </div>
            )}

            {!selectedUnavailable && <div className="pp-price-row">
              <div className={canViewPrices ? undefined : 'price-obscured'} aria-label={canViewPrices ? undefined : 'قیمت پس از تأیید حساب نمایش داده می‌شود'}>
                {hasRealDiscount(selected.price, selected.oldPrice) && (
                  <span className="card-old-price"><Price amount={selected.oldPrice!} /></span>
                )}
                <div className="pp-price">{selected.price > 0 ? <Price amount={selected.price} /> : 'قیمت‌گذاری نشده'}</div>
              </div>
              {selected.discount > 0 && <span className="pp-discount-badge">٪{formatNumber(selected.discount)} تخفیف</span>}
            </div>}

            {!selectedUnavailable && !canViewPrices && (
              <div className="price-lock-note pp-lock-note">
                <span>{user ? 'قیمت‌ها پس از تأیید حساب همکاری نمایش داده می‌شوند.' : 'برای مشاهده قیمت‌های عمده وارد حساب همکار شوید.'}</span>
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

            {whButtons.length > 0 && (
              <div className="pp-buy">
                {whButtons.map((wh) => {
                  const n = stockFor(selected, wh);
                  const cartKey = `${selected.productId}::${wh}`;
                  const line = lines.find((l) => l.key === cartKey);
                  const qty = line?.qty ?? 0;
                  return (
                    <div key={wh} className="warehouse-row pp-wh-row">
                      <div className="wh-details">
                        <span className={`wh-badge ${wh}`}>{WAREHOUSE_LABELS[wh]}</span>
                        {n === 1 && (
                          <span className="wh-count">
                            <b className="stock-warn">تنها ۱ عدد باقیست!</b>
                          </span>
                        )}
                      </div>
                      {qty > 0 ? (
                        <div className="pp-qty-stepper">
                          <button type="button" className="add-wh-btn" onClick={() => handleUpdateQty(cartKey, qty - 1)}>-</button>
                          <span>{formatNumber(qty)}</span>
                          <button type="button" className="add-wh-btn" onClick={() => handleAdd(selected, wh)}>+</button>
                        </div>
                      ) : (
                        <button type="button" className="btn primary pp-add-btn" onClick={() => handleAdd(selected, wh)}>
                          افزودن به سبد
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {whButtons.length === 0 && !adminPreview && (
              <div className="pp-out-of-stock">
                <Icon name="warn" /> {selectedUnavailable ? 'این کالا فعلاً موجود نیست.' : 'قیمت این کالا هنوز تعیین نشده است.'}
              </div>
            )}
            {adminPreview && <div className="pp-out-of-stock">خرید در پیش‌نمایش مدیریت غیرفعال است.</div>}

            {!adminPreview && <div className="pp-share" ref={shareRef}>
              <button
                type="button"
                className="btn pp-share-btn"
                onClick={() => setShareOpen((o) => !o)}
                aria-expanded={shareOpen}
              >
                <ShareIcon /> اشتراک‌گذاری
              </button>
              {shareOpen && (
                <div className="pp-share-menu">
                  {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                    <button type="button" className="pp-share-item" onClick={() => void nativeShare()}>
                      <span className="pp-share-chip pp-share-native"><ShareIcon /></span>
                      اشتراک‌گذاری سریع
                    </button>
                  )}
                  <a className="pp-share-item" href={waLink} target="_blank" rel="noopener noreferrer" onClick={() => setShareOpen(false)}>
                    <span className="pp-share-chip pp-share-wa">و</span>
                    واتس‌اپ
                  </a>
                  <a className="pp-share-item" href={tgLink} target="_blank" rel="noopener noreferrer" onClick={() => setShareOpen(false)}>
                    <span className="pp-share-chip pp-share-tg">✈</span>
                    تلگرام
                  </a>
                  <a className="pp-share-item" href={eitaaLink} target="_blank" rel="noopener noreferrer" onClick={() => setShareOpen(false)}>
                    <span className="pp-share-chip pp-share-eitaa">ای</span>
                    ایتا
                  </a>
                  <button type="button" className="pp-share-item" onClick={() => void copyLink()}>
                    <span className="pp-share-chip pp-share-copy"><Icon name="check" /></span>
                    کپی لینک
                  </button>
                </div>
              )}
            </div>}
          </div>
        </div>

        <div className="pp-trust-features">
          <div className="pp-trust-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            <span>ضمانت اصالت و سلامت فیزیکی</span>
          </div>
          <div className="pp-trust-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 12l5 5L20 7" /></svg>
            <span>پشتیبانی و مشاوره خرید</span>
          </div>
          <div className="pp-trust-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v9c0 .6.4 1 1 1h2m10 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm-10 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/></svg>
            <span>ارسال سریع و مطمئن</span>
          </div>
        </div>

        <div className="pp-tabs-container">
          <div className="pp-tabs-header">
            <button 
              type="button" 
              className={`pp-tab-btn ${activeTab === 'desc' ? 'active' : ''}`}
              onClick={() => setActiveTab('desc')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              نقد و بررسی
            </button>
            <button 
              type="button" 
              className={`pp-tab-btn ${activeTab === 'specs' ? 'active' : ''}`}
              onClick={() => setActiveTab('specs')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              {isBundle ? 'اقلام داخل باندل' : 'مشخصات فنی'}
            </button>
          </div>
          <div className="pp-tabs-content">
            {activeTab === 'desc' && (
              selected.description ? (
                <div className="pp-desc">{selected.description}</div>
              ) : (
                <div className="pp-empty-state">
                  <Icon name="box" />
                  <p>توضیحاتی برای این محصول ثبت نشده است.</p>
                </div>
              )
            )}
            {activeTab === 'specs' && (
              isBundle ? (
                bundleContents.length > 0 ? (
                  <section className="pp-bundle-contents" aria-label="اقلام داخل باندل">
                    <div className="pp-bundle-heading">
                      <div>
                        <h2>اقلام داخل باندل</h2>
                        <p>{formatNumber(bundleContents.length)} قلم کالا · مجموع {formatNumber(bundleQuantity)} عدد</p>
                      </div>
                      {bundleContents.length > 5 && (
                        <input
                          className="pp-bundle-search"
                          type="search"
                          value={bundleSearch}
                          onChange={(event) => setBundleSearch(event.target.value)}
                          placeholder="جستجوی نام یا کد کالا"
                          aria-label="جستجو در اقلام باندل"
                        />
                      )}
                    </div>
                    <div className="pp-bundle-list" role="list">
                      {filteredBundleContents.map((item) => (
                        <div className="pp-bundle-item" role="listitem" key={`${item.productId}-${item.position}`}>
                          <span className="pp-bundle-item-index" aria-hidden="true">{formatNumber(item.position)}</span>
                          <div className="pp-bundle-item-details">
                            <strong>{item.title}</strong>
                            <span dir="ltr">{item.productId}</span>
                          </div>
                          <span className="pp-bundle-item-qty">تعداد: {formatNumber(item.qty)}</span>
                        </div>
                      ))}
                    </div>
                    {filteredBundleContents.length === 0 && <p className="pp-bundle-no-results">کالایی با این نام یا کد پیدا نشد.</p>}
                  </section>
                ) : (
                  <div className="pp-empty-state"><Icon name="box" /><p>هنوز کالایی برای این باندل ثبت نشده است.</p></div>
                )
              ) : (selected.attributes ?? []).length > 0 ? (
                <table className="pp-attrs">
                  <tbody>
                    {(selected.attributes ?? []).map((attr) => (
                      <tr key={attr.key}>
                        <th>{attr.key}</th>
                        <td>{attr.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="pp-empty-state">
                  <Icon name="box" />
                  <p>مشخصات فنی برای این محصول ثبت نشده است.</p>
                </div>
              )
            )}
          </div>
        </div>

        {relatedGroups.length > 0 && (
          <section className="pp-related">
            <h2 className="pp-related-title">
              <Icon name="grid" /> کالاهای مرتبط
            </h2>
            <div className="products-grid">
              {relatedGroups.map((g) => (
                <ProductCard
                  key={g.key}
                  group={g}
                  colorMap={colorMap}
                  canViewPrices={canViewPrices}
                  viewMode="grid"
                  cartLines={lines}
                  onAdd={handleAdd}
                  onUpdateQty={handleUpdateQty}
                  onPreview={setRelatedPreview}
                />
              ))}
            </div>
          </section>
        )}

      </main>
      <StoreFooter />

      {whButtons.length > 0 && canViewPrices && (
        <div className="pp-mobile-bar">
          <div className="pp-mobile-price">
            {hasRealDiscount(selected.price, selected.oldPrice) && (
              <span className="card-old-price"><Price amount={selected.oldPrice!} /></span>
            )}
            <div className="pp-price"><Price amount={selected.price} /></div>
          </div>
          <button type="button" className="pp-mobile-add" onClick={() => handleAdd(selected, whButtons[0]!)}>
            افزودن به سبد
          </button>
        </div>
      )}
      {whButtons.length > 0 && !canViewPrices && (
        <div className="pp-mobile-bar">
          <div className="pp-mobile-price">
            <span className="pp-mobile-price-note">{user ? 'پس از تأیید حساب' : 'قیمت عمده پس از ورود'}</span>
          </div>
          <button
            type="button"
            className="pp-mobile-add"
            onClick={() => {
              if (!user) {
                setAuthStep('phone');
                setAuthOpen(true);
              } else {
                setAuthStep('profile');
                setAuthOpen(true);
              }
            }}
          >
            {user ? 'تکمیل حساب' : 'ورود / ثبت‌نام'}
          </button>
        </div>
      )}
      {whButtons.length === 0 && !adminPreview && (
        <div className="pp-mobile-bar">
          <span className="pp-mobile-price-note">{selectedUnavailable ? 'این کالا فعلاً موجود نیست.' : 'قیمت این کالا هنوز تعیین نشده است.'}</span>
          <button type="button" className="pp-mobile-add pp-mobile-add--muted" disabled>
            ناموجود
          </button>
        </div>
      )}

      {previewIndex !== null && images.length > 0 && (
        <div className="lightbox pp-lightbox" onClick={(event) => { if (event.target === event.currentTarget) setPreviewIndex(null); }} role="presentation">
          <div
            ref={previewDialogRef}
            className="pp-lightbox-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`تصاویر محصول ${selected.title}`}
            onTouchStart={(event) => {
              const touch = event.touches.item(0);
              if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchEnd={(event) => {
              const start = touchStartRef.current;
              touchStartRef.current = null;
              if (!start || images.length < 2) return;
              const touch = event.changedTouches.item(0);
              if (!touch) return;
              const dx = touch.clientX - start.x;
              const dy = touch.clientY - start.y;
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) showPreviewImage(dx < 0 ? 1 : -1);
            }}
          >
            <button ref={previewCloseRef} type="button" className="pp-lightbox-close" aria-label="بستن تصویر" onClick={() => setPreviewIndex(null)}>×</button>
            <div className={`pp-lightbox-stage${images.length > 1 ? ' has-navigation' : ''}`}>
              {images.length > 1 && (
                <button type="button" className="pp-lightbox-nav" aria-label="عکس قبلی" onClick={() => showPreviewImage(-1)}>›</button>
              )}
              <img src={images[previewIndex] ?? images[0] ?? '/logo.png'} alt={`تصویر ${formatNumber(previewIndex + 1)} از ${formatNumber(images.length)} محصول ${selected.title}`} onError={(event) => { event.currentTarget.src = '/logo.png'; }} />
              {images.length > 1 && (
                <button type="button" className="pp-lightbox-nav" aria-label="عکس بعدی" onClick={() => showPreviewImage(1)}>‹</button>
              )}
            </div>
            {images.length > 1 && <span className="pp-lightbox-counter" aria-live="polite">{formatNumber(previewIndex + 1)} از {formatNumber(images.length)}</span>}
          </div>
        </div>
      )}
      {relatedPreview && (
        <div className="lightbox" onClick={() => setRelatedPreview(null)} role="presentation">
          <img src={relatedPreview} alt="" />
        </div>
      )}

      <AuthDialog
        open={authOpen}
        initialStep={authStep}
        onClose={() => setAuthOpen(false)}
        onReady={() => undefined}
      />

      <IncompleteProfilePopup
        show={!!user && !complete}
        onComplete={() => { setAuthStep('profile'); setAuthOpen(true); }}
      />

      <CrmChat user={user || undefined} />
    </div>
  );
}
