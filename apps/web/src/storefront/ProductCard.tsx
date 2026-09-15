import { memo, useMemo, useState } from 'react';
import type { ProductDTO, ProductGroupDTO, Warehouse } from '@tamas/shared';
import { WAREHOUSE_LABELS, formatMoney, formatNumber, hasRealDiscount } from '@tamas/shared';
import { Icon } from '../components/Icon';
import { stockFor } from '../store/cart';

interface Props {
  group: ProductGroupDTO;
  colorMap: Map<string, string>;
  canViewPrices: boolean;
  viewMode?: 'grid' | 'list';
  onAdd: (product: ProductDTO, warehouse: Warehouse) => void;
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
  return 'var(--primary)';
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
  return hasSplit ? WAREHOUSE_ORDER : ['site'];
}

function productTitleClass(title: string): string {
  const len = Array.from(String(title || '').trim()).length;
  if (len > 105) return 'title-very-long';
  if (len > 65) return 'title-long';
  return '';
}

export const ProductCard = memo(function ProductCard({ group, colorMap, canViewPrices, viewMode = 'grid', onAdd, onPreview }: Props) {
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
            <div className="product-title">
              {isPromo && <span className="title-star"><Icon name="star-fill" /> </span>}
              {group.title}
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
                      <span className="card-old-price">{formatNumber(v.oldPrice!)} تومان</span>
                    )}
                    <div className="card-price">{formatMoney(v.price)}</div>
                  </div>

                  <div className="warehouse-section">
                    {whButtonsV.map((wh) => {
                      const n = stockFor(v, wh);
                      return (
                        <div key={wh} className={`warehouse-row${n === 1 ? ' urgent-stock' : ''}`}>
                          <div className="wh-details">
                            <span className={`wh-badge ${wh}`}>{WAREHOUSE_LABELS[wh]}</span>
                          </div>
                          <button
                            type="button"
                            className="add-wh-btn"
                            disabled={n < 1}
                            onClick={() => onAdd(v, wh)}
                            title={n < 1 ? 'ناموجود' : `افزودن از ${WAREHOUSE_LABELS[wh]}`}
                          >
                            +
                          </button>
                        </div>
                      );
                    })}
                  </div>
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
          {group.title}
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

            {selectedVariant.sku && (
              <span className="card-sku">
                کد: <b className="ltr-inline">{selectedVariant.sku}</b>
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
            <span className="card-old-price">{formatNumber(selectedVariant.oldPrice!)} تومان</span>
          )}
          <div className="card-price">{formatMoney(selectedVariant.price)}</div>
        </div>

        <div className="warehouse-section" style={{ marginBottom: 8 }}>
          {whButtons.map((wh) => {
            const n = stockFor(selectedVariant, wh);
            return (
              <div key={wh} className={`warehouse-row${n === 1 ? ' urgent-stock' : ''}`}>
                <div className="wh-details">
                  <span className={`wh-badge ${wh}`}>{WAREHOUSE_LABELS[wh]}</span>
                  {n === 1 && <span className="wh-count"><b className="stock-warn">تنها ۱ عدد باقیست!</b></span>}
                </div>
                <button
                  type="button"
                  className="add-wh-btn"
                  disabled={n < 1}
                  onClick={() => onAdd(selectedVariant, wh)}
                  title={n < 1 ? 'ناموجود' : `افزودن از ${WAREHOUSE_LABELS[wh]}`}
                >
                  +
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="btn"
          style={{ width: '100%', fontSize: '11.5px', padding: '5px' }}
          onClick={() => onPreview(image)}
        >
          <Icon name="eye" /> مشاهده جزئیات
        </button>
      </div>
    </article>
  );
});

