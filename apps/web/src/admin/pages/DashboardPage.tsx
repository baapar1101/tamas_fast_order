import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatNumber, type DashboardStats, type OrderDTO } from '@tamas/shared';
import { Price } from '../../components/Price';
import { api } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { AdminState, Skeleton, TableState } from '../components/AdminState';
import './dashboard-page.css';

export function DashboardPage() {
  const { user } = useAuth();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'dashboard-stats'],
    queryFn: async () => {
      const [statsResult, ordersResult] = await Promise.all([
        api.get<{ ok: boolean; stats: DashboardStats }>('/admin/stats'),
        api.get<{ ok: boolean; items: OrderDTO[] }>('/admin/recent-orders'),
      ]);
      return { stats: statsResult.stats, recentOrders: ordersResult.items };
    },
  });

  const stats = data?.stats;
  const ordersCount = stats?.orderCount ?? 0;
  const productsCount = stats?.productCount ?? 0;
  const usersCount = stats?.userCount ?? 0;
  const totalRevenue = stats?.revenueTotal ?? 0;
  const recentOrders = data?.recentOrders ?? [];
  const dailySeries = stats?.dailySeries ?? [];
  const activeProductPercent = productsCount > 0 ? Math.round((stats?.activeProductCount ?? 0) * 100 / productsCount) : 0;
  const statValue = (value: number) => (isLoading ? '…' : isError ? '—' : formatNumber(value));

  return (
    <div className="a-page a-fade dash-page">
      {isError && (
        <AdminState
          kind="error"
          title="دریافت اطلاعات داشبورد انجام نشد."
          error={error}
          onRetry={() => void refetch()}
        />
      )}
      {/* Welcome Hero Banner */}
      <section className="a-card admin-hero overflow-hidden p-6 sm:p-8">
        <div className="admin-hero-content relative flex flex-wrap items-center justify-between gap-6">
          <div className="admin-hero-copy max-w-xl">
            <p className="dash-eyebrow">نمای کلی اطلاعات فروشگاه</p>
            <h2 className="a-title-fallback a-title-mega">
              سلام {user?.name || 'مدیر گرامی'}، خوش برگشتی
            </h2>
            <p className="mt-3 text-sm leading-7 a-muted">
              تاکنون <span className="dash-em">{statValue(ordersCount)} سفارش</span> ثبت شده است. ارزش سفارش‌های لغونشده:{' '}
              <span className="dash-em">{isLoading || isError ? statValue(0) : <Price amount={totalRevenue} />}</span>.
            </p>
            <div className="admin-hero-actions mt-6 flex flex-wrap gap-3">
              <Link to="/admin/orders" className="a-btn a-btn--primary">
                مشاهدهٔ سفارش‌ها
              </Link>
              <Link to="/admin/products" className="a-btn a-btn--secondary">
                افزودن محصول
              </Link>
            </div>
          </div>

          {/* Actual active-product coverage, derived from API totals. */}
          <div
            className="admin-goal-ring relative mx-auto grid place-items-center shrink-0 sm:mx-0"
            role="img"
            aria-label={isLoading || isError ? 'سهم کالاهای فعال در دسترس نیست' : `سهم کالاهای فعال: ${formatNumber(activeProductPercent)}٪`}
          >
            <svg className="block h-full w-full -rotate-90" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <circle cx="60" cy="60" r="52" fill="none" className="dash-ring-track" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                className="dash-ring-value"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="326.7"
                strokeDashoffset={326.7 * (1 - activeProductPercent / 100)}
              />
            </svg>
            <div className="absolute text-center" aria-hidden="true">
              <p className="a-title-fallback a-title-mega-sm">{isLoading || isError ? '—' : `${formatNumber(activeProductPercent)}٪`}</p>
              <p className="dash-ring-caption">سهم کالاهای فعال</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Stat Metric Cards */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Sales */}
        <div className="a-card">
          <div className="flex items-start justify-between">
            <div className="stat-icon dash-stat-icon" aria-hidden="true">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <TrendBadge values={dailySeries.map((item) => item.revenue)} />
          </div>
          <p className="mt-5 a-stat-label">ارزش سفارش‌های لغونشده</p>
          <p className="mt-1 a-stat-value">
            {statValue(totalRevenue)}{' '}
            <span className="dash-unit"><img src="/toman.svg" alt="تومان" className="dash-toman" /></span>
          </p>
          <Sparkline values={dailySeries.map((item) => item.revenue)} />
        </div>

        {/* Orders Count */}
        <div className="a-card">
          <div className="flex items-start justify-between">
            <div className="stat-icon dash-stat-icon" aria-hidden="true">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
              </svg>
            </div>
            <TrendBadge values={dailySeries.map((item) => item.orders)} />
          </div>
          <p className="mt-5 a-stat-label">تعداد سفارش‌ها</p>
          <p className="mt-1 a-stat-value">
            {statValue(ordersCount)}{' '}
            <span className="dash-unit">سفارش</span>
          </p>
          <Sparkline values={dailySeries.map((item) => item.orders)} />
        </div>

        {/* Users Count */}
        <div className="a-card">
          <div className="flex items-start justify-between">
            <div className="stat-icon dash-stat-icon" aria-hidden="true">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <TrendBadge values={dailySeries.map((item) => item.users)} />
          </div>
          <p className="mt-5 a-stat-label">کاربران ثبت‌نام شده</p>
          <p className="mt-1 a-stat-value">
            {statValue(usersCount)}{' '}
            <span className="dash-unit">کاربر</span>
          </p>
          <Sparkline values={dailySeries.map((item) => item.users)} />
        </div>

        {/* Products Count */}
        <div className="a-card">
          <div className="flex items-start justify-between">
            <div className="stat-icon dash-stat-icon" aria-hidden="true">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <span className="a-badge a-badge--neutral">{statValue(stats?.activeProductCount ?? 0)} فعال</span>
          </div>
          <p className="mt-5 a-stat-label">کل محصولات</p>
          <p className="mt-1 a-stat-value">
            {statValue(productsCount)}{' '}
            <span className="dash-unit">کالا</span>
          </p>
          <Sparkline values={dailySeries.map((item) => item.products)} />
        </div>
      </section>

      {/* Analytics Charts Section */}
      <section className="a-charts-grid grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Revenue Trend Chart Card */}
        <div className="a-card xl:col-span-2">
          <div className="a-card-head a-card-head--split mb-2">
            <div>
              <h3 className="a-card-title">روند ارزش سفارش‌ها</h3>
              <p className="a-card-desc">مقایسهٔ عملکرد فروش ماه‌های اخیر</p>
            </div>
            <div className="a-card-actions dash-legend">
              <span className="dash-legend-item">
                <span className="dash-legend-swatch" aria-hidden="true" />
                امسال
              </span>
              <span className="dash-legend-item">
                <span className="dash-legend-swatch dash-legend-swatch--previous" aria-hidden="true" />
                سال قبل
              </span>
            </div>
          </div>

          {isLoading ? <Skeleton block /> : isError ? <AdminState kind="empty" compact title="اطلاعات نمودار در دسترس نیست." /> : <RevenueChart data={stats?.monthlyRevenue ?? []} />}
        </div>

        {/* Traffic Sources Donut Chart Card */}
        <div className="a-card flex flex-col">
          <h3 className="a-card-title">منابع جذب مشتری</h3>
          <p className="a-card-desc">سهم هر کانال از سفارش‌های ثبت‌شده</p>

          {isLoading ? <Skeleton block /> : isError ? <AdminState kind="empty" compact title="اطلاعات نمودار در دسترس نیست." /> : <AcquisitionChart sources={stats?.acquisitionSources ?? []} />}
        </div>
      </section>

      {/* Recent Orders Table */}
      <section className="a-card a-card--flush">
        <div className="a-card-head a-card-head--px">
          <div>
            <h3 className="a-card-title">آخرین سفارش‌های ثبت‌شده</h3>
            <p className="a-card-desc">آخرین تراکنش‌ها و خریدهای کاربران</p>
          </div>
          <Link to="/admin/orders" className="a-link a-link--arrow">
            مشاهده همه سفارش‌ها
          </Link>
        </div>

        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>کد سفارش</th>
                <th>مشتری</th>
                <th className="a-num">مبلغ کل</th>
                <th>وضعیت سفارش</th>
                <th>تاریخ ثبت</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableState colSpan={5} kind="loading" />
              ) : isError ? (
                <TableState colSpan={5} kind="error" title="آخرین سفارش‌ها دریافت نشد." error={error} />
              ) : recentOrders.length === 0 ? (
                <TableState colSpan={5} kind="empty" noun="سفارش" />
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="order-row">
                    <td className="font-mono font-bold a-title-fallback a-ltr">
                      #{order.orderCode}
                    </td>
                    <td>
                      <div>
                        <div className="a-strong">
                          {order.customerName || 'کاربر مهمان'}
                        </div>
                        {order.phone && (
                          <div className="a-cell-sub a-ltr">
                            {order.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="a-num a-strong">
                      <Price amount={order.total} />
                    </td>
                    <td>
                      <span className={`a-badge ${order.status === 'delivered' ? 'a-badge--success' : 'a-badge--warning'}`}>
                        {order.status === 'delivered' ? 'تکمیل‌شده' : 'در حال پردازش'}
                      </span>
                    </td>
                    <td className="a-cell-sub">
                      {new Date(order.createdAt).toLocaleDateString('fa-IR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const width = 100;
  const height = 30;
  const max = Math.max(1, ...values);
  const points = (values.length > 0 ? values : [0]).map((value, index, list) => ({
    x: list.length === 1 ? width / 2 : (index / (list.length - 1)) * width,
    y: height - 3 - (value / max) * (height - 7),
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  return (
    <div className="admin-sparkline" aria-hidden="true">
      <svg width="100" height="30" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <polygon points={area} className="dash-spark-area" />
        <polyline points={line} fill="none" className="dash-spark-line" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function TrendBadge({ values }: { values: number[] }) {
  const midpoint = Math.max(1, Math.floor(values.length / 2));
  const before = values.slice(0, midpoint).reduce((sum, value) => sum + value, 0);
  const current = values.slice(midpoint).reduce((sum, value) => sum + value, 0);
  const percent = before > 0 ? Math.round(((current - before) / before) * 100) : current > 0 ? 100 : 0;
  const tone = percent > 0 ? 'a-badge--success' : percent < 0 ? 'a-badge--danger' : 'a-badge--neutral';
  const sign = percent > 0 ? '+' : percent < 0 ? '−' : '';
  const label = percent > 0 ? 'افزایش' : percent < 0 ? 'کاهش' : 'بدون تغییر';
  return (
    <span className={`a-badge ${tone}`} title={`${label} نسبت به نیمهٔ قبلی دوره`}>
      <span className="a-ltr">{sign}{formatNumber(Math.abs(percent))}٪</span>
    </span>
  );
}

function RevenueChart({ data }: { data: DashboardStats['monthlyRevenue'] }) {
  const width = 1000;
  const height = 260;
  const plotHeight = 225;
  const max = Math.max(1, ...data.flatMap((item) => [item.current, item.previous]));
  const pointList = (values: number[]) => values.map((value, index) => {
    const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = plotHeight - (value / max) * (plotHeight - 18) + 8;
    return `${x},${y}`;
  }).join(' ');
  const currentPoints = pointList(data.map((item) => item.current));
  const previousPoints = pointList(data.map((item) => item.previous));
  const area = data.length ? `0,${height} ${currentPoints} ${width},${height}` : '';
  const ticks = [1, 0.75, 0.5, 0.25, 0];

  return (
    <div className="admin-revenue-chart" role="img" aria-label="نمودار روند ارزش سفارش‌ها در ماه‌های اخیر، امسال و سال قبل">
      <div className="admin-y-axis" aria-hidden="true">
        {ticks.map((ratio) => <span key={ratio}>{formatCompact(max * ratio)}</span>)}
      </div>
      <div className="admin-revenue-plot">
        <svg width="1000" height="260" viewBox={`0 0 ${width} ${height}`} aria-hidden="true" preserveAspectRatio="none">
          {ticks.map((ratio) => <line key={ratio} x1="0" x2={width} y1={8 + ratio * (plotHeight - 8)} y2={8 + ratio * (plotHeight - 8)} className="admin-real-grid" />)}
          {data.length > 0 && <polygon points={area} className="dash-revenue-area" />}
          {data.length > 0 && <polyline points={previousPoints} fill="none" className="admin-revenue-previous" />}
          {data.length > 0 && <polyline points={currentPoints} fill="none" className="admin-revenue-current" />}
        </svg>
        <div className="admin-x-axis">
          {data.map((item) => <span key={item.month}>{new Date(item.month).toLocaleDateString('fa-IR', { month: 'long' })}</span>)}
        </div>
        {data.length === 0 && <AdminState kind="empty" compact title="هنوز ارزش سفارشی برای نمایش ثبت نشده است." />}
      </div>
    </div>
  );
}

function AcquisitionChart({ sources }: { sources: DashboardStats['acquisitionSources'] }) {
  const total = sources.reduce((sum, item) => sum + item.count, 0);
  let cursor = 0;
  const gradient = sources.map((item) => {
    const start = cursor;
    cursor += total > 0 ? (item.count / total) * 100 : 0;
    return `${item.color} ${start}% ${cursor}%`;
  }).join(', ');
  const leader = sources[0];
  const leaderPercent = leader && total > 0 ? Math.round((leader.count / total) * 100) : 0;

  if (total === 0) {
    return (
      <AdminState
        kind="empty"
        compact
        title="هنوز منبع جذبی ثبت نشده است."
        text="پس از ثبت سفارش از لینک‌های رهگیری، منابع واقعی اینجا نمایش داده می‌شوند."
      />
    );
  }
  return (
    <>
      <div className="admin-donut-wrap">
        <div className="admin-donut" role="img" style={{ background: `conic-gradient(${gradient})` }} aria-label={`نمودار منابع جذب از ${formatNumber(total)} سفارش`} />
        <div className="admin-donut-label" aria-hidden="true">
          <p className="a-title-fallback a-title-mega-sm">{formatNumber(leaderPercent)}٪</p>
          <p className="dash-donut-caption">{leader?.label}</p>
        </div>
      </div>
      <div className="admin-donut-legend dash-donut-legend mt-6 space-y-3 pt-4">
        {sources.map((source) => (
          <div className="flex items-center justify-between gap-3 text-xs" key={source.source}>
            <span className="dash-legend-label flex min-w-0 items-center gap-2">
              <span className="dash-legend-dot" aria-hidden="true" style={{ backgroundColor: source.color }} />
              <span className="truncate">{source.label}</span>
            </span>
            <span className="shrink-0 font-bold a-title-fallback">{formatNumber(Math.round((source.count / total) * 100))}٪ · {formatNumber(source.count)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('fa-IR', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.round(value));
}
