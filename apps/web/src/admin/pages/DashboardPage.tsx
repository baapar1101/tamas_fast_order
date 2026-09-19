import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatNumber, type DashboardStats, type OrderDTO } from '@tamas/shared';
import { Price } from '../../components/Price';
import { api } from '../../lib/api';
import { useAuth } from '../../store/auth';

export function DashboardPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
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

  return (
    <div className="a-page a-fade">
      {/* Welcome Hero Banner */}
      <section className="a-card admin-hero overflow-hidden p-6 sm:p-8">
        <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px shimmer-line animate-shimmer" />
        <div className="admin-hero-content relative flex flex-wrap items-center justify-between gap-6">
          <div className="admin-hero-copy max-w-xl">
            <div className="chip chip-brand mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              عملکرد امروز فروشگاه عالی است
            </div>
            <h2 className="a-title-fallback a-title-mega xl:text-3xl">
              سلام {user?.name || 'مدیر گرامی'}، خوش برگشتی{' '}
              <span className="inline-block animate-floaty" style={{ animationDuration: '3s' }}>
                👋
              </span>
            </h2>
            <p className="mt-3 text-sm leading-7 a-muted">
              امروز <span className="font-bold text-emerald-400">{formatNumber(ordersCount)} سفارش فعال</span> با ارزش کل{' '}
              <span className="font-bold text-emerald-400"><Price amount={totalRevenue} /></span> در سیستم ثبت شده است.
            </p>
            <div className="admin-hero-actions mt-6 flex flex-wrap gap-3">
              <Link to="/admin/orders" className="a-btn a-btn--primary">
                مشاهده سفارش‌ها
              </Link>
              <Link to="/admin/products" className="a-btn a-btn--secondary">
                + افزودن محصول جدید
              </Link>
            </div>
          </div>

          {/* Goal Progress Ring */}
          <div className="admin-goal-ring relative mx-auto grid place-items-center shrink-0 sm:mx-0" style={{ width: '8.5rem', height: '8.5rem' }}>
            <svg className="block h-full w-full -rotate-90" style={{ width: '100%', height: '100%' }} viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(0, 0, 0, 0.12)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="url(#ringGrad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray="326.7"
                strokeDashoffset="71.8"
                style={{ transition: 'stroke-dashoffset 1.8s cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
              <defs>
                <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute text-center">
              <p className="a-title-fallback a-title-mega-sm">۷۸٪</p>
              <p className="mt-0.5 text-[10px] a-muted">هدف فروش ماهانه</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Stat Metric Cards */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Sales */}
        <div className="a-card">
          <div className="flex items-start justify-between">
            <div className="stat-icon bg-emerald-500/15 text-emerald-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <span className="chip chip-brand">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
              +۱۲.۵٪
            </span>
          </div>
          <p className="mt-5 text-sm a-muted">درآمد کل فروشگاه</p>
          <p className="mt-1 a-stat-value">
            {isLoading ? '...' : formatNumber(totalRevenue)}{' '}
            <span className="text-xs font-normal a-muted"><img src="/toman.svg" alt="تومان" style={{ width: '1em', height: '1em', display: 'inline' }} /></span>
          </p>
          <div className="mt-4 h-10 w-full overflow-hidden">
            <svg viewBox="0 0 100 30" className="block w-full h-full" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkGrad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M 0 25 Q 15 20, 30 22 T 60 10 T 90 14 T 100 4 L 100 30 L 0 30 Z" fill="url(#sparkGrad1)" />
              <path
                d="M 0 25 Q 15 20, 30 22 T 60 10 T 90 14 T 100 4"
                fill="none"
                stroke="#34d399"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Orders Count */}
        <div className="a-card">
          <div className="flex items-start justify-between">
            <div className="stat-icon bg-cyan-500/15 text-cyan-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
              </svg>
            </div>
            <span className="chip chip-brand">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
              +۸.۲٪
            </span>
          </div>
          <p className="mt-5 text-sm a-muted">تعداد سفارش‌ها</p>
          <p className="mt-1 a-stat-value">
            {isLoading ? '...' : formatNumber(ordersCount)}{' '}
            <span className="text-xs font-normal a-muted">سفارش</span>
          </p>
          <div className="mt-4 h-10 w-full overflow-hidden">
            <svg viewBox="0 0 100 30" className="block w-full h-full" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M 0 20 Q 20 28, 40 18 T 70 12 T 100 6 L 100 30 L 0 30 Z" fill="url(#sparkGrad2)" />
              <path
                d="M 0 20 Q 20 28, 40 18 T 70 12 T 100 6"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Users Count */}
        <div className="a-card">
          <div className="flex items-start justify-between">
            <div className="stat-icon bg-amber-500/15 text-amber-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <span className="chip chip-brand">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
              </svg>
              +۲۴٪
            </span>
          </div>
          <p className="mt-5 text-sm a-muted">کاربران ثبت‌نام شده</p>
          <p className="mt-1 a-stat-value">
            {isLoading ? '...' : formatNumber(usersCount)}{' '}
            <span className="text-xs font-normal a-muted">کاربر</span>
          </p>
          <div className="mt-4 h-10 w-full overflow-hidden">
            <svg viewBox="0 0 100 30" className="block w-full h-full" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkGrad3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M 0 26 Q 25 15, 50 20 T 80 8 T 100 2 L 100 30 L 0 30 Z" fill="url(#sparkGrad3)" />
              <path
                d="M 0 26 Q 25 15, 50 20 T 80 8 T 100 2"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Products Count */}
        <div className="a-card">
          <div className="flex items-start justify-between">
            <div className="stat-icon bg-rose-500/15 text-rose-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <span className="chip chip-brand">فعال</span>
          </div>
          <p className="mt-5 text-sm a-muted">کل محصولات</p>
          <p className="mt-1 a-stat-value">
            {isLoading ? '...' : formatNumber(productsCount)}{' '}
            <span className="text-xs font-normal a-muted">کالا</span>
          </p>
          <div className="mt-4 h-10 w-full overflow-hidden">
            <svg viewBox="0 0 100 30" className="block w-full h-full" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkGrad4" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb7185" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M 0 15 Q 30 5, 50 15 T 80 10 T 100 18 L 100 30 L 0 30 Z" fill="url(#sparkGrad4)" />
              <path
                d="M 0 15 Q 30 5, 50 15 T 80 10 T 100 18"
                fill="none"
                stroke="#fb7185"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* Analytics Charts Section */}
      <section className="a-charts-grid grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Revenue Trend Chart Card */}
        <div className="a-card xl:col-span-2">
          <div className="a-card-head a-card-head--split mb-2">
            <div>
              <h3 className="a-card-title">روند درآمد فروشگاه</h3>
              <p className="a-card-desc">مقایسه عملکرد فروش ماه‌های اخیر</p>
            </div>
            <div className="a-card-actions">
              <span className="chip chip-brand">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                امسال
              </span>
              <span className="chip chip-slate">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                سال قبل
              </span>
            </div>
          </div>

          <div className="admin-revenue-chart grid grid-cols-[2rem_minmax(0,1fr)] gap-2 w-full" aria-label="نمودار روند درآمد فروشگاه">
            <div className="admin-y-axis flex flex-col justify-between h-[16.25rem] py-[0.1rem] text-[0.6rem] text-slate-500 text-right leading-none" aria-hidden="true">
              <span>۳۰۰</span>
              <span>۲۵۰</span>
              <span>۲۰۰</span>
              <span>۱۵۰</span>
              <span>۱۰۰</span>
              <span>۵۰</span>
              <span>۰</span>
            </div>
            <div className="admin-revenue-plot w-full" style={{ minWidth: 0 }}>
            <svg viewBox="0 0 1000 260" role="img" preserveAspectRatio="none" className="block w-full h-[16.25rem]" style={{ width: '100%', height: '16.25rem' }}>
              <defs>
                <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Grid Background Lines */}
              {[10, 50, 90, 130, 170, 210, 250].map((y) => (
                <line key={y} x1="0" y1={y} x2="1000" y2={y} stroke="rgba(100,116,139,0.16)" strokeDasharray="4 7" />
              ))}

              {/* Filled Area Gradient */}
              <path
                d="M 0 205 C 90 190, 145 160, 240 155 S 385 205, 500 190 S 630 120, 735 105 S 875 80, 1000 35 L 1000 260 L 0 260 Z"
                fill="url(#chartAreaGrad)"
              />

              {/* Year Baseline Curve */}
              <path
                d="M 0 232 C 120 220, 235 205, 345 220 S 510 225, 625 190 S 825 180, 1000 150"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeDasharray="6 6"
                strokeLinecap="round"
              />

              {/* Main Line Trend */}
              <path
                d="M 0 205 C 90 190, 145 160, 240 155 S 385 205, 500 190 S 630 120, 735 105 S 875 80, 1000 35"
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

            </svg>
            <div className="admin-x-axis">
              <span>فروردین</span>
              <span>اردیبهشت</span>
              <span>خرداد</span>
              <span>تیر</span>
              <span>مرداد</span>
              <span>شهریور</span>
            </div>
            </div>
          </div>
        </div>

        {/* Traffic Sources Donut Chart Card */}
        <div className="a-card flex flex-col">
          <h3 className="a-card-title">منابع جذب مشتری</h3>
          <p className="a-card-desc">سهم هر کانال از سفارش‌های ثبت‌شده</p>

          <div className="admin-donut-wrap">
            <div className="admin-donut" aria-label="۵۴ درصد گوگل، ۲۴ درصد شبکه‌های اجتماعی، ۱۴ درصد پیامک و ۸ درصد سایر کانال‌ها" />
            <div className="admin-donut-label">
              <p className="a-title-fallback a-title-mega-sm">۵۴٪</p>
              <p className="mt-0.5 text-[10px] font-medium a-muted">جستجوی گوگل</p>
            </div>
          </div>

          <div className="admin-donut-legend mt-6 space-y-3 border-t border-white/[0.06] pt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                گوگل و موتورهای جستجو
              </span>
              <span className="font-bold a-title-fallback">۵۴٪</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                شبکه‌های اجتماعی
              </span>
              <span className="font-bold a-title-fallback">۲۴٪</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                ایمیل مارکتینگ
              </span>
              <span className="font-bold a-title-fallback">۱۴٪</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="admin-legend-dot admin-legend-dot-slate" />
                سایر کانال‌ها
              </span>
              <span className="font-bold a-title-fallback">۸٪</span>
            </div>
          </div>
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
                <th>مبلغ کل</th>
                <th>وضعیت سفارش</th>
                <th>تاریخ ثبت</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="a-empty">
                    هنوز هیچ سفارشی ثبت نشده است.
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id} className="order-row">
                    <td className="font-mono font-bold a-title-fallback a-ltr">
                      #{order.orderCode}
                    </td>
                    <td>
                      <div>
                        <div className="font-semibold text-slate-200">
                          {order.customerName || 'کاربر مهمان'}
                        </div>
                          {order.phone && (
                            <div className="text-[11px] text-slate-500 a-ltr">
                            {order.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="font-bold text-emerald-400">
                      <Price amount={order.total} />
                    </td>
                    <td>
                      <span className={`chip ${order.status === 'delivered' ? 'chip-brand' : 'chip-amber'}`}>
                        {order.status === 'delivered' ? 'تکمیل شده' : 'در حال پردازش'}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400">
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