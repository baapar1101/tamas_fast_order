import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { DashboardStats, OrderStatus } from '@tamas/shared';
import { ORDER_STATUS_LABELS, formatMoney, formatNumber } from '@tamas/shared';
import { api } from '../../lib/api';

interface RecentOrder {
  id: number;
  orderCode: string;
  customerName: string;
  storeName: string | null;
  total: number;
  status: OrderStatus;
  createdAt: string;
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'brand' | 'warn' | 'danger';
}) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value${tone ? ` ${tone}` : ''}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

/** Horizontal bars — a real chart library is not worth the bytes for this. */
function BarList({ rows, unit }: { rows: Array<{ label: string; value: number }>; unit: 'count' | 'money' }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <div className="empty">داده‌ای برای نمایش نیست.</div>;
  return (
    <div>
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: 3,
              }}
              title={row.label}
            >
              {row.label}
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(row.value / max) * 100}%` }} />
            </div>
          </div>
          <div style={{ textAlign: 'left', fontWeight: 600 }}>
            {unit === 'money' ? formatNumber(row.value) : formatNumber(row.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get<{ stats: DashboardStats }>('/admin/stats'),
    refetchInterval: 120_000,
  });

  const recent = useQuery({
    queryKey: ['admin', 'recent-orders'],
    queryFn: () => api.get<{ items: RecentOrder[] }>('/admin/recent-orders'),
  });

  if (stats.isLoading) {
    return (
      <div className="stat-grid">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton" style={{ height: 92 }} />
        ))}
      </div>
    );
  }

  if (stats.isError || !stats.data) {
    return <div className="alert error">دریافت آمار ناموفق بود.</div>;
  }

  const s = stats.data.stats;
  const last7 = s.ordersPerDay.slice(-7);

  return (
    <>
      <div className="admin-head">
        <h1>داشبورد</h1>
        <span className="spacer" />
        {s.lastSyncAt && (
          <span className="badge">آخرین همگام‌سازی: {new Date(s.lastSyncAt).toLocaleString('fa-IR')}</span>
        )}
      </div>

      <div className="stat-grid">
        <Stat label="سفارش‌های جدید" value={formatNumber(s.newOrderCount)} sub={`از ${formatNumber(s.orderCount)} سفارش`} tone={s.newOrderCount > 0 ? 'warn' : undefined} />
        <Stat label="فروش ۳۰ روز اخیر" value={formatMoney(s.revenueLast30Days)} tone="brand" />
        <Stat label="فروش کل" value={formatMoney(s.revenueTotal)} />
        <Stat label="محصولات فعال" value={formatNumber(s.activeProductCount)} sub={`از ${formatNumber(s.productCount)} محصول`} />
        <Stat label="ناموجود" value={formatNumber(s.outOfStockCount)} tone={s.outOfStockCount > 0 ? 'danger' : undefined} sub="نیاز به شارژ موجودی" />
        <Stat label="کاربران" value={formatNumber(s.userCount)} />
        <Stat label="در انتظار تایید" value={formatNumber(s.pendingUserCount)} tone={s.pendingUserCount > 0 ? 'warn' : undefined} sub="فروشگاه‌های تاییدنشده" />
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="chart-card">
          <h3>سفارش‌های ۷ روز اخیر</h3>
          <BarList
            rows={last7.map((d) => ({
              label: new Date(d.day).toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' }),
              value: d.count,
            }))}
            unit="count"
          />
        </div>

        <div className="chart-card">
          <h3>پرفروش‌ترین کالاها (۳۰ روز)</h3>
          <BarList rows={s.topProducts.slice(0, 7).map((p) => ({ label: p.title, value: p.qty }))} unit="count" />
        </div>
      </div>

      <div className="chart-card" style={{ marginTop: 14 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>آخرین سفارش‌ها</h3>
          <span className="spacer" />
          <Link to="/admin/orders" className="btn sm">
            همه سفارش‌ها
          </Link>
        </div>

        {recent.isLoading ? (
          <div className="skeleton" style={{ height: 120 }} />
        ) : (recent.data?.items.length ?? 0) === 0 ? (
          <div className="empty">هنوز سفارشی ثبت نشده است.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>کد</th>
                  <th>مشتری</th>
                  <th>فروشگاه</th>
                  <th>مبلغ</th>
                  <th>وضعیت</th>
                  <th>تاریخ</th>
                </tr>
              </thead>
              <tbody>
                {recent.data!.items.map((o) => (
                  <tr key={o.id}>
                    <td className="ltr">{o.orderCode}</td>
                    <td>{o.customerName}</td>
                    <td>{o.storeName || '—'}</td>
                    <td>{formatMoney(o.total)}</td>
                    <td>
                      <span className="badge">{ORDER_STATUS_LABELS[o.status]}</span>
                    </td>
                    <td>{new Date(o.createdAt).toLocaleDateString('fa-IR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
