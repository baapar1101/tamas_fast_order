import { WAREHOUSE_LABELS, formatMoney, formatNumber } from '@tamas/shared';
import { cartCount, cartTotal, useCart } from '../store/cart';

interface Props {
  onCheckout: () => void;
}

export function CartPanel({ onCheckout }: Props) {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);

  const total = cartTotal(lines);
  const count = cartCount(lines);

  return (
    <aside className="cart" id="cart">
      <div className="row" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>سبد خرید</h3>
        {count > 0 && <span className="badge brand">{formatNumber(count)} عدد</span>}
        <span className="spacer" />
        {lines.length > 0 && (
          <button type="button" className="btn ghost sm" onClick={clear}>
            خالی کردن
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="empty" style={{ padding: '32px 8px' }}>
          لیست خرید شما خالی است
        </div>
      ) : (
        <>
          <div className="cart-lines">
            {lines.map((line) => (
              <div className="cart-line" key={line.key}>
                <img
                  src={line.imageUrl || '/logo.png'}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/logo.png';
                  }}
                />
                <div className="cart-line-body">
                  <div className="cart-line-title">{line.title}</div>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {line.color && <span className="badge">{line.color}</span>}
                    <span className="badge">{WAREHOUSE_LABELS[line.warehouse]}</span>
                  </div>
                  <div className="row">
                    <div className="qty">
                      <button type="button" onClick={() => setQty(line.key, line.qty + 1)} disabled={line.qty >= line.maxStock} aria-label="افزایش">
                        +
                      </button>
                      <span>{formatNumber(line.qty)}</span>
                      <button type="button" onClick={() => setQty(line.key, line.qty - 1)} aria-label="کاهش">
                        −
                      </button>
                    </div>
                    <span className="spacer" />
                    <strong style={{ fontSize: 12.5 }}>{formatMoney(line.price * line.qty)}</strong>
                    <button type="button" className="btn ghost sm" onClick={() => remove(line.key)} aria-label="حذف">
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-total">
            <span>جمع کل</span>
            <span style={{ color: 'var(--brand-600)' }}>{formatMoney(total)}</span>
          </div>

          <button type="button" className="btn primary block" style={{ marginTop: 12 }} onClick={onCheckout}>
            ثبت سفارش
          </button>
        </>
      )}
    </aside>
  );
}
