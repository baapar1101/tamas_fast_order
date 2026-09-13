import { WAREHOUSE_LABELS, formatMoney, formatNumber } from '@tamas/shared';
import { cartCount, cartTotal, useCart } from '../store/cart';
import { Icon } from '../components/Icon';

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
      <div className="cart-title">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="bag" /> سبد خرید
        </span>
        {count > 0 && <span className="badge brand">{formatNumber(count)} عدد</span>}
        {lines.length > 0 && (
          <button type="button" className="btn ghost sm" onClick={clear}>
            خالی کردن
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="cart-empty">
          سبد خرید شما خالی است
        </div>
      ) : (
        <>
          <div className="cart-items">
            {lines.map((line) => (
              <div className="cart-item" key={line.key}>
                <div className="cart-item-title">{line.title}</div>
                <div className="cart-item-meta">
                  <span>{line.color || 'بدون رنگ'}</span>
                  <span>{WAREHOUSE_LABELS[line.warehouse]}</span>
                </div>
                <div className="qty">
                  <button type="button" onClick={() => setQty(line.key, line.qty + 1)} disabled={line.qty >= line.maxStock} aria-label="افزایش">
                    +
                  </button>
                  <span>{formatNumber(line.qty)}</span>
                  <button type="button" onClick={() => setQty(line.key, line.qty - 1)} aria-label="کاهش">
                    −
                  </button>
                  <span style={{ marginInlineStart: 'auto', fontWeight: 800 }}>{formatMoney(line.price * line.qty)}</span>
                  <button type="button" className="btn ghost sm" onClick={() => remove(line.key)} aria-label="حذف">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="total">
            <span>جمع کل:</span>
            <span style={{ color: 'var(--primary)' }}>{formatMoney(total)}</span>
          </div>

          <button type="button" className="btn primary checkout" onClick={onCheckout}>
            ثبت سفارش
          </button>
        </>
      )}
    </aside>
  );
}
