import { useState } from 'react';
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

type ArvanPeriod = '1h' | '3h' | '6h' | '12h' | '24h' | '7d' | '30d';

interface ArvanAnalyticsDTO {
  configured: boolean;
  domain?: string;
  period?: ArvanPeriod;
  totalVisitors?: number;
  peakAt?: string | null;
  chart?: { at: string; visitors: number }[];
  requests?: { total: number; saved: number };
  traffic?: { total: number; saved: number };
  fetchedAt?: string;
}

const PERIOD_LABELS: Record<ArvanPeriod, string> = {
  '1h': '۱ ساعت اخیر',
  '3h': '۳ ساعت اخیر',
  '6h': '۶ ساعت اخیر',
  '12h': '۱۲ ساعت اخیر',
  '24h': '۲۴ ساعت اخیر',
  '7d': '۷ روز اخیر',
  '30d': '۳۰ روز اخیر',
};

export function AnalyticsPage() {
  const [period, setPeriod] = useState<ArvanPeriod>('24h');
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => (await api.get<{ stats: AnalyticsDTO }>('/admin/stats')).stats,
  });
  const arvan = useQuery({
    queryKey: ['admin', 'arvan-analytics', period],
    queryFn: async () => (await api.get<{ analytics: ArvanAnalyticsDTO }>('/admin/analytics/arvan', { period })).analytics,
    staleTime: 60_000,
    retry: false,
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

      <section className="a-card arvan-analytics-card">
        <div className="a-card-head a-card-head--split admin-chart-header">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="a-card-title">تحلیل کاربران سایت</h3>
              <span className="chip chip-aqua">داده واقعی اروان کلاد</span>
            </div>
            <p className="a-card-desc">بازدیدکنندگان یکتا و مصرف CDN برای {arvan.data?.domain || 'دامنه فروشگاه'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="a-select a-select--compact" value={period} onChange={(event) => setPeriod(event.target.value as ArvanPeriod)}>
              {(Object.keys(PERIOD_LABELS) as ArvanPeriod[]).map((value) => (
                <option key={value} value={value}>{PERIOD_LABELS[value]}</option>
              ))}
            </select>
            <button type="button" className="a-btn a-btn--secondary a-btn--xs" disabled={arvan.isFetching} onClick={() => void arvan.refetch()}>
              {arvan.isFetching ? 'در حال دریافت…' : 'به‌روزرسانی'}
            </button>
          </div>
        </div>

        {arvan.isLoading ? (
          <div className="a-empty">در حال دریافت گزارش بازدیدکنندگان از اروان کلاد…</div>
        ) : arvan.isError ? (
          <div className="a-alert a-alert--error">
            <strong>دریافت گزارش اروان ناموفق بود.</strong>
            <span>{arvan.error.message}</span>
          </div>
        ) : !arvan.data?.configured ? (
          <div className="a-empty arvan-empty-state">
            <strong>اتصال اروان کلاد هنوز تنظیم نشده است.</strong>
            <span>از بخش «تنظیمات ← تحلیل اروان کلاد» دامنه و کلید API را ثبت و اتصال را بررسی کنید.</span>
          </div>
        ) : (
          <ArvanVisitors analytics={arvan.data} />
        )}
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

function ArvanVisitors({ analytics }: { analytics: ArvanAnalyticsDTO }) {
  const points = analytics.chart ?? [];
  const width = 1000;
  const height = 260;
  const max = Math.max(1, ...points.map((point) => point.visitors));
  const coordinates = points.map((point, index) => ({
    x: points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width,
    y: height - (point.visitors / max) * (height - 28) - 12,
  }));
  const line = coordinates.map((point) => `${point.x},${point.y}`).join(' ');
  const area = coordinates.length > 0 ? `0,${height} ${line} ${width},${height}` : '';
  const labels = points.length <= 5 ? points : points.filter((_, index) => index % Math.max(1, Math.floor(points.length / 5)) === 0 || index === points.length - 1);

  return (
    <div className="arvan-analytics-body">
      <div className="arvan-metric-grid">
        <article className="a-stat">
          <span className="chip chip-aqua">کاربر</span>
          <p className="mt-4 text-xs a-muted">مجموع بازدیدکنندگان</p>
          <p className="mt-1 a-stat-value">{formatNumber(analytics.totalVisitors ?? 0)}</p>
        </article>
        <article className="a-stat">
          <span className="chip chip-brand">درخواست</span>
          <p className="mt-4 text-xs a-muted">درخواست‌های سرو‌شده</p>
          <p className="mt-1 a-stat-value">{formatNumber(analytics.requests?.total ?? 0)}</p>
        </article>
        <article className="a-stat">
          <span className="chip chip-amber">ترافیک</span>
          <p className="mt-4 text-xs a-muted">ترافیک سرو‌شده</p>
          <p className="mt-1 a-stat-value arvan-byte-value">{formatBytes(analytics.traffic?.total ?? 0)}</p>
        </article>
        <article className="a-stat">
          <span className="chip chip-rose">اوج بازدید</span>
          <p className="mt-4 text-xs a-muted">بیشترین بازدید در</p>
          <p className="mt-1 a-stat-value arvan-date-value">{formatDateTime(analytics.peakAt)}</p>
        </article>
      </div>

      <div className="arvan-chart-shell">
        <div className="arvan-chart-title">
          <div>
            <strong>روند بازدیدکنندگان</strong>
            <p className="a-card-desc">{PERIOD_LABELS[analytics.period ?? '24h']}</p>
          </div>
          <span className="a-muted text-xs">آخرین دریافت: {formatDateTime(analytics.fetchedAt)}</span>
        </div>
        {coordinates.length > 0 ? (
          <>
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="نمودار بازدیدکنندگان اروان کلاد" preserveAspectRatio="none">
              <defs>
                <linearGradient id="arvanVisitorArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} className="arvan-grid-line" />)}
              <polygon points={area} fill="url(#arvanVisitorArea)" />
              <polyline points={line} fill="none" className="arvan-chart-line" />
              {coordinates.map((point, index) => <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r="4" className="arvan-chart-dot"><title>{formatNumber(points[index]?.visitors ?? 0)} بازدیدکننده</title></circle>)}
            </svg>
            <div className="arvan-chart-labels">
              {labels.map((point) => <span key={point.at}>{formatChartDate(point.at, analytics.period)}</span>)}
            </div>
          </>
        ) : (
          <div className="a-empty">برای این بازه داده‌ای از اروان دریافت نشد.</div>
        )}
      </div>

      <div className="arvan-saved-grid">
        <SavedMetric label="درخواست صرفه‌جویی‌شده" saved={analytics.requests?.saved ?? 0} total={analytics.requests?.total ?? 0} formatter={formatNumber} />
        <SavedMetric label="ترافیک صرفه‌جویی‌شده" saved={analytics.traffic?.saved ?? 0} total={analytics.traffic?.total ?? 0} formatter={formatBytes} />
      </div>
    </div>
  );
}

function SavedMetric({ label, saved, total, formatter }: { label: string; saved: number; total: number; formatter: (value: number) => string }) {
  const percent = total > 0 ? Math.min(100, Math.round((saved / total) * 100)) : 0;
  return (
    <article className="arvan-saved-card">
      <div className="flex items-center justify-between gap-3">
        <strong>{label}</strong>
        <span className="chip chip-aqua">{formatter(saved)}</span>
      </div>
      <div className="progress-track"><span className="progress-fill progress-brand" style={{ width: `${percent}%` }} /></div>
      <p className="a-card-desc">{formatNumber(percent)}٪ از مجموع {formatter(total)}</p>
    </article>
  );
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '۰ بایت';
  const units = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت', 'ترابایت'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(value / 1024 ** index)} ${units[index]}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatChartDate(value: string, period?: ArvanPeriod): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return period === '7d' || period === '30d'
    ? date.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' })
    : date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
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
