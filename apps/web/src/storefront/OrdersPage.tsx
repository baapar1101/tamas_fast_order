import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { OrderDTO } from '@tamas/shared';
import { ORDER_STATUS_LABELS, WAREHOUSE_LABELS, formatMoney, formatNumber } from '@tamas/shared';
import { Price } from '../components/Price';
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
              <div className="card" key={order.id} style={{ padding: 24, borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: 24, backgroundColor: '#fff' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>کد پیگیری:</span>
                    <b style={{ fontSize: 16, color: '#0f172a' }} className="ltr-inline">{order.orderCode}</b>
                    <span className={`badge ${STATUS_TONE[order.status] ?? ''}`} style={{ fontSize: 12, padding: '4px 10px' }}>{ORDER_STATUS_LABELS[order.status]}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>تاریخ ثبت</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{new Date(order.createdAt).toLocaleDateString('fa-IR')}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>مبلغ کل</span>
                      <b style={{ fontSize: 16, color: '#0ea5e9' }}><Price amount={order.total} /></b>
                    </div>
                  </div>
                </div>

                <div className="table-wrap" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <table className="data" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead style={{ backgroundColor: '#f8fafc' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', fontSize: 13, color: '#475569', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>کالا</th>
                        <th style={{ padding: '12px 16px', fontSize: 13, color: '#475569', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>رنگ</th>
                        <th style={{ padding: '12px 16px', fontSize: 13, color: '#475569', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>انبار</th>
                        <th style={{ padding: '12px 16px', fontSize: 13, color: '#475569', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>تعداد</th>
                        <th style={{ padding: '12px 16px', fontSize: 13, color: '#475569', fontWeight: 700, borderBottom: '1px solid #e2e8f0' }}>مبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, idx) => (
                        <tr key={item.id} style={{ borderBottom: idx !== order.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                          <td style={{ padding: '12px 16px', fontSize: 14, color: '#1e293b', fontWeight: 600 }} className="wrap">{item.title}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>{item.color || '—'}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>{WAREHOUSE_LABELS[item.warehouse]}</td>
                          <td style={{ padding: '12px 16px', fontSize: 14, color: '#334155', fontWeight: 700 }}>{formatNumber(item.qty)}</td>
                          <td style={{ padding: '12px 16px', fontSize: 14, color: '#0ea5e9', fontWeight: 700 }}><Price amount={item.price * item.qty} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {order.address && (
                  <div style={{ marginTop: 16, padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#64748b' }}>📍</span>
                    <span style={{ fontSize: 13, color: '#475569', fontWeight: 500, lineHeight: 1.6 }}>
                      <strong style={{ color: '#334155', marginLeft: 4 }}>آدرس ارسال:</strong>
                      {order.address}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
