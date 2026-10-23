import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleGauge,
  ExternalLink,
  FileSearch,
  Landmark,
  Printer,
  ScanText,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { classifyCreditRisk, type AdminCreditReport, type CreditRiskBucket } from './creditReportAnalytics';

interface CreditReportOverviewProps {
  report: AdminCreditReport;
  onClose: () => void;
}

const riskLabels: Record<CreditRiskBucket, string> = {
  low: 'ریسک پایین',
  medium: 'ریسک متوسط',
  high: 'ریسک بالا',
  unknown: 'ریسک نامشخص',
};

function formatDate(value: string | null): string {
  if (!value) return 'ثبت نشده';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('fa-IR');
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value.toLocaleString('fa-IR')}٪`;
}

export function CreditReportOverview({ report, onClose }: CreditReportOverviewProps) {
  const risk = classifyCreditRisk(report);
  const score = report.score;
  const scoreProgress = score === null ? 0 : Math.max(0, Math.min(100, (score / 900) * 100));
  const payerMin = report.goodPayerMinPercent;
  const payerMax = report.goodPayerMaxPercent;
  const inquiryMonth = report.data.inquiryCounts.oneMonth;
  const inquiryYear = report.data.inquiryCounts.oneYear;
  const inquiryMaximum = Math.max(1, inquiryMonth ?? 0, inquiryYear ?? 0);
  const bounced = report.bouncedChequeCount ?? 0;
  const extractionLabel = report.extractionStatus === 'parsed'
    ? 'استخراج کامل'
    : report.extractionStatus === 'needs_review'
      ? 'نیازمند بازبینی'
      : 'استخراج ناموفق';
  const attentionItems = [
    bounced > 0 ? `${bounced.toLocaleString('fa-IR')} فقره چک برگشتی در گزارش ثبت شده است.` : null,
    risk === 'high' ? 'سطح ریسک گزارش بالا است.' : null,
    risk === 'medium' ? 'سطح ریسک گزارش متوسط است و نیاز به بررسی تکمیلی دارد.' : null,
    score !== null && score < 600 ? 'امتیاز اعتباری کمتر از ۶۰۰ است.' : null,
    report.isExpired ? 'اعتبار این گزارش منقضی شده و باید گزارش جدید دریافت شود.' : null,
    report.extractionStatus !== 'parsed' ? 'اطلاعات استخراج‌شده باید توسط اپراتور بازبینی شود.' : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <article className="credit-report-overview">
      <header className="credit-report-hero">
        <div className="credit-report-identity">
          <span className="credit-report-avatar" aria-hidden="true"><UserRound size={26} /></span>
          <div>
            <span>گزارش جامع اعتبارسنجی مشتری</span>
            <h2>{report.userName}</h2>
            <p>{[report.userStoreName, report.userPhone].filter(Boolean).join(' · ') || 'اطلاعات تماس ثبت نشده'}</p>
          </div>
        </div>
        <div className="credit-report-actions">
          <button type="button" onClick={() => window.print()}><Printer size={16} /> چاپ / ذخیره PDF</button>
          <a href={report.fileUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> فایل اصلی ICS24</a>
        </div>
      </header>

      <section className="credit-report-summary">
        <div className={`credit-score-gauge credit-score-gauge--${risk}`} role="img" aria-label={`امتیاز اعتباری ${score ?? 'نامشخص'} از ۹۰۰`} style={{ '--credit-score-progress': `${scoreProgress}%` } as CSSProperties}>
          <div className="credit-score-gauge__inner">
            <span>امتیاز اعتباری</span>
            <strong>{score?.toLocaleString('fa-IR') ?? '—'}</strong>
            <small>از ۹۰۰</small>
          </div>
        </div>

        <div className="credit-report-decision">
          <div className="credit-report-section-label"><CircleGauge size={17} /><span>برداشت مدیریتی از گزارش</span></div>
          <div className="credit-report-risk-line">
            <span className={`credit-report-risk-badge credit-report-risk-badge--${risk}`}>{report.riskGrade || 'بدون رتبه'} · {riskLabels[risk]}</span>
            <span className={`credit-report-validity ${report.isExpired ? 'is-expired' : ''}`}>{report.isExpired ? 'منقضی' : `معتبر تا ${formatDate(report.expiresAt)}`}</span>
          </div>
          <p>{attentionItems.length > 0 ? attentionItems[0] : 'در داده‌های استخراج‌شده مورد پرخطر فوری شناسایی نشده است.'}</p>
          <small>این جمع‌بندی جایگزین تصمیم نهایی واحد اعتبار نیست و بر اساس داده‌های همین نسخه گزارش ساخته شده است.</small>
        </div>

        <div className="credit-confidence-ring" role="img" aria-label={`دقت استخراج ${report.confidence} درصد`} style={{ '--credit-confidence': `${Math.max(0, Math.min(100, report.confidence))}%` } as CSSProperties}>
          <div><strong>{formatPercent(report.confidence)}</strong><span>دقت استخراج</span></div>
        </div>
      </section>

      <section className="credit-report-kpis" aria-label="شاخص‌های اصلی گزارش مشتری">
        <article><span className="tone-blue"><CheckCircle2 size={18} /></span><div><small>احتمال خوش‌حسابی</small><strong>{payerMin === null ? '—' : `${formatPercent(payerMin)} تا ${formatPercent(payerMax ?? payerMin)}`}</strong></div></article>
        <article><span className={bounced > 0 ? 'tone-red' : 'tone-green'}><ShieldAlert size={18} /></span><div><small>چک برگشتی</small><strong>{bounced.toLocaleString('fa-IR')} فقره</strong></div></article>
        <article><span className="tone-amber"><Activity size={18} /></span><div><small>استعلام یک‌ساله</small><strong>{inquiryYear?.toLocaleString('fa-IR') ?? '—'} مورد</strong></div></article>
        <article><span className="tone-violet"><ScanText size={18} /></span><div><small>وضعیت پردازش</small><strong>{extractionLabel}</strong></div></article>
      </section>

      <section className="credit-report-grid">
        <article className="credit-report-card credit-report-card--chart">
          <header><div><CheckCircle2 size={18} /><span><strong>بازه احتمال خوش‌حسابی</strong><small>برآورد ثبت‌شده در گزارش ICS24</small></span></div></header>
          {payerMin === null ? (
            <div className="credit-overview-empty">این شاخص در گزارش استخراج نشده است.</div>
          ) : (
            <div className="credit-payer-chart" role="img" aria-label={`احتمال خوش‌حسابی از ${payerMin} تا ${payerMax ?? payerMin} درصد`}>
              <div className="credit-payer-value"><strong>{formatPercent(payerMin)}</strong><span>حداقل</span><strong>{formatPercent(payerMax)}</strong><span>حداکثر</span></div>
              <div className="credit-payer-scale"><i style={{ right: `${payerMin}%`, width: `${Math.max(2, (payerMax ?? payerMin) - payerMin)}%` }} /></div>
              <div className="credit-payer-ticks"><span>۰٪</span><span>۲۵٪</span><span>۵۰٪</span><span>۷۵٪</span><span>۱۰۰٪</span></div>
            </div>
          )}
        </article>

        <article className="credit-report-card credit-report-card--chart">
          <header><div><Activity size={18} /><span><strong>تعداد استعلام‌های اعتباری</strong><small>مقایسه یک‌ماهه و یک‌ساله</small></span></div></header>
          {inquiryMonth === null && inquiryYear === null ? (
            <div className="credit-overview-empty">آمار استعلام در گزارش موجود نیست.</div>
          ) : (
            <div className="credit-inquiry-chart" role="img" aria-label={`استعلام یک‌ماهه ${inquiryMonth ?? 'نامشخص'} و یک‌ساله ${inquiryYear ?? 'نامشخص'}`}>
              {[
                { label: 'یک ماه اخیر', value: inquiryMonth, color: '#06b6d4' },
                { label: 'یک سال اخیر', value: inquiryYear, color: '#8b5cf6' },
              ].map((item) => <div key={item.label}><span>{item.label}</span><div><i style={{ width: item.value === null ? 0 : `${Math.max(4, (item.value / inquiryMaximum) * 100)}%`, backgroundColor: item.color }} /></div><strong>{item.value?.toLocaleString('fa-IR') ?? '—'}</strong></div>)}
            </div>
          )}
        </article>
      </section>

      {attentionItems.length > 0 && (
        <section className="credit-report-alerts">
          <header><AlertTriangle size={19} /><div><strong>موارد نیازمند توجه اپراتور</strong><small>این موارد از شاخص‌های قابل‌مشاهده همین گزارش استخراج شده‌اند.</small></div></header>
          <div>{attentionItems.map((item) => <p key={item}><i aria-hidden="true" />{item}</p>)}</div>
        </section>
      )}

      <section className="credit-report-card">
        <header><div><UserRound size={18} /><span><strong>اطلاعات هویتی و مشخصات گزارش</strong><small>برای تطبیق مشتری با سند اصلی</small></span></div></header>
        <div className="credit-identity-grid">
          {[
            ['نام و نام خانوادگی', report.data.identity.fullName],
            ['کد ملی', report.data.identity.nationalId],
            ['نام پدر', report.data.identity.fatherName],
            ['تاریخ تولد', report.data.identity.birthDate],
            ['محل تولد', report.data.identity.birthPlace],
            ['شماره موبایل', report.data.identity.mobile],
            ['شماره گزارش', report.reportNumber],
            ['تاریخ گزارش', report.reportDate],
          ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || 'ثبت نشده'}</strong></div>)}
        </div>
      </section>

      <section className="credit-report-grid credit-report-grid--content">
        <article className="credit-report-card">
          <header><div><ShieldAlert size={18} /><span><strong>عوامل کاهش امتیاز</strong><small>{report.data.negativeReasons.length.toLocaleString('fa-IR')} عامل ثبت‌شده در گزارش</small></span></div></header>
          {report.data.negativeReasons.length === 0 ? <div className="credit-overview-empty">عامل کاهنده‌ای استخراج نشده است.</div> : (
            <ol className="credit-negative-reasons">{report.data.negativeReasons.map((reason, index) => <li key={`${reason.code}-${index}`}><span>{reason.code}</span><p>{reason.description}</p></li>)}</ol>
          )}
        </article>

        <article className="credit-report-card">
          <header><div><Landmark size={18} /><span><strong>سوابق مالیاتی</strong><small>وضعیت ثبت‌شده به تفکیک سال</small></span></div></header>
          {report.data.taxStatuses.length === 0 ? <div className="credit-overview-empty">سابقه مالیاتی استخراج نشده است.</div> : (
            <div className="credit-tax-timeline">{report.data.taxStatuses.map((item) => <div key={`${item.year}-${item.status}`}><span>{item.year}</span><i aria-hidden="true" /><p>{item.status}</p></div>)}</div>
          )}
        </article>
      </section>

      <section className="credit-report-card credit-report-meta">
        <header><div><FileSearch size={18} /><span><strong>کنترل کیفیت و اعتبار سند</strong><small>اطلاعات فنی این نسخه تاریخی</small></span></div></header>
        <div className="credit-report-meta-grid">
          <div><CalendarClock size={17} /><span>ثبت در سامانه</span><strong>{new Date(report.createdAt).toLocaleString('fa-IR')}</strong></div>
          <div><CalendarClock size={17} /><span>تاریخ انقضا</span><strong>{formatDate(report.expiresAt)}</strong></div>
          <div><ScanText size={17} /><span>صفحات استخراج‌شده</span><strong>{report.data.pages.length.toLocaleString('fa-IR')} صفحه</strong></div>
          <div><CheckCircle2 size={17} /><span>اعتماد استخراج</span><strong>{formatPercent(report.confidence)}</strong></div>
        </div>
        {(report.warnings.length > 0 || report.data.warnings.length > 0) && <div className="credit-report-warnings">{[...new Set([...report.warnings, ...report.data.warnings])].map((warning) => <p key={warning}><AlertTriangle size={14} />{warning}</p>)}</div>}
      </section>

      <section className="credit-report-card credit-report-pages">
        <header><div><ScanText size={18} /><span><strong>متن کامل استخراج‌شده از PDF</strong><small>برای کنترل دستی و تطبیق با سند اصلی</small></span></div></header>
        <div>{report.data.pages.map((page) => (
          <details key={page.page}>
            <summary>صفحه {page.page.toLocaleString('fa-IR')}<span>{page.rows.length.toLocaleString('fa-IR')} ردیف متن</span></summary>
            <pre>{page.rows.join('\n')}</pre>
          </details>
        ))}</div>
      </section>

      <footer className="credit-report-footer">
        <div><FileSearch size={18} /><span><strong>منبع داده: گزارش ICS24</strong><small>اطلاعات نمایش‌داده‌شده مربوط به همین نسخه تاریخی است.</small></span></div>
        <div><button type="button" onClick={onClose}>بستن گزارش</button><a href={report.fileUrl} target="_blank" rel="noreferrer">مشاهده PDF اصلی</a></div>
      </footer>
    </article>
  );
}
