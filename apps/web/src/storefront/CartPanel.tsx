import { useState } from 'react';
import { WAREHOUSE_LABELS, formatMoney, formatNumber } from '@tamas/shared';
import { Price } from '../components/Price';
import { PrintInvoiceLayout, type PrintInvoiceItem } from '../components/PrintInvoiceLayout';
import { cartCount, cartTotal, useCart } from '../store/cart';
import { Icon } from '../components/Icon';

interface Props {
  onCheckout: () => void;
  canViewPrices: boolean;
}

export function CartPanel({ onCheckout, canViewPrices }: Props) {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);

  const total = cartTotal(lines);
  const count = cartCount(lines);
  const [notes, setNotes] = useState('');

  const WHOLESALE_THRESHOLD = 5_000_000;
  const progressPercent = Math.min(100, Math.floor((total / WHOLESALE_THRESHOLD) * 100));

  const handlePrint = () => {
    window.print();
  };

  const printItems: PrintInvoiceItem[] = lines.map(l => ({
    key: l.key,
    title: l.title,
    color: l.color,
    warehouse: l.warehouse,
    qty: l.qty,
    price: l.price
  }));

  const handleWhatsApp = () => {
    let text = `سلام، درخواست ثبت سفارش دارم:\n\n`;
    lines.forEach(l => {
      text += `- ${l.title} (${l.color || 'بدون رنگ'} - ${WAREHOUSE_LABELS[l.warehouse]}): ${l.qty} عدد\n`;
    });
    if (canViewPrices) text += `\nجمع کل: ${formatMoney(total)}\n`;
    else text += `\nقیمت پس از تأیید حساب همکاری اعلام می‌شود.\n`;
    if (notes) text += `\nتوضیحات: ${notes}\n`;
    window.open(`https://wa.me/989901046596?text=${encodeURIComponent(text)}`, '_blank');
  };

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
          <div className="wholesale-progress" style={{ margin: '12px 0 14px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: '#334155' }}>
              <span>حد نصاب سفارش عمده</span>
              <span>{progressPercent}%</span>
            </div>
            <div style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: progressPercent >= 100 ? '#10b981' : '#0ea5e9', transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
              حداقل مبلغ سفارش: <Price amount={WHOLESALE_THRESHOLD} />
            </div>
          </div>

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
                  <span className={canViewPrices ? undefined : 'price-obscured'} style={{ marginInlineStart: 'auto', fontWeight: 800, color: 'var(--tamas-accent)' }}><Price amount={line.price * line.qty} /></span>
                  <button type="button" className="btn ghost sm" style={{ color: 'var(--danger)' }} onClick={() => remove(line.key)} aria-label="حذف">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="total" style={{ borderTop: '2px dashed #e2e8f0', paddingTop: '16px', marginTop: '8px' }}>
            <span style={{ fontWeight: 800, fontSize: '16px' }}>مجموع فاکتور</span>
            <span className={canViewPrices ? undefined : 'price-obscured'} style={{ color: 'var(--tamas-accent)', fontWeight: 900, fontSize: '18px' }}><Price amount={total} /></span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            <textarea 
              placeholder="توضیحات سفارش (اختیاری)..." 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}
            />
            <button type="button" className="btn primary checkout" onClick={onCheckout} style={{ padding: '12px', fontSize: '14px', borderRadius: '8px' }}>
              ثبت سفارش نهایی
            </button>
            <button type="button" className="btn" onClick={handleWhatsApp} style={{ backgroundColor: '#10b981', color: 'white', padding: '12px', fontSize: '14px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none' }}>
              ارسال سفارش در واتساپ
            </button>
            <button type="button" className="btn ghost" onClick={handlePrint} style={{ padding: '10px', fontSize: '13px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid #cbd5e1', color: '#475569' }}>
              پیش‌فاکتور چاپی
            </button>
          </div>
        </>
      )}

      {/* Hidden print layout, revealed only during window.print() via global CSS */}
      <PrintInvoiceLayout
        title="پیش‌فاکتور فروش"
        items={printItems}
        total={total}
      />
    </aside>
  );
}
