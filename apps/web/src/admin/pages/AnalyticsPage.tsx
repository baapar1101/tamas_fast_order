import { useQuery } from '@tanstack/react-query';
import { formatNumber } from '@tamas/shared';
import { Price } from '../../components/Price';
import { api } from '../../lib/api';

interface AnalyticsDTO {
  revenueLast30Days: number;
  newOrderCount: number;
  pendingUserCount: number;
  outOfStockCount: number;
  orderCount: number;
  productCount: number;
  activeProductCount: number;
  userCount: number;
  ordersPerDay: { day: string; total: number }[];
  topProducts: { title: string; qty: number; total: number }[];
}

export function AnalyticsPage() {
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => (await api.get<{ stats: AnalyticsDTO }>('/admin/stats')).stats,
  });

  const data = stats.data;
  const maxDaily = Math.max(1, ...(data?.ordersPerDay.map((item) => item.total) ?? [1]));

  return (
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">تحلیل‌ها و گزارش‌ها</h2>
          <p className="a-subtitle">نمای کلی عملکرد فروش، سفارش‌ها، کاربران و موجودی</p>
        </div>
        <div className="a-page-actions">
          <span className="chip chip-brand">گزارش زنده فروشگاه</span>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['فروش ۳۰ روز اخیر', data?.revenueLast30Days ?? 0, <img key="toman" src="/toman.svg" alt="تومان" style={{ width: '1.15em', height: '1.15em', display: 'inline', verticalAlign: '-0.15em' }} />, 'chip-brand'],
          ['سفارش جدید', data?.newOrderCount ?? 0, 'سفارش', 'chip-aqua'],
          ['کاربر در انتظار بررسی', data?.pendingUserCount ?? 0, 'کاربر', 'chip-amber'],
          ['محصول ناموجود', data?.outOfStockCount ?? 0, 'کالا', 'chip-rose'],
        ].map(([label, value, unit, tone]) => (
          <article className="a-stat" key={String(label)}>
            <span className={`chip ${tone}`}>{unit}</span>
            <p className="mt-5 text-xs a-muted">{label}</p>
            <p className="mt-1 a-stat-value">{stats.isLoading ? '…' : formatNumber(Number(value))}</p>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <article className="a-card xl:col-span-2">
          <div className="a-card-head a-card-head--split">
            <div>
              <h3 className="a-card-title">فروش روزانه</h3>
              <p className="a-card-desc">۳۰ روز گذشته</p>
            </div>
            <span className="chip chip-brand">{formatNumber(data?.orderCount ?? 0)} سفارش کل</span>
          </div>
          <div className="admin-bar-chart mt-6">
            {(data?.ordersPerDay ?? []).slice(-14).map((item) => (
              <div className="admin-bar-column" key={item.day} title={`${formatNumber(item.total)} تومان`}>
                <span className="admin-bar-value" style={{ height: `${Math.max(6, (item.total / maxDaily) * 100)}%` }} />
                <small>{new Date(item.day).toLocaleDateString('fa-IR', { day: 'numeric', month: 'numeric' })}</small>
              </div>
            ))}
            {!stats.isLoading && (data?.ordersPerDay.length ?? 0) === 0 && (
              <div className="a-empty">هنوز داده‌ای برای نمودار ثبت نشده است.</div>
            )}
          </div>
        </article>

        <article className="a-card">
          <h3 className="a-card-title">سلامت کاتالوگ</h3>
          <p className="a-card-desc">وضعیت محصولات قابل فروش</p>
          <div className="mt-6 space-y-4">
            <Metric label="فعال" value={data?.activeProductCount ?? 0} total={data?.productCount ?? 0} tone="brand" />
            <Metric label="ناموجود" value={data?.outOfStockCount ?? 0} total={data?.productCount ?? 0} tone="rose" />
            <Metric label="در انتظار کاربر" value={data?.pendingUserCount ?? 0} total={data?.userCount ?? 0} tone="amber" />
          </div>
        </article>
      </section>

      <section className="a-card a-card--flush">
        <div className="a-card-head a-card-head--px">
          <div>
            <h3 className="a-card-title">محصولات پرفروش</h3>
            <p className="a-card-desc">بر اساس سفارش‌های ۳۰ روز اخیر</p>
          </div>
        </div>
        <div className="admin-ranked-list p-4">
          {(data?.topProducts ?? []).map((product, index) => (
            <div className="admin-ranked-row" key={`${product.title}-${index}`}>
              <span className="admin-rank a-title-fallback">{formatNumber(index + 1)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold a-title-fallback">{product.title}</p>
                <p className="mt-1 text-[11px] a-muted">{formatNumber(product.qty)} عدد فروش</p>
              </div>
              <strong className="text-sm text-emerald-300"><Price amount={product.total} /></strong>
            </div>
          ))}
          {!stats.isLoading && (data?.topProducts.length ?? 0) === 0 && <div className="a-empty">هنوز محصول پرفروشی ثبت نشده است.</div>}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, total, tone }: { label: string; value: number; total: number; tone: 'brand' | 'rose' | 'amber' }) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-bold a-title-fallback">{formatNumber(value)} ({formatNumber(percent)}٪)</span>
      </div>
      <div className="progress-track"><span className={`progress-fill progress-${tone}`} style={{ width: `${percent}%` }} /></div>
    </div>
  );
}