import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  CreditCard,
  Landmark,
  LogOut,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import type { InvestorDashboardDTO } from '@tamas/shared';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { AuthDialog } from '../storefront/AuthDialog';
import './investor.css';

type Range = InvestorDashboardDTO['period']['range'];

const ranges: Array<{ value: Range; label: string }> = [
  { value: '7d', label: '۷ روز' },
  { value: '30d', label: '۳۰ روز' },
  { value: '90d', label: '۳ ماه' },
  { value: '365d', label: 'یک سال' },
];

const entryLabels: Record<string, string> = {
  capital_injection: 'افزایش سرمایه',
  capital_withdrawal: 'برداشت سرمایه',
  purchase: 'خرید کالا',
  expense: 'هزینه جاری',
  profit_distribution: 'تقسیم سود',
  adjustment: 'اصلاح حساب',
};

function money(value: number): string {
  return `${Math.round(value).toLocaleString('fa-IR')} تومان`;
}

function percent(value: number): string {
  return `${value.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪`;
}

function MetricCard({ label, value, detail, tone, icon }: {
  label: string;
  value: string;
  detail: string;
  tone: 'emerald' | 'blue' | 'amber' | 'violet' | 'rose' | 'slate';
  icon: React.ReactNode;
}) {
  return (
    <article className={`iv-metric iv-metric--${tone}`}>
      <div className="iv-metric__top"><span className="iv-metric__icon">{icon}</span><span>{label}</span></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function TrendChart({ data }: { data: InvestorDashboardDTO['trend'] }) {
  const chart = useMemo(() => {
    if (data.length === 0) return null;
    const width = 760;
    const height = 220;
    const pad = 18;
    const max = Math.max(1, ...data.flatMap((point) => [point.sales, Math.max(0, point.profit)]));
    const point = (value: number, index: number) => {
      const x = data.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (data.length - 1);
      const y = height - pad - (Math.max(0, value) / max) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };
    return {
      sales: data.map((item, index) => point(item.sales, index)).join(' '),
      profit: data.map((item, index) => point(item.profit, index)).join(' '),
      area: `${pad},${height - pad} ${data.map((item, index) => point(item.sales, index)).join(' ')} ${width - pad},${height - pad}`,
    };
  }, [data]);

  if (!chart) return <div className="iv-empty">در این بازه فروش قطعی ثبت نشده است.</div>;
  return (
    <div className="iv-chart" role="img" aria-label="نمودار روند فروش و سود">
      <svg viewBox="0 0 760 220" preserveAspectRatio="none">
        <defs>
          <linearGradient id="iv-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#14b8a6" stopOpacity=".28" />
            <stop offset="1" stopColor="#14b8a6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="18" y1="202" x2="742" y2="202" className="iv-chart__grid" />
        <line x1="18" y1="110" x2="742" y2="110" className="iv-chart__grid" />
        <polygon points={chart.area} fill="url(#iv-area)" />
        <polyline points={chart.sales} className="iv-chart__sales" />
        <polyline points={chart.profit} className="iv-chart__profit" />
      </svg>
      <div className="iv-chart__legend"><span><i className="sales" />فروش خالص</span><span><i className="profit" />سود عملیاتی</span></div>
    </div>
  );
}

function LoadingScreen() {
  return <div className="iv-state"><RefreshCw className="iv-spin" /><strong>در حال آماده‌سازی گزارش سرمایه‌گذار…</strong></div>;
}

export default function InvestorApp() {
  const { user, ready, isAdmin, isInvestor, logout } = useAuth();
  const [range, setRange] = useState<Range>('30d');
  const [authOpen, setAuthOpen] = useState(false);
  const [light, setLight] = useState(() => localStorage.getItem('tamas_investor_theme') === 'light');
  const allowed = isAdmin || isInvestor;
  const dashboard = useQuery({
    queryKey: ['investor', 'dashboard', range],
    queryFn: async () => (await api.get<{ dashboard: InvestorDashboardDTO }>('/investor/dashboard', { range })).dashboard,
    enabled: ready && Boolean(user) && allowed,
  });

  const changeTheme = () => setLight((current) => {
    localStorage.setItem('tamas_investor_theme', current ? 'dark' : 'light');
    return !current;
  });

  if (!ready) return <LoadingScreen />;
  if (!user) {
    return (
      <div className="iv-gate" dir="rtl">
        <div className="iv-gate__card"><Landmark /><h1>پنل سرمایه‌گذار</h1><p>برای مشاهده گزارش مالی امن، وارد حساب سرمایه‌گذار شوید.</p><button onClick={() => setAuthOpen(true)}>ورود به پنل</button><Link to="/">بازگشت به فروشگاه</Link></div>
        <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} onReady={() => setAuthOpen(false)} />
      </div>
    );
  }
  if (!allowed) {
    return <div className="iv-gate" dir="rtl"><div className="iv-gate__card"><ShieldCheck /><h1>دسترسی محدود است</h1><p>این حساب مجوز مشاهده اطلاعات سرمایه‌گذاری را ندارد.</p><Link className="iv-gate__primary" to="/account">بازگشت به حساب کاربری</Link></div></div>;
  }
  if (dashboard.isLoading) return <LoadingScreen />;
  if (dashboard.isError || !dashboard.data) {
    return <div className="iv-gate" dir="rtl"><div className="iv-gate__card"><ReceiptText /><h1>گزارش دریافت نشد</h1><p>{dashboard.error instanceof Error ? dashboard.error.message : 'خطای ناشناخته'}</p><button onClick={() => void dashboard.refetch()}>تلاش دوباره</button></div></div>;
  }

  const data = dashboard.data;
  const metrics = data.metrics;
  const negativeProfit = metrics.netProfit < 0;

  return (
    <div className={`iv-shell${light ? ' iv-shell--light' : ''}`} dir="rtl">
      <header className="iv-header">
        <div className="iv-header__brand"><span><Landmark /></span><div><strong>{data.settings.companyLabel}</strong><small>سامانه گزارش‌دهی سرمایه‌گذار</small></div></div>
        <div className="iv-header__actions">
          <Link to="/">فروشگاه</Link>
          {isAdmin ? <Link to="/admin/financial">مدیریت مالی</Link> : null}
          <button className="iv-theme" onClick={changeTheme} aria-label="تغییر پوسته">{light ? '◐' : '☼'}</button>
          <button className="iv-logout" onClick={() => void logout()}><LogOut size={17} /> خروج</button>
        </div>
      </header>

      <main className="iv-main">
        <section className="iv-hero">
          <div><span className="iv-eyebrow"><ShieldCheck size={15} /> گزارش محرمانه و به‌روز</span><h1>داشبورد سرمایه‌گذاری</h1><p>نمای یکپارچه سرمایه، موجودی، عملیات فروش و سهم سود</p></div>
          <div className="iv-period" aria-label="بازه گزارش">{ranges.map((item) => <button key={item.value} className={range === item.value ? 'active' : ''} onClick={() => setRange(item.value)}>{item.label}</button>)}</div>
        </section>

        {data.dataQuality.inventoryCostCoveragePercent < 100 || data.dataQuality.salesCostCoveragePercent < 100 ? (
          <aside className="iv-quality"><span>!</span><div><strong>کیفیت محاسبه سود نیاز به تکمیل دارد</strong><p>پوشش قیمت خرید موجودی {percent(data.dataQuality.inventoryCostCoveragePercent)} و پوشش بهای تمام‌شده فروش {percent(data.dataQuality.salesCostCoveragePercent)} است. تا تکمیل قیمت خریدها، سود نمایش‌داده‌شده بیشتر از مقدار واقعی به نظر می‌رسد.</p></div></aside>
        ) : null}

        <section className="iv-metrics">
          <MetricCard label="موجودی تعدادی" value={`${metrics.inventoryUnits.toLocaleString('fa-IR')} عدد`} detail={`${data.dataQuality.productsWithoutCost.toLocaleString('fa-IR')} کالا بدون قیمت خرید`} tone="blue" icon={<Boxes />} />
          <MetricCard label="ارزش موجودی" value={money(metrics.inventoryValue)} detail={`پوشش ارزش‌گذاری ${percent(data.dataQuality.inventoryCostCoveragePercent)}`} tone="violet" icon={<PackageCheck />} />
          <MetricCard label="فروش خالص" value={money(metrics.netSales)} detail={`${metrics.orderCount.toLocaleString('fa-IR')} سفارش قطعی`} tone="emerald" icon={<TrendingUp />} />
          <MetricCard label="خرید خالص" value={money(metrics.netPurchases)} detail="خریدهای پرداخت‌شده در بازه" tone="amber" icon={<ArrowDownLeft />} />
          <MetricCard label="هزینه‌های جاری" value={money(metrics.operatingExpenses)} detail="هزینه‌های عملیاتی پرداخت‌شده" tone="rose" icon={<ReceiptText />} />
          <MetricCard label="سرمایه در گردش" value={money(metrics.availableWorkingCapital)} detail={`سرمایه پایه ${money(data.settings.initialCapital)}`} tone="slate" icon={<WalletCards />} />
        </section>

        <section className="iv-grid iv-grid--profit">
          <article className="iv-panel iv-profit">
            <div className="iv-panel__head"><div><span>خلاصه عملکرد</span><h2>سود و سهم‌الشرکه</h2></div><CircleDollarSign /></div>
            <div className="iv-profit__main">
              <div className={`iv-profit__number${negativeProfit ? ' negative' : ''}`}><small>سود خالص دوره</small><strong>{money(metrics.netProfit)}</strong><span>حاشیه سود ناخالص {percent(metrics.grossMarginPercent)}</span></div>
              <div className="iv-ring" style={{ '--investor-share': `${data.settings.investorSharePercent * 3.6}deg` } as React.CSSProperties}><div><strong>{percent(data.settings.investorSharePercent)}</strong><small>سرمایه‌گذار</small></div></div>
            </div>
            <div className="iv-share-list">
              <div><span className="investor"><UsersRound /></span><p><small>سهم سرمایه‌گذار · {percent(data.settings.investorSharePercent)}</small><strong>{money(metrics.investorShare)}</strong></p></div>
              <div><span className="executor"><ArrowUpRight /></span><p><small>سهم مجری · {percent(data.settings.executorSharePercent)}</small><strong>{money(metrics.executorShare)}</strong></p></div>
            </div>
            {negativeProfit ? <p className="iv-loss-note">در دوره زیان ثبت شده و سودی برای تقسیم وجود ندارد.</p> : null}
          </article>

          <article className="iv-panel iv-trend">
            <div className="iv-panel__head"><div><span>روند زمانی</span><h2>فروش و سود عملیاتی</h2></div><TrendingUp /></div>
            <TrendChart data={data.trend} />
            <div className="iv-mini-stats"><div><small>بهای تمام‌شده</small><strong>{money(metrics.costOfGoodsSold)}</strong></div><div><small>سود ناخالص</small><strong>{money(metrics.grossProfit)}</strong></div><div><small>میانگین سفارش</small><strong>{money(metrics.averageOrderValue)}</strong></div></div>
          </article>
        </section>

        <section className="iv-grid">
          <article className="iv-panel">
            <div className="iv-panel__head"><div><span>ریسک وصول</span><h2>وضعیت چک‌ها</h2></div><CreditCard /></div>
            <div className="iv-cheques"><div className="pending"><small>در انتظار وصول</small><strong>{money(data.cheques.pendingAmount)}</strong><span>{data.cheques.pendingCount.toLocaleString('fa-IR')} فقره</span></div><div className="passed"><small>وصول‌شده</small><strong>{money(data.cheques.passedAmount)}</strong></div><div className="bounced"><small>برگشتی</small><strong>{money(data.cheques.bouncedAmount)}</strong><span>{data.cheques.bouncedCount.toLocaleString('fa-IR')} فقره</span></div></div>
          </article>

          <article className="iv-panel">
            <div className="iv-panel__head"><div><span>تمرکز سرمایه</span><h2>بیشترین ارزش موجودی</h2></div><Boxes /></div>
            <div className="iv-inventory-list">{data.topInventory.length === 0 ? <div className="iv-empty">موجودی ثبت نشده است.</div> : data.topInventory.slice(0, 5).map((item) => <div key={item.productId}><span>{item.title}<small>{item.sku || item.productId} · {item.units.toLocaleString('fa-IR')} عدد</small></span><strong>{money(item.value)}</strong></div>)}</div>
          </article>
        </section>

        <section className="iv-panel iv-ledger">
          <div className="iv-panel__head"><div><span>آخرین رویدادها</span><h2>گردش مالی سرمایه‌گذاری</h2></div><ReceiptText /></div>
          <div className="iv-table-wrap"><table><thead><tr><th>شرح</th><th>نوع</th><th>مبلغ</th><th>وضعیت</th><th>تاریخ</th></tr></thead><tbody>{data.recentEntries.length === 0 ? <tr><td colSpan={5} className="iv-empty">هنوز رویداد مالی ثبت نشده است.</td></tr> : data.recentEntries.map((entry) => <tr key={entry.id}><td><strong>{entry.title}</strong><small>{entry.reference || entry.category || 'بدون مرجع'}</small></td><td><span className={`iv-entry-type iv-entry-type--${entry.type}`}>{entryLabels[entry.type]}</span></td><td className="iv-money">{money(entry.amount)}</td><td><span className={`iv-status iv-status--${entry.status}`}>{entry.status === 'paid' ? 'قطعی' : entry.status === 'pending' ? 'در انتظار' : 'لغوشده'}</span></td><td>{new Date(entry.transactionDate).toLocaleDateString('fa-IR')}</td></tr>)}</tbody></table></div>
        </section>

        <footer className="iv-footer"><span><ShieldCheck size={15} /> اطلاعات این صفحه فقط برای حساب‌های مجاز نمایش داده می‌شود.</span><span>آخرین بروزرسانی: {new Date().toLocaleString('fa-IR')}</span></footer>
      </main>
    </div>
  );
}
