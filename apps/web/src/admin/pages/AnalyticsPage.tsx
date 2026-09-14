import { useQuery } from '@tanstack/react-query';
import { formatNumber, type DashboardStats } from '@tamas/shared';
import { api } from '../../lib/api';

export function AnalyticsPage() {
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => (await api.get<{ stats: DashboardStats }>('/admin/stats')).stats,
  });

  const data = stats.data;
  const maxDaily = Math.max(1, ...(data?.ordersPerDay.map((item) => item.total) ?? [1]));

  return (
    <div className="admin-page space-y-6">
      <section className="admin-page-header animate-fade-up">
        <div>
          <span className="chip chip-brand">گزارش زنده فروشگاه</span>
          <h2 className="mt-3 text-xl font-extrabold text-white sm:text-2xl">تحلیل‌ها و گزارش‌ها</h2>
          <p className="mt-1 text-xs text-slate-400">نمای کلی عملکرد فروش، سفارش‌ها، کاربران و موجودی</p>
        </div>
      </section>

      <section className="admin-stat-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['فروش ۳۰ روز اخیر', data?.revenueLast30Days ?? 0, 'تومان', 'chip-brand'],
          ['سفارش جدید', data?.newOrderCount ?? 0, 'سفارش', 'chip-aqua'],
          ['کاربر در انتظار بررسی', data?.pendingUserCount ?? 0, 'کاربر', 'chip-amber'],
          ['محصول ناموجود', data?.outOfStockCount ?? 0, 'کالا', 'chip-rose'],
        ].map(([label, value, unit, tone]) => (
          <article className="glass-card p-5" key={String(label)}>
            <span className={`chip ${tone}`}>{unit}</span>
            <p className="mt-5 text-xs text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-white">{stats.isLoading ? '…' : formatNumber(Number(value))}</p>
          </article>
        ))}
      </section>

      <section className="admin-report-grid grid grid-cols-1 gap-5 xl:grid-cols-3">
        <article className="glass-card p-6 xl:col-span-2">
          <div className="admin-section-heading flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">فروش روزانه</h3>
              <p className="mt-1 text-xs text-slate-500">۳۰ روز گذشته</p>
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
              <div className="admin-empty-state">هنوز داده‌ای برای نمودار ثبت نشده است.</div>
            )}
          </div>
        </article>

        <article className="glass-card p-6">
          <h3 className="text-base font-bold text-white">سلامت کاتالوگ</h3>
          <p className="mt-1 text-xs text-slate-500">وضعیت محصولات قابل فروش</p>
          <div className="mt-6 space-y-4">
            <Metric label="فعال" value={data?.activeProductCount ?? 0} total={data?.productCount ?? 0} tone="brand" />
            <Metric label="ناموجود" value={data?.outOfStockCount ?? 0} total={data?.productCount ?? 0} tone="rose" />
            <Metric label="در انتظار کاربر" value={data?.pendingUserCount ?? 0} total={data?.userCount ?? 0} tone="amber" />
          </div>
        </article>
      </section>

      <section className="glass-card overflow-hidden">
        <div className="admin-section-heading border-b border-white/[0.06] px-6 py-5">
          <h3 className="text-base font-bold text-white">محصولات پرفروش</h3>
          <p className="mt-1 text-xs text-slate-500">بر اساس سفارش‌های ۳۰ روز اخیر</p>
        </div>
        <div className="admin-ranked-list p-4">
          {(data?.topProducts ?? []).map((product, index) => (
            <div className="admin-ranked-row" key={`${product.title}-${index}`}>
              <span className="admin-rank">{formatNumber(index + 1)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{product.title}</p>
                <p className="mt-1 text-[11px] text-slate-500">{formatNumber(product.qty)} عدد فروش</p>
              </div>
              <strong className="text-sm text-emerald-300">{formatNumber(product.total)} تومان</strong>
            </div>
          ))}
          {!stats.isLoading && (data?.topProducts.length ?? 0) === 0 && <div className="admin-empty-state">هنوز محصول پرفروشی ثبت نشده است.</div>}
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
        <span className="font-bold text-white">{formatNumber(value)} ({formatNumber(percent)}٪)</span>
      </div>
      <div className="progress-track"><span className={`progress-fill progress-${tone}`} style={{ width: `${percent}%` }} /></div>
    </div>
  );
}
