import { memo, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProductDTO, ProductGroupDTO, Warehouse } from '@tamas/shared';
import { WAREHOUSE_LABELS, formatMoney, formatNumber, hasRealDiscount } from '@tamas/shared';
import { Price } from '../components/Price';
import { Icon } from '../components/Icon';
import { stockFor } from '../store/cart';

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

/** Resolves a swatch colour: explicit hex first, then the Colors table, then brand teal. */
function swatchColor(product: ProductDTO, colorMap: Map<string, string>): string {
  const direct = product.colorCode?.trim();
  if (direct && /^#?[0-9a-f]{3,8}$/i.test(direct)) return direct.startsWith('#') ? direct : `#${direct}`;

  for (const candidate of [product.colorEn, product.color]) {
    const key = candidate?.trim().toLowerCase();
    if (!key) continue;
    const hit = colorMap.get(key);
    if (hit) return hit;
  }
  return 'var(--tamas-accent)';
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

export const ProductCard = memo(function ProductCard({ group, colorMap, canViewPrices, viewMode = 'grid', cartLines, onAdd, onUpdateQty, onPreview }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFav, setIsFav] = useState(false);

  const selectedVariant = group.variants[selectedIndex] || group.variants[0];
  if (!selectedVariant) return null;

  const brand = selectedVariant.brandFaName || selectedVariant.brandName || 'متفرقه';
  const rawImage = group.imageUrl || selectedVariant.imageUrl;
  const image = rawImage
    ? rawImage.startsWith('http') || rawImage.startsWith('/')
      ? rawImage
      : `/uploads/${rawImage}`
    : '/logo.png';
  const isPromo = Boolean(group.promotion || selectedVariant.promotion);
  const titleClass = productTitleClass(group.title);
  const whButtons = getWarehouseButtons(selectedVariant);

  if (viewMode === 'list') {
    return (
      <article className={`product-accordion${isPromo ? ' is-promotion' : ''}`}>
        {isPromo && (
          <div className="promo-tag">
            <span className="star-icon"><Icon name="star-fill" /></span> پیشنهاد ویژه
          </div>
        )}

        <div className="list-product-content">
          <div className="product-head">
            <div className={`product-title ${titleClass}`}>
              {isPromo && <span className="title-star"><Icon name="star-fill" /> </span>}
              <Link className="product-title-link" to={`/p/${selectedVariant.productId}`}>{group.title}</Link>
            </div>
          </div>

          <div className="list-variants">
            {group.variants.map((v) => {
              const whButtonsV = getWarehouseButtons(v);
              const types = sellTypes(v.sellType);
              return (
                <div key={v.productId} className="variant">
                  <div className="variant-info">
                    <div className="color-title">
                      <span className="color-dot" style={{ background: swatchColor(v, colorMap) }} aria-hidden />
                      <span>{v.color || v.colorEn || 'مشکی'}</span>
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

                  <div className={`variant-price${canViewPrices ? '' : ' price-obscured'}`} aria-label={canViewPrices ? undefined : 'قیمت پس از تأیید حساب نمایش داده می‌شود'}>
                    {hasRealDiscount(v.price, v.oldPrice) && (
                      <span className="card-old-price"><Price amount={v.oldPrice!} /></span>
                    )}
                    <div className="card-price"><Price amount={v.price} /></div>
                  </div>

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
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--tamas-surface)', border: 'var(--tamas-border-w, 1px) solid var(--tamas-border)', borderRadius: 'var(--tamas-radius-pill, 980px)', padding: '2px 4px' }}>
                                <button type="button" className="add-wh-btn" style={{ background: 'transparent', border: 'none', color: 'var(--tamas-fg)', width: 24, height: 24, fontSize: 16 }} onClick={() => onUpdateQty(cartKey, qty - 1)}>-</button>
                                <span style={{ fontSize: 12, fontWeight: 700, minWidth: 16, textAlign: 'center', color: 'var(--tamas-fg)' }}>{qty}</span>
                                <button type="button" className="add-wh-btn" style={{ width: 24, height: 24, fontSize: 16 }} onClick={() => onAdd(v, wh)}>+</button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="add-wh-btn"
                                onClick={() => onAdd(v, wh)}
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
                </div>
              );
            })}
          </div>
        </div>

        <img
          className="product-thumb"
          src={image}
          alt={group.title}
          loading="lazy"
          decoding="async"
          onClick={() => onPreview(image)}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/logo.png';
          }}
          style={{ cursor: 'zoom-in' }}
        />
      </article>
    );
  }

  return (
    <article className={`product-card${isPromo ? ' is-promotion' : ''}`}>
      {isPromo && (
        <div className="promo-tag">
          <span className="star-icon"><Icon name="star-fill" /></span> پیشنهاد ویژه
        </div>
      )}

      <button
        type="button"
        className={`card-fav-btn${isFav ? ' active' : ''}`}
        onClick={() => setIsFav(!isFav)}
        aria-label="افزودن به علاقه‌مندی‌ها"
      >
        <Icon name={isFav ? 'heart-fill' : 'heart'} />
      </button>

      <img
        className="card-thumb"
        src={image}
        alt={group.title}
        loading="lazy"
        decoding="async"
        onClick={() => onPreview(image)}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = '/logo.png';
        }}
      />

      <div style={{ minWidth: 0 }}>
        <div className={`card-title ${titleClass}`}>
          {isPromo && <span className="title-star"><Icon name="star-fill" /> </span>}
          <Link className="card-title-link" to={`/p/${selectedVariant.productId}`}>{group.title}</Link>
        </div>

        <div className="card-meta-row">
          <div className="card-meta">
            <span>
              برند: <b className="ltr-inline">{brand}</b>
            </span>

            {group.variants.length > 1 ? (
              <>
                <div className="color-swatches" aria-label="رنگ‌های موجود">
                  {group.variants.map((v, i) => (
                    <button
                      key={v.productId}
                      type="button"
                      className={`color-swatch-dot${i === selectedIndex ? ' active' : ''}`}
                      style={{ background: swatchColor(v, colorMap) }}
                      onClick={() => setSelectedIndex(i)}
                      title={`${v.color || v.colorEn || 'رنگ'}${canViewPrices && v.price ? ` — ${formatMoney(v.price)}` : ''}`}
                      aria-label={`انتخاب رنگ ${v.color || v.colorEn}`}
                    />
                  ))}
                </div>
                <span className="color-picker">
                  <span className="color-dot" style={{ background: swatchColor(selectedVariant, colorMap) }} aria-hidden />
                  <select
                    className="color-select"
                    value={selectedIndex}
                    onChange={(e) => setSelectedIndex(Number(e.target.value))}
                    aria-label="انتخاب رنگ"
                  >
                    {group.variants.map((v, i) => (
                      <option key={v.productId} value={i}>
                        {v.color || 'اصلی'}{canViewPrices && v.price ? ` — ${formatMoney(v.price)}` : ''}{v.sku ? ` (${v.sku})` : ''}
                      </option>
                    ))}
                  </select>
                  <span className="color-count">{formatNumber(group.variants.length)} رنگ</span>
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
        <div className={canViewPrices ? undefined : 'price-obscured'} style={{ marginBottom: 8 }} aria-label={canViewPrices ? undefined : 'قیمت پس از تأیید حساب نمایش داده می‌شود'}>
          {hasRealDiscount(selectedVariant.price, selectedVariant.oldPrice) && (
            <span className="card-old-price"><Price amount={selectedVariant.oldPrice!} /></span>
          )}
          <div className="card-price"><Price amount={selectedVariant.price} /></div>
        </div>

        {whButtons.length > 0 && (
          <div className="warehouse-section" style={{ marginBottom: 8 }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--tamas-surface)', border: 'var(--tamas-border-w, 1px) solid var(--tamas-border)', borderRadius: 'var(--tamas-radius-pill, 980px)', padding: '2px 4px' }}>
                      <button type="button" className="add-wh-btn" style={{ background: 'transparent', border: 'none', color: 'var(--tamas-fg)', width: 26, height: 26, fontSize: 18 }} onClick={() => onUpdateQty(cartKey, qty - 1)} title="کاهش">-</button>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: 'center', color: 'var(--tamas-fg)' }}>{qty}</span>
                      <button type="button" className="add-wh-btn" style={{ width: 26, height: 26, fontSize: 16 }} onClick={() => onAdd(selectedVariant, wh)} title="افزایش">+</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="add-wh-btn"
                      onClick={() => onAdd(selectedVariant, wh)}
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
});

