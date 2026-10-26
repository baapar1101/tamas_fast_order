import { memo, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProductDTO, ProductGroupDTO, Warehouse } from '@tamas/shared';
import { WAREHOUSE_LABELS, formatMoney, formatNumber, hasRealDiscount } from '@tamas/shared';
import { Price } from '../components/Price';
import { Icon } from '../components/Icon';
import { isProductUnavailable, stockFor } from '../store/cart';
import { resolveProductColor } from './productColor';
import { isPhoneProduct, phoneDefaultVariantIndex, phoneDisplayVariants, phoneModelImages } from './productVariants';
import { AnimatedDropdown } from '../admin/components/AnimatedDropdown';
import { resolveImageUrl } from '../lib/images';
import { ProductImageGallery } from './ProductImageGallery';

import type { CartLine } from '../store/cart';

interface Props {
  group: ProductGroupDTO;
  colorMap: Map<string, string>;
  canViewPrices: boolean;
  viewMode?: 'grid' | 'list';
  cartLines: CartLine[];
  onAdd: (product: ProductDTO, warehouse: Warehouse) => void;
  onUpdateQty: (key: string, qty: number) => void;
  onPreview: (url: string) => void;
}

/** The sheet keeps sell types as a free-text list: "نقدی, اعتباری". */
function sellTypes(raw: string | null): Array<{ label: string; icon: 'cash' | 'card' | 'doc' | 'tag' }> {
  if (!raw) return [];
  return raw
    .split(/[,،;|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((label) => {
      if (label.includes('نقد')) return { label, icon: 'cash' as const };
      if (label.includes('اعتبار')) return { label, icon: 'card' as const };
      if (label.includes('چک')) return { label, icon: 'doc' as const };
      return { label, icon: 'tag' as const };
    });
}

const WAREHOUSE_ORDER: Warehouse[] = ['kerman', 'tehran'];

function getWarehouseButtons(product: ProductDTO): Warehouse[] {
  if (product.price <= 0 || product.status !== 'active') return [];
  const hasSplit = product.kermanStock + product.tehranStock > 0;
  if (hasSplit) {
    return WAREHOUSE_ORDER.filter((warehouse) => stockFor(product, warehouse) > 0);
  }

  return stockFor(product, 'site') > 0 ? ['site'] : [];
}

function productTitleClass(title: string): string {
  const len = Array.from(String(title || '').trim()).length;
  if (len > 105) return 'title-very-long';
  if (len > 65) return 'title-long';
  return '';
}

function areProductCardPropsEqual(previous: Props, next: Props): boolean {
  const keys = Object.keys(previous) as Array<keyof Props>;
  if (keys.length !== Object.keys(next).length) return false;
  for (const key of keys) {
    if (key !== 'cartLines' && previous[key] !== next[key]) return false;
  }

  if (previous.cartLines === next.cartLines) return true;

  // A cart update for another product should not render every card in the list.
  const productIds = new Set(next.group.variants.map((variant) => variant.productId));
  const previousQuantities = new Map<string, number>();
  for (const line of previous.cartLines) {
    if (productIds.has(line.productId)) previousQuantities.set(line.key, line.qty);
  }
  for (const line of next.cartLines) {
    if (!productIds.has(line.productId)) continue;
    if (previousQuantities.get(line.key) !== line.qty) return false;
    previousQuantities.delete(line.key);
  }
  return previousQuantities.size === 0;
}

export const ProductCard = memo(function ProductCard({ group, colorMap, canViewPrices, viewMode = 'grid', cartLines, onAdd, onUpdateQty, onPreview }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isFav, setIsFav] = useState(false);

  const isPhone = Boolean(group.variants[0] && isPhoneProduct(group.variants[0]));
  const displayVariants = useMemo(() => isPhone ? phoneDisplayVariants(group.variants) : group.variants, [group.variants, isPhone]);
  const defaultIndex = isPhone ? phoneDefaultVariantIndex(displayVariants) : 0;
  const activeIndex = selectedIndex !== null && selectedIndex < displayVariants.length ? selectedIndex : defaultIndex;
  const selectedVariant = displayVariants[activeIndex] || group.variants[0];
  const allImages = useMemo(() => {
    const raw = isPhone
      ? phoneModelImages(group.variants)
      : group.variants.flatMap((variant) => [variant.imageUrl, ...variant.gallery]);
    if (group.imageUrl) raw.unshift(group.imageUrl);
    return [...new Set(raw.filter((item): item is string => Boolean(item?.trim())).map((item) => resolveImageUrl(item)))];
  }, [group.imageUrl, group.variants, isPhone]);
  const images = allImages.length ? allImages : ['/logo.png'];
  if (!selectedVariant) return null;

  const brand = selectedVariant.brandFaName || selectedVariant.brandName || 'متفرقه';
  const isPromo = Boolean(group.promotion || selectedVariant.promotion);
  const titleClass = productTitleClass(group.title);
  const whButtons = getWarehouseButtons(selectedVariant);
  const selectedUnavailable = isProductUnavailable(selectedVariant);

  if (viewMode === 'list') {
    return (
      <article className={`product-accordion${isPromo ? ' is-promotion' : ''}`}>
        {isPromo && (
          <div className="promo-tag">
            <span className="star-icon"><Icon name="star-fill" /></span> هرکی میگه ۱۶ نیست،فقط تا ۲۰ام
          </div>
        )}

        <div className="list-product-content">
          <div className="product-head">
            <div className={`product-title ${titleClass}`}>
              {isPromo && <span className="title-star"><Icon name="star-fill" /> </span>}
              <Link className="product-title-link" to={`/p/${selectedVariant.productId}`}>{group.title}</Link>
            </div>
            {selectedVariant.rating != null && (
              <span className="card-rating"><span aria-hidden="true">★</span> {(selectedVariant.rating / 100).toLocaleString('fa-IR', { maximumFractionDigits: 2 })}</span>
            )}
            <Link to={`/p/${selectedVariant.productId}`} className="btn product-list-detail"><Icon name="eye" /> مشاهده جزئیات</Link>
          </div>

          <div className="list-variants">
            {displayVariants.map((v) => {
              const whButtonsV = getWarehouseButtons(v);
              const unavailable = isProductUnavailable(v);
              const types = sellTypes(v.sellType);
              return (
                <div key={v.productId} className="variant">
                  <div className="variant-info">
                    <div className="color-title" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: "var(--ds-space-1) var(--ds-space-2)" }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="color-dot" style={{ background: resolveProductColor(v, colorMap) }} aria-hidden />
                        <span>{v.color || v.colorEn || 'مشکی'}</span>
                      </div>
                      {v.sku && (
                        <span className="variant-sku" style={{ fontSize: "var(--ds-text-xs)", color: 'var(--tamas-muted, #737373)', background: 'var(--tamas-surface-alt, #f5f5f5)', padding: '2px 6px', borderRadius: '4px' }}>
                          کد: {v.sku}
                        </span>
                      )}
                    </div>
                    <div className="sell-types">
                      {types.map((t) => (
                        <span key={t.label} className="sell-badge">
                          <Icon name={t.icon} /> {t.label}
                        </span>
                      ))}
                    </div>
                    {v.warranty && <div className="warranty-text"><Icon name="shield" /> {v.warranty}</div>}
                  </div>

                  {!unavailable && <div className={`variant-price${canViewPrices ? '' : ' price-obscured'}`} aria-label={canViewPrices ? undefined : 'قیمت پس از تأیید حساب نمایش داده می‌شود'}>
                    {hasRealDiscount(v.price, v.oldPrice) && (
                      <span className="card-old-price"><Price amount={v.oldPrice!} /></span>
                    )}
                    <div className="card-price">{v.price > 0 ? <Price amount={v.price} /> : 'قیمت‌گذاری نشده'}</div>
                  </div>}

                  {whButtonsV.length > 0 && (
                    <div className="warehouse-section">
                      {whButtonsV.map((wh) => {
                        const n = stockFor(v, wh);
                        const cartKey = `${v.productId}::${wh}`;
                        const cartLine = cartLines.find((l) => l.key === cartKey);
                        const qty = cartLine ? cartLine.qty : 0;
                        return (
                          <div key={wh} className={`warehouse-row${n === 1 ? ' urgent-stock' : ''}`}>
                            <div className="wh-details">
                              <span className={`wh-badge ${wh}`}>{WAREHOUSE_LABELS[wh]}</span>
                            </div>
                            {qty > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--tamas-surface)', border: 'var(--tamas-border-w, 1px) solid var(--tamas-border)', borderRadius: 'var(--tamas-radius-pill, 980px)', padding: "2px var(--ds-space-1)" }}>
                                <button type="button" className="add-wh-btn" style={{ background: 'transparent', border: 'none', color: 'var(--tamas-fg)', width: 24, height: 24, fontSize: "var(--ds-text-lg)" }} aria-label="کاهش تعداد" title="کاهش" onClick={() => onUpdateQty(cartKey, qty - 1)}>-</button>
                                <span style={{ fontSize: "var(--ds-text-caption)", fontWeight: 700, minWidth: 16, textAlign: 'center', color: 'var(--tamas-fg)' }}>{qty}</span>
                                <button type="button" className="add-wh-btn" style={{ width: 24, height: 24, fontSize: "var(--ds-text-lg)" }} aria-label="افزایش تعداد" title="افزایش" onClick={() => onAdd(v, wh)}>+</button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="add-wh-btn"
                                onClick={() => onAdd(v, wh)}
                                aria-label={`افزودن از ${WAREHOUSE_LABELS[wh]}`}
                                title={`افزودن از ${WAREHOUSE_LABELS[wh]}`}
                              >
                                +
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {whButtonsV.length === 0 && <span className="catalog-unavailable">{unavailable ? 'ناموجود' : 'قیمت‌گذاری نشده'}</span>}
                </div>
              );
            })}
          </div>
        </div>

        <ProductImageGallery key={`${group.key}:${selectedVariant.productId}:list`} images={images} title={group.title} mode="list" onPreview={onPreview} />
      </article>
    );
  }

  return (
    <article className={`product-card${isPromo ? ' is-promotion' : ''}`}>
      {isPromo && (
        <div className="promo-tag">
          <span className="star-icon"><Icon name="star-fill" /></span> هرکی میگه ۱۶ نیست،فقط تا ۲۰ام
        </div>
      )}

      <button
        type="button"
        className={`card-fav-btn${isFav ? ' active' : ''}`}
        onClick={() => setIsFav(!isFav)}
        aria-label={isFav ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
        aria-pressed={isFav}
        title={isFav ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
      >
        <Icon name={isFav ? 'heart-fill' : 'heart'} />
      </button>

      <ProductImageGallery key={`${group.key}:${selectedVariant.productId}:grid`} images={images} title={group.title} mode="grid" onPreview={onPreview} />

      <div className="product-card-content">
        <div className={`card-title ${titleClass}`}>
          {isPromo && <span className="title-star"><Icon name="star-fill" /> </span>}
          <Link className="card-title-link" to={`/p/${selectedVariant.productId}`}>{group.title}</Link>
        </div>

        <div className="card-meta-row">
          <div className="card-meta">
            {selectedVariant.rating != null && (
              <span className="card-rating"><span aria-hidden="true">★</span> {(selectedVariant.rating / 100).toLocaleString('fa-IR', { maximumFractionDigits: 2 })}</span>
            )}
            <span>
              برند: <b className="ltr-inline">{brand}</b>
            </span>

            {displayVariants.length > 1 ? (
              <>
                <div className="color-swatches" aria-label="رنگ‌های موجود">
                  {displayVariants.map((v, i) => (
                    <button
                      key={v.productId}
                      type="button"
                      className={`color-swatch-dot${i === activeIndex ? ' active' : ''}`}
                      style={{ background: resolveProductColor(v, colorMap) }}
                      onClick={() => setSelectedIndex(i)}
                      title={`${v.color || v.colorEn || 'رنگ'}${canViewPrices && !isProductUnavailable(v) && v.price ? ` — ${formatMoney(v.price)}` : ''}`}
                      aria-label={`انتخاب رنگ ${v.color || v.colorEn}`}
                    />
                  ))}
                </div>
                <span className="color-picker">
                  <span className="color-dot" style={{ background: resolveProductColor(selectedVariant, colorMap) }} aria-hidden />
                  {displayVariants.length > 5 ? <AnimatedDropdown
                    variant="storefront"
                    className="color-select-searchable"
                    buttonClassName="color-select-searchable__button"
                    value={String(activeIndex)}
                    onChange={(next) => setSelectedIndex(Number(next))}
                    ariaLabel="انتخاب رنگ"
                    options={displayVariants.map((v, i) => ({
                      value: String(i),
                      label: `${v.color || 'اصلی'}${canViewPrices && !isProductUnavailable(v) && v.price ? ` — ${formatMoney(v.price)}` : ''}${v.sku ? ` (${v.sku})` : ''}`,
                    }))}
                  /> : <select
                    className="color-select"
                    value={activeIndex}
                    onChange={(e) => setSelectedIndex(Number(e.target.value))}
                    aria-label="انتخاب رنگ"
                  >
                    {displayVariants.map((v, i) => (
                      <option key={v.productId} value={i}>
                        {v.color || 'اصلی'}{canViewPrices && !isProductUnavailable(v) && v.price ? ` — ${formatMoney(v.price)}` : ''}{v.sku ? ` (${v.sku})` : ''}
                      </option>
                    ))}
                  </select>}
                  <span className="color-count">{formatNumber(displayVariants.length)} رنگ</span>
                </span>
              </>
            ) : (
              <span>
                رنگ: {selectedVariant.color || '-'}
              </span>
            )}

            </div>

          <div className="sell-types">
            {sellTypes(selectedVariant.sellType).map((t) => (
              <span key={t.label} className="sell-badge">
                <Icon name={t.icon} /> {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card-price-box">
        {!selectedUnavailable && <div className={canViewPrices ? undefined : 'price-obscured'} style={{ marginBottom: "var(--ds-space-2)" }} aria-label={canViewPrices ? undefined : 'قیمت پس از تأیید حساب نمایش داده می‌شود'}>
          {hasRealDiscount(selectedVariant.price, selectedVariant.oldPrice) && (
            <span className="card-old-price"><Price amount={selectedVariant.oldPrice!} /></span>
          )}
          <div className="card-price">{selectedVariant.price > 0 ? <Price amount={selectedVariant.price} /> : 'قیمت‌گذاری نشده'}</div>
        </div>}

        {whButtons.length > 0 && (
          <div className="warehouse-section" style={{ marginBottom: "var(--ds-space-2)" }}>
            {whButtons.map((wh) => {
              const n = stockFor(selectedVariant, wh);
              const cartKey = `${selectedVariant.productId}::${wh}`;
              const cartLine = cartLines.find((l) => l.key === cartKey);
              const qty = cartLine ? cartLine.qty : 0;
              return (
                <div key={wh} className={`warehouse-row${n === 1 ? ' urgent-stock' : ''}`}>
                  <div className="wh-details">
                    <span className={`wh-badge ${wh}`}>{WAREHOUSE_LABELS[wh]}</span>
                    {n === 1 && (
                      <span className="wh-count">
                        <b className="stock-warn">تنها ۱ عدد باقیست!</b>
                      </span>
                    )}
                  </div>
                  {qty > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--tamas-surface)', border: 'var(--tamas-border-w, 1px) solid var(--tamas-border)', borderRadius: 'var(--tamas-radius-pill, 980px)', padding: "2px var(--ds-space-1)" }}>
                      <button type="button" className="add-wh-btn" style={{ background: 'transparent', border: 'none', color: 'var(--tamas-fg)', width: 26, height: 26, fontSize: "var(--ds-text-lead)" }} aria-label="کاهش تعداد" title="کاهش" onClick={() => onUpdateQty(cartKey, qty - 1)}>-</button>
                      <span style={{ fontSize: "var(--ds-text-sm)", fontWeight: 700, minWidth: 20, textAlign: 'center', color: 'var(--tamas-fg)' }}>{qty}</span>
                      <button type="button" className="add-wh-btn" style={{ width: 26, height: 26, fontSize: "var(--ds-text-lg)" }} aria-label="افزایش تعداد" title="افزایش" onClick={() => onAdd(selectedVariant, wh)}>+</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="add-wh-btn"
                      onClick={() => onAdd(selectedVariant, wh)}
                      aria-label={`افزودن از ${WAREHOUSE_LABELS[wh]}`}
                      title={`افزودن از ${WAREHOUSE_LABELS[wh]}`}
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {whButtons.length === 0 && <div className="catalog-unavailable">{selectedUnavailable ? 'ناموجود' : 'قیمت‌گذاری نشده'}</div>}

        <Link
          to={`/p/${selectedVariant.productId}`}
          className="btn"
          style={{ width: '100%', fontSize: '11.5px', padding: '5px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Icon name="eye" /> مشاهده جزئیات
        </Link>
      </div>
    </article>
  );
}, areProductCardPropsEqual);

