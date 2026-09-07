import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { OrderDTO } from '@tamas/shared';
import { ORDER_STATUS_LABELS, WAREHOUSE_LABELS, formatMoney, formatNumber } from '@tamas/shared';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import './storefront.css';

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

  const orders = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.get<{ orders: OrderDTO[] }>('/orders'),
    enabled: Boolean(user),
  });

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="logo">
            <img src="/logo.png" alt="تماس مارکت" />
          </Link>
          <span className="spacer" />
          <Link to="/" className="top-btn">
            بازگشت به فروشگاه
          </Link>
        </div>
      </header>

      <main className="container">
        <h2 style={{ marginTop: 0 }}>سفارش‌های من</h2>

        {!ready ? (
          <div className="skeleton" style={{ height: 120 }} />
        ) : !user ? (
          <div className="card empty">برای دیدن سفارش‌ها ابتدا وارد حساب خود شوید.</div>
        ) : orders.isLoading ? (
          <div className="skeleton" style={{ height: 160 }} />
        ) : orders.isError ? (
          <div className="alert error">دریافت سفارش‌ها ناموفق بود.</div>
        ) : (orders.data?.orders.length ?? 0) === 0 ? (
          <div className="card empty">هنوز سفارشی ثبت نکرده‌اید.</div>
        ) : (
          <div className="stack">
            {orders.data!.orders.map((order) => (
              <div className="card" key={order.id} style={{ padding: 16 }}>
                <div className="row wrap" style={{ marginBottom: 12 }}>
                  <b className="ltr-inline">{order.orderCode}</b>
                  <span className={`badge ${STATUS_TONE[order.status] ?? ''}`}>{ORDER_STATUS_LABELS[order.status]}</span>
                  <span className="spacer" />
                  <span className="muted">{new Date(order.createdAt).toLocaleDateString('fa-IR')}</span>
                  <b style={{ color: 'var(--brand-600)' }}>{formatMoney(order.total)}</b>
                </div>

                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>کالا</th>
                        <th>رنگ</th>
                        <th>انبار</th>
                        <th>تعداد</th>
                        <th>مبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item) => (
                        <tr key={item.id}>
                          <td className="wrap">{item.title}</td>
                          <td>{item.color || '—'}</td>
                          <td>{WAREHOUSE_LABELS[item.warehouse]}</td>
                          <td>{formatNumber(item.qty)}</td>
                          <td>{formatMoney(item.price * item.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {order.address && (
                  <p className="muted" style={{ marginBottom: 0, marginTop: 10, fontSize: 12.5 }}>
                    آدرس: {order.address}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
