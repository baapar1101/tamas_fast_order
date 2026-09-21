import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ProductDTO, Warehouse } from '@tamas/shared';
import { WAREHOUSE_LABELS, formatNumber, hasRealDiscount } from '@tamas/shared';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { useAuth } from '../store/auth';
import { cartCount, stockFor, useCart } from '../store/cart';
import { AuthDialog } from './AuthDialog';
import { CrmChat } from '../components/CrmChat';
import { Price } from '../components/Price';
import { Icon } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';
import './storefront.css';
import './product-page.css';

interface ProductDetailResponse {
  product: ProductDTO;
  variants: ProductDTO[];
}

const WAREHOUSE_ORDER: Warehouse[] = ['kerman', 'tehran'];

function imageSrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.startsWith('http') || raw.startsWith('/') ? raw : `/uploads/${raw}`;
}

function getWarehouseButtons(product: ProductDTO): Warehouse[] {
  const hasSplit = product.kermanStock + product.tehranStock > 0;
  if (hasSplit) return WAREHOUSE_ORDER.filter((w) => stockFor(product, w) > 0);
  return stockFor(product, 'site') > 0 ? ['site'] : [];
}

/** Resolves a swatch colour: explicit hex first, then falls back to brand teal. */
function swatchColor(product: ProductDTO): string {
  const direct = product.colorCode?.trim();
  if (direct && /^#?[0-9a-f]{3,8}$/i.test(direct)) return direct.startsWith('#') ? direct : `#${direct}`;
  return 'var(--tamas-accent)';
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

export function ProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const toast = useToast();
  const { user, complete } = useAuth();
  const addToCart = useCart((s) => s.add);
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authStep, setAuthStep] = useState<'phone' | 'profile'>('phone');
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['product', productId],
    queryFn: async ({ signal }) =>
      api.get<ProductDetailResponse>(`/catalog/products/${encodeURIComponent(productId ?? '')}`, undefined, signal),
    enabled: Boolean(productId),
    retry: false,
  });

  const variants = query.data?.variants ?? [];
  const main = query.data?.product ?? null;
  const selected =
    variants.find((v) => v.productId === (selectedId ?? main?.productId)) ?? variants[0] ?? main;

  const colorGroups = useMemo(() => {
    const seen = new Map<string, ProductDTO>();
    for (const v of variants) {
      const key = (v.colorEn || v.color || 'default').trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, v);
    }
    return [...seen.values()];
  }, [variants]);

  const images = useMemo(() => {
    if (!selected) return [];
    const title = selected.imageUrl;
    const list = [title, ...(selected.gallery ?? [])]
      .map((src) => imageSrc(src))
      .filter((s): s is string => Boolean(s));
    if (list.length === 0) list.push('/logo.png');
    return [...new Set(list)];
  }, [selected]);

  const isPromo = Boolean(selected?.promotion);
  const canViewPrices = Boolean(user?.isActive);
  const cartTotalQty = cartCount(lines);
  const shareUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';

  function handleAdd(product: ProductDTO, warehouse: Warehouse) {
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
    if (!user) {
      setAuthStep('phone');
      setAuthOpen(true);
      return;
    }
    setQty(key, qty);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
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
        await navigator.share({ title, url: shareUrl });
      } else {
        await copyLink();
      }
    } catch {
      /* user cancelled the native sheet */
    }
    setShareOpen(false);
  }

  const shareText = `${selected?.title ?? 'محصول'} — ${shareUrl}`;
  const waLink = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const tgLink = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(selected?.title ?? '')}`;
  const eitaaLink = `https://eitaa.com/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(selected?.title ?? '')}`;

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
            <h1>محصول مورد نظر پیدا نشد</h1>
            <p>این کالا در حال حاضر در فروشگاه موجود نیست یا آدرس آن اشتباه است.</p>
            <Link to="/" className="btn primary">مشاهده همه کالاها</Link>
          </div>
        </main>
      </div>
    );
  }

  const brand = selected.brandFaName || selected.brandName || 'متفرقه';
  const category = selected.categoryFaName || selected.categoryName || '';
  const whButtons = getWarehouseButtons(selected);

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
        <nav className="pp-crumbs" aria-label="مسیر">
          <Link to="/">خانه</Link>
          {category && <><span className="pp-crumb-sep">/</span><span>{category}</span></>}
          <span className="pp-crumb-sep">/</span>
          <span className="pp-crumb-current">{selected.title}</span>
        </nav>

        <div className="pp-grid">
          <div className="pp-gallery">
            <button
              type="button"
              className="pp-main-img"
              onClick={() => setPreview(images[0] || null)}
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
                {images.map((src) => (
                  <button
                    key={src}
                    type="button"
                    className={`pp-thumb${src === images[0] ? ' active' : ''}`}
                    onClick={() => setPreview(src)}
                    aria-label="مشاهده تصویر"
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
                      style={{ background: swatchColor(v) }}
                      onClick={() => setSelectedId(v.productId)}
                      title={`${v.color || v.colorEn || 'رنگ'}`}
                      aria-label={`انتخاب رنگ ${v.color || v.colorEn}`}
                    />
                  ))}
                </div>
                <span className="pp-color-name">{selected.color || selected.colorEn || ''}</span>
              </div>
            )}

            {variants.length > 1 && (
              <div className="pp-colors">
                <span className="pp-label">تعداد رنگ:</span>
                <span className="pp-color-name">{formatNumber(variants.length)}</span>
              </div>
            )}

            <div className="pp-price-row">
              <div className={canViewPrices ? undefined : 'price-obscured'} aria-label={canViewPrices ? undefined : 'قیمت پس از تأیید حساب نمایش داده می‌شود'}>
                {hasRealDiscount(selected.price, selected.oldPrice) && (
                  <span className="card-old-price"><Price amount={selected.oldPrice!} /></span>
                )}
                <div className="pp-price"><Price amount={selected.price} /></div>
              </div>
              {selected.discount > 0 && <span className="pp-discount-badge">٪{formatNumber(selected.discount)} تخفیف</span>}
            </div>

            {!canViewPrices && (
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
                        {n === 1 && <span className="wh-count"><b className="stock-warn">تنها ۱ عدد باقیست!</b></span>}
                      </div>
                      <span className="pp-stock-inline">موجودی: {formatNumber(n)}</span>
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
            {whButtons.length === 0 && (
              <div className="pp-out-of-stock">
                <Icon name="warn" /> این کالا فعلاً موجود نیست.
              </div>
            )}

            <div className="pp-share" ref={shareRef}>
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
            </div>
          </div>
        </div>

        {(selected.description || (selected.attributes ?? []).length > 0) && (
          <div className="pp-sections">
            {selected.description && (
              <section className="pp-section">
                <h2 className="pp-section-title">توضیحات محصول</h2>
                <div className="pp-desc">{selected.description}</div>
              </section>
            )}
            {(selected.attributes ?? []).length > 0 && (
              <section className="pp-section">
                <h2 className="pp-section-title">مشخصات فنی</h2>
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
              </section>
            )}
          </div>
        )}

        <footer className="pp-footer">
          <Link to="/"><Icon name="home" /> صفحه اصلی فروشگاه</Link>
          <Link to="/terms"><Icon name="book" /> شرایط و قوانین</Link>
          <span>© تمامی حقوق برای تماس مارکت محفوظ است.</span>
        </footer>
      </main>

      {whButtons.length > 0 && canViewPrices && (
        <div className="pp-mobile-bar">
          <div className="pp-mobile-price">
            {hasRealDiscount(selected.price, selected.oldPrice) && (
              <span className="card-old-price"><Price amount={selected.oldPrice!} /></span>
            )}
            <div className="pp-price"><Price amount={selected.price} /></div>
          </div>
          <button type="button" className="pp-mobile-add" onClick={() => handleAdd(selected, whButtons[0])}>
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
      {whButtons.length === 0 && (
        <div className="pp-mobile-bar">
          <span className="pp-mobile-price-note">این کالا فعلاً موجود نیست.</span>
          <button type="button" className="pp-mobile-add pp-mobile-add--muted" disabled>
            ناموجود
          </button>
        </div>
      )}

      {preview && (
        <div className="lightbox" onClick={() => setPreview(null)} role="presentation">
          <img src={preview} alt="" />
        </div>
      )}

      <AuthDialog
        open={authOpen}
        initialStep={authStep}
        onClose={() => setAuthOpen(false)}
        onReady={() => undefined}
      />

      <CrmChat user={user || undefined} />
    </div>
  );
}