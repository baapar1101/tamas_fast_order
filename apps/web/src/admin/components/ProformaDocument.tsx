import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { OrderDTO } from '@tamas/shared';
import { ORDER_STATUS_LABELS, WAREHOUSE_LABELS, formatNumber } from '@tamas/shared';
import { waitForImages } from '../../lib/images';
import './proforma.css';

const paymentStatusLabel = (status: OrderDTO['paymentStatus']) => {
  if (status === 'paid') return 'پرداخت‌شده';
  if (status === 'pending') return 'در انتظار پرداخت';
  return 'پرداخت‌نشده';
};

const paymentMethodLabel = (method: string | null) => {
  const labels: Record<string, string> = {
    card_to_card: 'کارت‌به‌کارت / واریز به حساب',
    wallet: 'کیف پول تماس مارکت',
    credit: 'اعتباری',
    cheque_2m: 'چک دوماهه',
    cheque_4m: 'چک چهارماهه',
    weekly_credit: 'اعتبار هفتگی',
    online: 'پرداخت آنلاین',
    cash: 'نقدی',
  };
  return method ? labels[method] ?? method : 'ثبت نشده';
};

const money = (value: number) => `${formatNumber(value)} تومان`;

export function ProformaDocument({ order }: { order: OrderDTO }) {
  const createdAt = new Date(order.createdAt);

  return (
    <article className="proforma-sheet" dir="rtl">
      <header className="proforma-head">
        <div className="proforma-brand">
          <img src="/logo.png" alt="تماس مارکت" />
          <div>
            <strong>تماس مارکت</strong>
            <span>مرجع تخصصی فروش عمده کالای دیجیتال</span>
          </div>
        </div>
        <div className="proforma-title-block">
          <h1>پیش‌فاکتور فروش</h1>
          <span>شماره: PF-{order.orderCode}</span>
        </div>
      </header>

      <section className="proforma-meta-grid">
        <div><span>تاریخ صدور</span><strong>{createdAt.toLocaleDateString('fa-IR')}</strong></div>
        <div><span>ساعت</span><strong>{createdAt.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</strong></div>
        <div><span>کد سفارش</span><strong dir="ltr">#{order.orderCode}</strong></div>
        <div><span>وضعیت سفارش</span><strong>{ORDER_STATUS_LABELS[order.status]}</strong></div>
      </section>

      <section className="proforma-party">
        <h2>مشخصات خریدار</h2>
        <div className="proforma-party-grid">
          <p><span>نام خریدار:</span><strong>{order.customerName || 'مشتری تماس مارکت'}</strong></p>
          <p><span>فروشگاه:</span><strong>{order.storeName || '—'}</strong></p>
          <p><span>شماره همراه:</span><strong dir="ltr">{order.phone || '—'}</strong></p>
          <p><span>روش پرداخت:</span><strong>{paymentMethodLabel(order.paymentMethod)}</strong></p>
          <p className="proforma-party-address"><span>آدرس:</span><strong>{order.address || '—'}</strong></p>
        </div>
      </section>

      <table className="proforma-items">
        <thead>
          <tr>
            <th>ردیف</th>
            <th>شرح کالا</th>
            <th>کد کالا</th>
            <th>انبار</th>
            <th>تعداد</th>
            <th>قیمت واحد</th>
            <th>مبلغ</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={item.id || `${item.productId}-${item.warehouse}-${index}`}>
              <td>{formatNumber(index + 1)}</td>
              <td className="proforma-item-title">
                <strong>{item.title}</strong>
                {item.color && <small>رنگ: {item.color}</small>}
              </td>
              <td dir="ltr">{item.sku || item.productId}</td>
              <td>{WAREHOUSE_LABELS[item.warehouse]}</td>
              <td>{formatNumber(item.qty)}</td>
              <td>{money(item.price)}</td>
              <td>{money(item.price * item.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="proforma-summary">
        <div className="proforma-summary-note">
          <strong>وضعیت پرداخت: {paymentStatusLabel(order.paymentStatus)}</strong>
          <span>اعتبار قیمت و موجودی این پیش‌فاکتور منوط به تأیید نهایی فروشگاه است.</span>
          {order.note && <span>توضیحات: {order.note}</span>}
        </div>
        <div className="proforma-total">
          <span>جمع تعداد</span><strong>{formatNumber(order.quantity)} عدد</strong>
          <span>مبلغ کل</span><strong>{money(order.total)}</strong>
        </div>
      </section>

      <footer className="proforma-footer">
        <p>این سند پیش‌فاکتور است و به‌تنهایی ارزش فاکتور رسمی یا رسید پرداخت ندارد.</p>
        <span>tamasmarket.com</span>
      </footer>
    </article>
  );
}

export async function downloadProformaPdf(order: OrderDTO): Promise<void> {
  const stage = document.createElement('div');
  stage.className = 'proforma-pdf-stage';
  document.body.appendChild(stage);
  const root = createRoot(stage);

  try {
    flushSync(() => root.render(<ProformaDocument order={order} />));
    await document.fonts?.ready;
    await waitForImages(stage);
    const { default: html2pdf } = await import('html2pdf.js');
    const sheet = stage.querySelector<HTMLElement>('.proforma-sheet');
    if (!sheet) throw new Error('قالب پیش‌فاکتور آماده نشد.');

    await html2pdf()
      .set({
        margin: 0,
        filename: `proforma-${order.orderCode}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(sheet)
      .save();
  } finally {
    root.unmount();
    stage.remove();
  }
}
