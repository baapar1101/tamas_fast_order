import { createPortal } from 'react-dom';
import { WAREHOUSE_LABELS, formatNumber } from '@tamas/shared';
import { Price } from './Price';

export interface PrintInvoiceItem {
  key: string;
  title: string;
  color?: string | null;
  warehouse: string;
  qty: number;
  price: number;
}

interface Props {
  title: string;
  items: PrintInvoiceItem[];
  total: number;
  customerName?: string;
  customerPhone?: string;
  orderId?: string;
  date?: string;
  active?: boolean;
  showStamp?: boolean;
}

export function PrintInvoiceLayout({ title, items, total, customerName, customerPhone, orderId, date, active = true, showStamp = true }: Props) {
  return createPortal(
    <div className={`print-invoice-layout${active ? ' is-print-target' : ''}`}>
      <div className="invoice-header">
        <div className="invoice-header-right">
          <h2>{title}</h2>
          <div className="invoice-meta">
            {orderId && <div>شماره سفارش: {orderId}</div>}
            <div>تاریخ: {date || new Date().toLocaleDateString('fa-IR')}</div>
          </div>
        </div>
        <div className="invoice-header-center">
          <img src="/logo.png" alt="Logo" className="invoice-logo" onError={(e) => e.currentTarget.style.display = 'none'} />
        </div>
        <div className="invoice-header-left">
          {customerName && <div>خریدار: {customerName}</div>}
          {customerPhone && <div>تلفن: {customerPhone}</div>}
        </div>
      </div>

      <table className="invoice-table">
        <thead>
          <tr>
            <th>ردیف</th>
            <th>شرح کالا</th>
            <th>رنگ</th>
            <th>انبار</th>
            <th>تعداد</th>
            <th>قیمت واحد</th>
            <th>قیمت کل</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.key}>
              <td>{index + 1}</td>
              <td>{item.title}</td>
              <td>{item.color || '—'}</td>
              <td>{WAREHOUSE_LABELS[item.warehouse as keyof typeof WAREHOUSE_LABELS] || item.warehouse}</td>
              <td>{formatNumber(item.qty)}</td>
              <td><Price amount={item.price} /></td>
              <td><Price amount={item.price * item.qty} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-footer-calc">
        <div className="invoice-total">
          <span>مبلغ کل فاکتور:</span>
          <strong><Price amount={total} /></strong>
        </div>
      </div>

      <div className="invoice-footer">
        <div className="invoice-terms">
          <p>کالاهای موضوع این فاکتور تا زمان تسویه کامل وجه و پاس شدن چک‌ها/اسناد پرداخت، نزد خریدار به صورت «امانت» محسوب می‌گردد و مالکیت قانونی آن‌ها کماکان متعلق به «تماس مارکت» است.</p>
        </div>
        <div className="invoice-signature">
          <p>مهر و امضای فروشنده</p>
          {showStamp && <img src="/sign.png" alt="امضا" className="sign-img" />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
