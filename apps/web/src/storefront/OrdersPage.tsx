import { useState } from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { OrderDTO } from '@tamas/shared';
import { ORDER_STATUS_LABELS, WAREHOUSE_LABELS, formatNumber } from '@tamas/shared';
import { Price } from '../components/Price';
import { PrintInvoiceLayout, type PrintInvoiceItem } from '../components/PrintInvoiceLayout';
import { Icon } from '../components/Icon';
import { ThemeToggle } from '../components/ThemeToggle';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import './storefront.css';
import './orders-page.css';

const STATUS_TONE: Record<string, string> = {
  new: 'brand',
  confirmed: 'brand',
  preparing: 'warn',
  shipped: 'warn',
  delivered: 'success',
  cancelled: 'danger',
};

export function OrdersPage() {
  const { user, ready } = useAuth();
  const [printOrderId, setPrintOrderId] = useState<number | null>(null);

  const printOrder = (orderId: number) => {
    flushSync(() => setPrintOrderId(orderId));
    window.print();
  };

  const orders = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.get<{ orders: OrderDTO[] }>('/orders'),
    enabled: Boolean(user),
  });

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner ord-header">
          <Link to="/" className="ord-header-back" aria-label="بازگشت به فروشگاه">
            <Icon name="home" />
          </Link>
          <Link to="/" className="logo ord-header-logo">
            <img src="/logo.png" alt="تماس مارکت" />
            <span className="logo-tagline">مرجع تخصصی فروش عمده کالای دیجیتال</span>
          </Link>
          <h1 className="ord-header-title">سفارش‌های من</h1>
          <span className="spacer" />
          <Link to="/" className="top-btn ord-header-shop">
            بازگشت به فروشگاه
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="container ord-page">
        <div className="ord-main-title">
          <h1>سفارش‌های من</h1>
          <p>پیگیری وضعیت سفارش‌ها و دانلود فاکتور</p>
        </div>

        {!ready ? (
          <div className="skeleton" style={{ height: 120 }} />
        ) : !user ? (
          <div className="card ord-state">
            <Icon name="user" />
            <p>برای دیدن سفارش‌ها ابتدا وارد حساب خود شوید.</p>
            <Link to="/" className="btn">بازگشت به فروشگاه</Link>
          </div>
        ) : orders.isLoading ? (
          <div className="skeleton" style={{ height: 160 }} />
        ) : orders.isError ? (
          <div className="alert error">دریافت سفارش‌ها ناموفق بود.</div>
        ) : (orders.data?.orders.length ?? 0) === 0 ? (
          <div className="card ord-state">
            <Icon name="box" />
            <p>هنوز سفارشی ثبت نکرده‌اید.</p>
            <Link to="/" className="btn primary">مشاهده کالاها</Link>
          </div>
        ) : (
          <div className="stack ord-list">
            {orders.data!.orders.map((order) => {
              const items: PrintInvoiceItem[] = order.items.map((i) => ({
                key: i.id.toString(),
                title: i.title,
                color: i.color,
                warehouse: i.warehouse,
                qty: i.qty,
                price: i.price,
              }));
              return (
                <section className="card ord-card" key={order.id}>
                  <header className="ord-head">
                    <div className="ord-head-main">
                      <div className="ord-track">
                        <span className="ord-track-label">کد پیگیری</span>
                        <b className="ord-track-code ltr-inline">{order.orderCode}</b>
                      </div>
                      <span className={`badge ${STATUS_TONE[order.status] ?? ''}`}>{ORDER_STATUS_LABELS[order.status]}</span>
                    </div>
                    <div className="ord-head-side">
                      <div className="ord-stat">
                        <span className="ord-stat-label">تاریخ ثبت</span>
                        <b className="ord-stat-value">{new Date(order.createdAt).toLocaleDateString('fa-IR')}</b>
                      </div>
                      <div className="ord-stat ord-stat--total">
                        <span className="ord-stat-label">مبلغ کل</span>
                        <b className="ord-stat-value"><Price amount={order.total} /></b>
                      </div>
                    </div>
                  </header>

                  <div className="ord-items-head" aria-hidden="true">
                    <span>کالا</span>
                    <span>مشخصات</span>
                    <span>مبلغ</span>
                  </div>
                  <ul className="ord-items">
                    {order.items.map((item) => (
                      <li className="ord-item" key={item.id}>
                        <span className="ord-item-title wrap">{item.title}</span>
                        <span className="ord-item-specs">
                          {item.color && <span className="ord-spec">{item.color}</span>}
                          <span className="ord-spec">{WAREHOUSE_LABELS[item.warehouse]}</span>
                          <span className="ord-spec ord-spec--qty">{formatNumber(item.qty)} عدد</span>
                        </span>
                        <span className="ord-item-price"><Price amount={item.price * item.qty} /></span>
                      </li>
                    ))}
                  </ul>

                  {order.address && (
                    <div className="ord-address">
                      <Icon name="pin" />
                      <span>
                        <strong>آدرس ارسال:</strong> {order.address}
                      </span>
                    </div>
                  )}

                  <footer className="ord-foot">
                    <button type="button" className="btn ghost sm ord-print" onClick={() => printOrder(order.id)}>
                      <Icon name="printer" /> چاپ فاکتور
                    </button>
                  </footer>

                  <PrintInvoiceLayout
                    title="فاکتور فروش"
                    active={printOrderId === order.id}
                    orderId={order.orderCode}
                    date={new Date(order.createdAt).toLocaleDateString('fa-IR')}
                    customerName={user?.name}
                    customerPhone={user?.phone}
                    total={order.total}
                    items={items}
                  />
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
