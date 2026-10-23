import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileQuestion,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { CreditApplicationDTO } from '@tamas/shared';
import {
  buildCreditReportAnalytics,
  type AdminCreditReport,
  type CreditPortfolioPriority,
  type CreditRiskBucket,
} from './creditReportAnalytics';

interface CreditReportsDashboardProps {
  reports: AdminCreditReport[];
  applicants: CreditApplicationDTO[];
  loading: boolean;
  onSelectReport: (report: AdminCreditReport) => void;
}

type StatusFilter = 'all' | CreditPortfolioPriority | 'missing' | 'expired';
type SortMode = 'priority' | 'score_desc' | 'score_asc' | 'latest';

const riskLabels: Record<CreditRiskBucket, string> = {
  low: 'کم‌ریسک',
  medium: 'ریسک متوسط',
  high: 'پرریسک',
  unknown: 'نامشخص',
};

const priorityLabels: Record<CreditPortfolioPriority, string> = {
  urgent: 'اقدام فوری',
  follow_up: 'نیازمند پیگیری',
  normal: 'وضعیت عادی',
};

function percentLabel(min: number | null, max: number | null): string {
  if (min === null) return '—';
  return max === null || max === min
    ? `${min.toLocaleString('fa-IR')}٪`
    : `${min.toLocaleString('fa-IR')} تا ${max.toLocaleString('fa-IR')}٪`;
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fa-IR');
}

export function CreditReportsDashboard({ reports, applicants, loading, onSelectReport }: CreditReportsDashboardProps) {
  const analytics = useMemo(() => buildCreditReportAnalytics(reports, applicants), [reports, applicants]);
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | CreditRiskBucket>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('priority');

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('fa');
    const rows = analytics.rows.filter((row) => {
      if (riskFilter !== 'all' && row.risk !== riskFilter) return false;
      if (statusFilter === 'missing' && row.report) return false;
      if (statusFilter === 'expired' && !row.report?.isExpired) return false;
      if (statusFilter === 'urgent' && row.priority !== 'urgent') return false;
      if (statusFilter === 'follow_up' && row.priority !== 'follow_up') return false;
      if (statusFilter === 'normal' && row.priority !== 'normal') return false;
      if (!normalizedQuery) return true;
      return [row.userName, row.userPhone, row.userStoreName, row.nationalId]
        .some((value) => value.toLocaleLowerCase('fa').includes(normalizedQuery));
    });

    return [...rows].sort((a, b) => {
      if (sortMode === 'score_desc') return (b.report?.score ?? -1) - (a.report?.score ?? -1);
      if (sortMode === 'score_asc') return (a.report?.score ?? Number.MAX_SAFE_INTEGER) - (b.report?.score ?? Number.MAX_SAFE_INTEGER);
      if (sortMode === 'latest') return Date.parse(b.report?.createdAt ?? '1970-01-01') - Date.parse(a.report?.createdAt ?? '1970-01-01');
      const rank: Record<CreditPortfolioPriority, number> = { urgent: 0, follow_up: 1, normal: 2 };
      return rank[a.priority] - rank[b.priority] || (a.report?.score ?? -1) - (b.report?.score ?? -1);
    });
  }, [analytics.rows, query, riskFilter, sortMode, statusFilter]);

  if (loading) {
    return (
      <section className="credit-dashboard-loading" aria-live="polite">
        <span className="credit-dashboard-spinner" aria-hidden="true" />
        <strong>در حال تحلیل پرونده‌های اعتبارسنجی…</strong>
        <small>گزارش‌ها و شاخص‌های تجمیعی در حال آماده‌سازی هستند.</small>
      </section>
    );
  }

  const kpis = [
    {
      key: 'coverage', icon: ShieldCheck, tone: 'brand', label: 'پوشش اعتبارسنجی',
      value: analytics.coveragePercent === null ? '—' : `${analytics.coveragePercent.toLocaleString('fa-IR')}٪`,
      note: `${analytics.coveredCount.toLocaleString('fa-IR')} از ${analytics.portfolioCount.toLocaleString('fa-IR')} متقاضی`,
    },
    {
      key: 'valid', icon: CheckCircle2, tone: 'success', label: 'گزارش معتبر',
      value: analytics.validCount.toLocaleString('fa-IR'), note: `${analytics.expiringSoonCount.toLocaleString('fa-IR')} مورد نزدیک به انقضا`,
    },
    {
      key: 'score', icon: BarChart3, tone: 'info', label: 'میانگین امتیاز',
      value: analytics.averageScore?.toLocaleString('fa-IR') ?? '—', note: reports.length ? `دقت استخراج ${analytics.averageConfidence?.toLocaleString('fa-IR') ?? '—'}٪` : 'هنوز امتیازی ثبت نشده',
    },
    {
      key: 'urgent', icon: AlertTriangle, tone: 'danger', label: 'نیازمند اقدام فوری',
      value: analytics.urgentCount.toLocaleString('fa-IR'), note: `${analytics.highRiskCount.toLocaleString('fa-IR')} مشتری پرریسک`,
    },
    {
      key: 'bounced', icon: Activity, tone: 'warning', label: 'دارای چک برگشتی',
      value: analytics.bouncedCustomerCount.toLocaleString('fa-IR'), note: `${analytics.bouncedChequeTotal.toLocaleString('fa-IR')} فقره در گزارش‌های جاری`,
    },
  ] as const;

  const totalRisk = analytics.riskDistribution.reduce((sum, item) => sum + item.count, 0);
  let donutCursor = 0;
  const donutStops = analytics.riskDistribution.map((item) => {
    const start = donutCursor;
    donutCursor += totalRisk ? (item.count / totalRisk) * 100 : 0;
    return `${item.color} ${start}% ${donutCursor}%`;
  });
  const scoreMaximum = Math.max(1, ...analytics.scoreDistribution.map((item) => item.count));
  const trendHasData = analytics.trend.some((item) => item.reports > 0);

  return (
    <div className="credit-insights">
      <section className="credit-insights-intro">
        <div>
          <span className="credit-eyebrow"><Users size={15} /> نمای تجمیعی مشتریان</span>
          <h2>داشبورد هوشمند اعتبارسنجی</h2>
          <p>آخرین وضعیت هر مشتری، ریسک‌ها و تاریخچه گزارش‌ها به‌صورت خودکار از داده‌های ICS24 تجمیع شده است.</p>
        </div>
        <div className="credit-data-freshness">
          <span>دامنه تحلیل</span>
          <strong>{analytics.portfolioCount.toLocaleString('fa-IR')} متقاضی اعتبار</strong>
          <small>{reports.length.toLocaleString('fa-IR')} نسخه تاریخی گزارش</small>
        </div>
      </section>

      <section className="credit-kpi-grid" aria-label="شاخص‌های کلیدی اعتبارسنجی">
        {kpis.map(({ key, icon: Icon, tone, label, value, note }) => (
          <article key={key} className={`credit-kpi credit-kpi--${tone}`}>
            <span className="credit-kpi-icon" aria-hidden="true"><Icon size={20} /></span>
            <div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
          </article>
        ))}
      </section>

      {(analytics.missingCount > 0 || analytics.expiredCount > 0 || analytics.reviewNeededCount > 0) && (
        <section className="credit-attention-panel" aria-label="موارد نیازمند توجه">
          <div className="credit-attention-head"><AlertTriangle size={19} /><div><strong>صف پیگیری هوشمند</strong><small>موارد مهم بر اساس آخرین گزارش هر مشتری مرتب شده‌اند.</small></div></div>
          <div className="credit-attention-items">
            <button type="button" onClick={() => setStatusFilter('missing')}><strong>{analytics.missingCount.toLocaleString('fa-IR')}</strong><span>فاقد گزارش</span></button>
            <button type="button" onClick={() => setStatusFilter('expired')}><strong>{analytics.expiredCount.toLocaleString('fa-IR')}</strong><span>گزارش منقضی</span></button>
            <button type="button" onClick={() => setStatusFilter('follow_up')}><strong>{analytics.expiringSoonCount.toLocaleString('fa-IR')}</strong><span>نزدیک به انقضا</span></button>
            <button type="button" onClick={() => setStatusFilter('urgent')}><strong>{analytics.reviewNeededCount.toLocaleString('fa-IR')}</strong><span>نیازمند بازبینی</span></button>
          </div>
        </section>
      )}

      <section className="credit-chart-grid">
        <article className="credit-chart-card">
          <header><div><span className="credit-card-icon"><ShieldCheck size={18} /></span><div><h3>توزیع ریسک جاری</h3><p>بر مبنای آخرین گزارش هر مشتری</p></div></div><strong>{totalRisk.toLocaleString('fa-IR')} گزارش</strong></header>
          {totalRisk === 0 ? (
            <div className="credit-chart-empty"><FileQuestion size={34} /><strong>داده‌ای برای تحلیل ریسک نیست</strong><span>پس از بارگذاری اولین گزارش ICS24، نمودار خودکار ساخته می‌شود.</span></div>
          ) : (
            <div className="credit-donut-layout">
              <div className="credit-donut" role="img" aria-label={analytics.riskDistribution.map((item) => `${item.label}: ${item.count}`).join('، ')} style={{ background: `conic-gradient(${donutStops.join(', ')})` }}>
                <div><strong>{totalRisk.toLocaleString('fa-IR')}</strong><span>مشتری</span></div>
              </div>
              <ul className="credit-chart-legend">
                {analytics.riskDistribution.map((item) => <li key={item.key}><i style={{ backgroundColor: item.color }} /><span>{item.label}</span><strong>{item.count.toLocaleString('fa-IR')}</strong></li>)}
              </ul>
            </div>
          )}
        </article>

        <article className="credit-chart-card">
          <header><div><span className="credit-card-icon"><BarChart3 size={18} /></span><div><h3>سطح امتیاز اعتباری</h3><p>تعداد مشتری در هر بازه امتیاز</p></div></div><strong>{analytics.averageScore?.toLocaleString('fa-IR') ?? '—'} میانگین</strong></header>
          {totalRisk === 0 ? (
            <div className="credit-chart-empty"><BarChart3 size={34} /><strong>هنوز امتیازی ثبت نشده</strong><span>بازه‌های امتیازی پس از استخراج گزارش نمایش داده می‌شوند.</span></div>
          ) : (
            <div className="credit-score-bars" role="img" aria-label="توزیع مشتریان در بازه‌های امتیاز اعتباری">
              {analytics.scoreDistribution.map((item) => (
                <div className="credit-score-row" key={item.key}>
                  <div><span>{item.label}</span><strong>{item.count.toLocaleString('fa-IR')}</strong></div>
                  <span className="credit-score-track"><i style={{ width: `${(item.count / scoreMaximum) * 100}%`, backgroundColor: item.color }} /></span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="credit-chart-card credit-chart-card--wide">
          <header><div><span className="credit-card-icon"><Activity size={18} /></span><div><h3>روند شش‌ماهه گزارش‌ها</h3><p>حجم گزارش‌های ثبت‌شده و میانگین امتیاز ماهانه</p></div></div></header>
          {!trendHasData ? (
            <div className="credit-chart-empty credit-chart-empty--short"><Activity size={34} /><strong>روند زمانی هنوز شکل نگرفته</strong><span>با ثبت گزارش‌های جدید، تغییرات ماهانه اینجا قابل مشاهده است.</span></div>
          ) : (
            <div className="credit-trend" role="img" aria-label="روند شش‌ماهه تعداد گزارش و میانگین امتیاز">
              {analytics.trend.map((item) => (
                <div className="credit-trend-column" key={item.month}>
                  <span className="credit-trend-score">{item.averageScore?.toLocaleString('fa-IR') ?? '—'}</span>
                  <div className="credit-trend-track"><i style={{ height: `${Math.max(6, Math.min(100, item.reports * 18))}%` }} /></div>
                  <strong>{item.reports.toLocaleString('fa-IR')} گزارش</strong>
                  <small>{item.label}</small>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="credit-portfolio-card">
        <header className="credit-portfolio-head">
          <div><span className="credit-card-icon"><Users size={18} /></span><div><h3>جدول تجمیعی مشتریان</h3><p>هر مشتری یک ردیف؛ تصمیم‌گیری بر پایه آخرین گزارش و سابقه کامل</p></div></div>
          <span>{filteredRows.length.toLocaleString('fa-IR')} از {analytics.rows.length.toLocaleString('fa-IR')} مشتری</span>
        </header>

        <div className="credit-portfolio-toolbar">
          <label className="credit-search"><Search size={17} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی نام، فروشگاه، موبایل یا کد ملی…" aria-label="جست‌وجوی مشتری" /></label>
          <label><span>ریسک</span><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as 'all' | CreditRiskBucket)}><option value="all">همه سطوح</option><option value="low">کم‌ریسک</option><option value="medium">متوسط</option><option value="high">پرریسک</option><option value="unknown">نامشخص</option></select></label>
          <label><span>وضعیت</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">همه وضعیت‌ها</option><option value="urgent">اقدام فوری</option><option value="follow_up">نیازمند پیگیری</option><option value="normal">عادی</option><option value="missing">فاقد گزارش</option><option value="expired">منقضی</option></select></label>
          <label><span>مرتب‌سازی</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="priority">اولویت پیگیری</option><option value="score_desc">بیشترین امتیاز</option><option value="score_asc">کمترین امتیاز</option><option value="latest">جدیدترین گزارش</option></select></label>
        </div>

        <div className="credit-table-wrap">
          <table className="credit-portfolio-table">
            <thead><tr><th>مشتری</th><th>امتیاز و ریسک</th><th>احتمال خوش‌حسابی</th><th>چک و استعلام</th><th>گزارش جاری</th><th>تحلیل و اولویت</th><th>عملیات</th></tr></thead>
            <tbody>
              {filteredRows.map((row) => {
                const report = row.report;
                const inquiries = report?.data.inquiryCounts;
                return (
                  <tr key={row.userId}>
                    <td><strong>{row.userName}</strong><span>{row.userStoreName || row.userPhone || 'بدون اطلاعات تماس'}</span>{row.userStoreName && row.userPhone && <small>{row.userPhone}</small>}</td>
                    <td>{report ? <><strong className="credit-score-value">{report.score?.toLocaleString('fa-IR') ?? '—'}</strong><span className={`credit-risk credit-risk--${row.risk}`}>{[report.riskGrade, riskLabels[row.risk]].filter(Boolean).join(' · ')}</span></> : <span className="credit-muted">بدون گزارش</span>}</td>
                    <td><strong>{report ? percentLabel(report.goodPayerMinPercent, report.goodPayerMaxPercent) : '—'}</strong></td>
                    <td>{report ? <><strong className={(report.bouncedChequeCount ?? 0) > 0 ? 'credit-danger-text' : ''}>{(report.bouncedChequeCount ?? 0).toLocaleString('fa-IR')} چک برگشتی</strong><span>{(inquiries?.oneMonth ?? 0).toLocaleString('fa-IR')} استعلام ماه / {(inquiries?.oneYear ?? 0).toLocaleString('fa-IR')} سال</span></> : '—'}</td>
                    <td>{report ? <><strong>{dateLabel(report.createdAt)}</strong><span className={report.isExpired ? 'credit-danger-text' : ''}>{report.isExpired ? 'منقضی شده' : `معتبر تا ${dateLabel(report.expiresAt)}`}</span><small>{row.historyCount.toLocaleString('fa-IR')} نسخه در تاریخچه</small></> : <span className="credit-muted">بارگذاری نشده</span>}</td>
                    <td><span className={`credit-priority credit-priority--${row.priority}`}>{priorityLabels[row.priority]}</span><div className="credit-priority-reasons">{row.priorityReasons.length ? row.priorityReasons.slice(0, 3).map((reason) => <small key={reason}>{reason}</small>) : <small>مورد خاصی شناسایی نشد</small>}</div></td>
                    <td><div className="credit-row-actions">{report ? <><button type="button" onClick={() => onSelectReport(report)}><Eye size={15} /> جزئیات</button><a href={report.fileUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> PDF</a></> : <span>در انتظار فایل مشتری</span>}</div></td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && <tr><td colSpan={7}><div className="credit-table-empty"><FileQuestion size={28} /><strong>مشتری مطابق فیلترها پیدا نشد</strong><span>فیلترها یا عبارت جست‌وجو را تغییر دهید.</span></div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
