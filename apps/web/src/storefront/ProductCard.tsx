import { memo, useMemo } from 'react';
import type { ProductDTO, ProductGroupDTO, Warehouse } from '@tamas/shared';
import { WAREHOUSE_LABELS, formatMoney, formatNumber, hasRealDiscount } from '@tamas/shared';
import { stockFor } from '../store/cart';

interface Props {
  group: ProductGroupDTO;
  colorMap: Map<string, string>;
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
function sellTypes(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/[,،;|]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);
}

const WAREHOUSE_ORDER: Warehouse[] = ['kerman', 'tehran'];

function VariantRow({
  product,
  colorMap,
  onAdd,
}: {
  product: ProductDTO;
  colorMap: Map<string, string>;
  onAdd: (product: ProductDTO, warehouse: Warehouse) => void;
}) {
  const split = product.kermanStock + product.tehranStock > 0;
  const buttons: Warehouse[] = split ? WAREHOUSE_ORDER : ['site'];
  const types = sellTypes(product.sellType);

  return (
    <div className="variant">
      <div className="variant-info">
        <span className="color-dot" style={{ background: swatchColor(product, colorMap) }} aria-hidden />
        <span>{product.color || product.colorEn || 'بدون رنگ'}</span>
      </div>

      <div className="variant-price">
        <span className="current-price">{formatMoney(product.price)}</span>
        {hasRealDiscount(product.price, product.oldPrice) && (
          <span className="old">{formatNumber(product.oldPrice!)}</span>
        )}
      </div>

      <div className="warehouses">
        {buttons.map((wh) => {
          const n = stockFor(product, wh);
          return (
            <button
              key={wh}
              type="button"
              className="wh-btn"
              disabled={n < 1}
              onClick={() => onAdd(product, wh)}
              title={n < 1 ? 'ناموجود' : `افزودن از ${WAREHOUSE_LABELS[wh]}`}
            >
              <span>+ {WAREHOUSE_LABELS[wh]}</span>
              <span className="n">({formatNumber(n)})</span>
            </button>
          );
        })}
      </div>

      <div className="sell-types">
        {types.map((t) => (
          <span key={t} className="badge brand">
            {t}
          </span>
        ))}
        {product.warranty && <span className="badge">{product.warranty}</span>}
      </div>
    </div>
  );
}

export const ProductCard = memo(function ProductCard({ group, colorMap, onAdd, onPreview }: Props) {
  const first = group.variants[0];
  const brand = first?.brandFaName || first?.brandName;
  const image = group.imageUrl || first?.imageUrl || '/logo.png';
  const colorCount = useMemo(() => new Set(group.variants.map((v) => v.color)).size, [group.variants]);

  return (
    <article className={`product${group.promotion ? ' is-promotion' : ''}`}>
      {group.promotion && <div className="promo-tag">⭐ پیشنهاد ویژه</div>}

      <div className="product-head">
        <div className="thumb-box">
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
          />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="product-title">{group.title}</h3>
          <div className="product-meta">
            {brand && <span className="badge">{brand}</span>}
            {first?.categoryFaName && <span className="badge">{first.categoryFaName}</span>}
            {colorCount > 1 && <span className="badge">{formatNumber(colorCount)} رنگ</span>}
            {first?.sku && <span className="badge ltr-inline">{first.sku}</span>}
          </div>
        </div>
      </div>

      <div className="variants">
        {group.variants.map((v) => (
          <VariantRow key={v.productId} product={v} colorMap={colorMap} onAdd={onAdd} />
        ))}
      </div>
    </article>
  );
});
