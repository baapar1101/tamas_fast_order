import { useState } from 'react';
import type { CreditReportSnapshotDTO } from '@tamas/shared';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

interface CreditReportPanelProps {
  currentReport: CreditReportSnapshotDTO | null;
  reports?: CreditReportSnapshotDTO[];
  onUploaded: () => Promise<void>;
  showHistory?: boolean;
}

function faDate(value: string): string {
  return new Date(value).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function CreditReportPanel({ currentReport, reports = [], onUploaded, showHistory = false }: CreditReportPanelProps) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const uploadReport = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('فقط فایل PDF صادرشده از ICS24 قابل قبول است.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.upload<{ ok: true; report: CreditReportSnapshotDTO; message: string }>('/credit/reports/upload', formData);
      toast.ok(response.message || 'گزارش اعتبارسنجی با موفقیت ثبت شد.');
      await onUploaded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خواندن گزارش اعتبارسنجی انجام نشد.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="credit-report-panel" aria-labelledby="credit-report-title">
      <div className="credit-report-head">
        <div>
          <span className="credit-report-kicker">گزارش رسمی اعتبارسنجی</span>
          <h3 id="credit-report-title">گزارش ICS24</h3>
          <p>
            گزارش شخص حقیقی را از سایت ICS24 دریافت کنید. سامانه اطلاعات آن را خودکار استخراج می‌کند و نسخه‌های قبلی را نگه می‌دارد.
          </p>
        </div>
        <a className="btn ghost credit-report-link" href="https://ics24.ir/" target="_blank" rel="noreferrer">
          دریافت گزارش از ICS24 ↗
        </a>
      </div>

      {currentReport ? (
        <div className="credit-report-summary">
          <div><span>امتیاز اعتباری</span><strong>{currentReport.score?.toLocaleString('fa-IR') ?? '—'}</strong></div>
          <div><span>رتبه ریسک</span><strong>{currentReport.riskGrade ?? '—'}</strong></div>
          <div><span>سطح ریسک</span><strong>{currentReport.riskLevel ?? '—'}</strong></div>
          <div><span>اعتبار گزارش تا</span><strong>{faDate(currentReport.expiresAt)}</strong></div>
        </div>
      ) : (
        <div className="credit-report-empty">
          <strong>گزارش معتبر ثبت نشده است.</strong>
          <span>برای تکمیل پرونده، PDF جدید و متعلق به همین کد ملی را بارگذاری کنید.</span>
        </div>
      )}

      <div className="credit-report-actions">
        <input
          id={showHistory ? 'credit-report-dashboard-input' : 'credit-report-form-input'}
          type="file"
          accept="application/pdf,.pdf"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void uploadReport(file);
          }}
        />
        <label
          className={`btn primary${uploading ? ' disabled' : ''}`}
          htmlFor={showHistory ? 'credit-report-dashboard-input' : 'credit-report-form-input'}
          aria-disabled={uploading}
        >
          {uploading ? 'در حال استخراج اطلاعات PDF…' : currentReport ? 'بارگذاری نسخه جدید' : 'انتخاب و تحلیل فایل PDF'}
        </label>
        <span>گزارش دو ماه اعتبار دارد؛ پس از آن نسخه تازه لازم است.</span>
      </div>

      {showHistory && reports.length > 0 ? (
        <div className="credit-report-history">
          <h4>تاریخچه گزارش‌ها</h4>
          {reports.map((report, index) => (
            <article key={report.id}>
              <div>
                <strong>{index === 0 ? 'آخرین گزارش' : `نسخه ${reports.length - index}`}</strong>
                <span>ثبت‌شده در {faDate(report.createdAt)} · شماره گزارش {report.reportNumber ?? 'نامشخص'}</span>
              </div>
              <div className="credit-report-history-status">
                <span className={report.isExpired ? 'is-expired' : 'is-valid'}>{report.isExpired ? 'منقضی' : 'معتبر'}</span>
                <a href={report.fileUrl} target="_blank" rel="noreferrer">مشاهده PDF</a>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
