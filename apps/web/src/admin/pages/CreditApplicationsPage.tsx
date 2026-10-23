import { useCallback, useEffect, useState } from 'react';
import type { CreditApplicationDTO, CreditReportSnapshotDTO, CreditStatus, PaymentHealthDashboardDTO } from '@tamas/shared';
import { CREDIT_STATUS_LABELS, formatMoney } from '@tamas/shared';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

type CreditSection = 'applications' | 'reports' | 'health' | 'receipts';

export function CreditApplicationsPage({ initialSection = 'applications' }: { initialSection?: CreditSection }) {
  const toast = useToast();
  const [items, setItems] = useState<CreditApplicationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<CreditSection>(initialSection);
  const [health, setHealth] = useState<PaymentHealthDashboardDTO | null>(null);
  const [reports, setReports] = useState<Array<CreditReportSnapshotDTO & { userName: string; userPhone: string; userStoreName: string }>>([]);
  const [selectedReport, setSelectedReport] = useState<CreditReportSnapshotDTO & { userName: string; userPhone: string; userStoreName: string } | null>(null);
  const [reviewingReceiptId, setReviewingReceiptId] = useState<number | null>(null);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Selected for review modal
  const [selectedApp, setSelectedApp] = useState<CreditApplicationDTO | null>(null);
  const [editStatus, setEditStatus] = useState<CreditStatus>('pending');
  const [editLimit, setEditLimit] = useState<number>(0);
  const [editScore, setEditScore] = useState<number>(0);
  const [editReason, setEditReason] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<{ ok: true; items: CreditApplicationDTO[] }>('/admin/credit-applications'),
      api.get<{ ok: true } & PaymentHealthDashboardDTO>('/admin/credit-payment-health'),
      api.get<{ ok: true; items: Array<CreditReportSnapshotDTO & { userName: string; userPhone: string; userStoreName: string }> }>('/admin/credit-reports'),
    ])
      .then(([applications, paymentHealth, creditReports]) => {
        if (applications.ok) setItems(applications.items);
        if (paymentHealth.ok) setHealth(paymentHealth);
        if (creditReports.ok) setReports(creditReports.items);
      })
      .catch((err) => toast.error(err.message || 'خطا در دریافت لیست اعتبارسنجی'))
      .finally(() => setLoading(false));
  }, [toast]);

  const reviewReceipt = async (id: number, status: 'approved' | 'rejected') => {
    const rejectionReason = status === 'rejected' ? window.prompt('علت رد رسید را برای مشتری بنویسید:') : null;
    if (status === 'rejected' && !rejectionReason?.trim()) return;
    setReviewingReceiptId(id);
    try {
      await api.patch(`/admin/installment-receipts/${id}`, { status, rejectionReason });
      toast.ok(status === 'approved' ? 'رسید تأیید شد.' : 'رسید رد شد و مشتری مطلع شد.');
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'بررسی رسید انجام نشد.');
    } finally {
      setReviewingReceiptId(null);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openReviewModal = (appItem: CreditApplicationDTO) => {
    setSelectedApp(appItem);
    setEditStatus(appItem.status);
    setEditLimit(appItem.assignedCreditLimit || 0);
    setEditScore(appItem.adminCreditScore || 0);
    setEditReason(appItem.rejectionReason || '');
    setEditNotes(appItem.internalNotes || '');
  };

  const handleSave = async () => {
    if (!selectedApp) return;
    setSaving(true);
    try {
      const res = await api.patch<{ ok: true; application: CreditApplicationDTO }>(
        `/admin/credit-applications/${selectedApp.id}`,
        {
          status: editStatus,
          assignedCreditLimit: Number(editLimit),
          adminCreditScore: Number(editScore),
          rejectionReason: editReason || null,
          internalNotes: editNotes || null,
        }
      );

      if (res.ok) {
        toast.ok('اطلاعات با موفقیت بروزرسانی شد');
        setSelectedApp(null);
        loadData();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در بروزرسانی پرونده اعتباری');
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = (item.userName || '').toLowerCase().includes(q);
      const matchPhone = (item.userPhone || '').includes(q);
      const matchStore = (item.userStoreName || '').toLowerCase().includes(q);
      const matchNational = (item.nationalId || '').includes(q);
      return matchName || matchPhone || matchStore || matchNational;
    }
    return true;
  });

  const renderStatusBadge = (status: CreditStatus) => {
    const bgMap: Record<CreditStatus, string> = {
      pending: '#fef3c7',
      reviewing: '#e0f2fe',
      active: '#dcfce7',
      action_required: '#fee2e2',
    };
    const colorMap: Record<CreditStatus, string> = {
      pending: '#d97706',
      reviewing: '#0284c7',
      active: '#15803d',
      action_required: '#dc2626',
    };

    return (
      <span
        style={{
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 800,
          backgroundColor: bgMap[status],
          color: colorMap[status],
          whiteSpace: 'nowrap',
        }}
      >
        {CREDIT_STATUS_LABELS[status]}
      </span>
    );
  };

  return (
    <div className="a-page a-fade">
      <header className="a-page-head">
        <div>
          <h1 className="a-title-mega-sm">مدیریت پنل اعتباری و تضامین</h1>
          <p className="a-subtitle">بررسی مدارک، تعیین سقف اعتبار خرید و اعتبارسنجی مشتریان</p>
        </div>
        <div className="a-page-actions flex items-center gap-4">
          <button type="button" className="a-btn a-btn--secondary" onClick={loadData}>
            🔄 بروزرسانی
          </button>
        </div>
      </header>

      <nav className="a-segmented" aria-label="بخش‌های اعتبارسنجی" style={{ display: 'flex', width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
        <button type="button" className={`a-seg${section === 'applications' ? ' a-seg--on' : ''}`} onClick={() => setSection('applications')}>پرونده‌های اعتباری</button>
        <button type="button" className={`a-seg${section === 'reports' ? ' a-seg--on' : ''}`} onClick={() => setSection('reports')}>گزارش‌های ICS24</button>
        <button type="button" className={`a-seg${section === 'health' ? ' a-seg--on' : ''}`} onClick={() => setSection('health')}>خوش‌حسابی مشتریان</button>
        <button type="button" className={`a-seg${section === 'receipts' ? ' a-seg--on' : ''}`} onClick={() => setSection('receipts')}>رسیدهای اقساط {health?.summary.pendingReceipts ? `(${health.summary.pendingReceipts.toLocaleString('fa-IR')})` : ''}</button>
      </nav>

      {/* Filters Toolbar */}
      {section === 'applications' && <>
      <section className="a-filterbar" style={{ padding: '16px', borderRadius: '14px', backgroundColor: 'var(--a-surface-2)', border: '1px solid var(--a-border)', backdropFilter: 'blur(16px)', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="search"
          className="a-input"
          placeholder="جستجو بر اساس نام، تلفن، فروشگاه یا کد ملی..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 240px' }}
        />

        <div className="a-segmented" role="group" style={{ display: 'flex' }}>
          {[
            { id: 'all', label: 'همه' },
            { id: 'pending', label: 'در صف بررسی' },
            { id: 'reviewing', label: 'در حال بررسی' },
            { id: 'active', label: 'تایید شده' },
            { id: 'action_required', label: 'رد شده' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`a-seg${filterStatus === tab.id ? ' a-seg--on' : ''}`}
              onClick={() => setFilterStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Applications Table */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--a-t2)' }}>در حال بارگذاری لیست...</div>
      ) : filteredItems.length === 0 ? (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: 'var(--a-surface-2)',
            backdropFilter: 'blur(16px)',
            borderRadius: '14px',
            border: '1px solid var(--a-border)',
            color: 'var(--a-t2)',
          }}
        >
          هیچ پرونده اعتباری یافت نشد.
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--a-surface-2)',
            backdropFilter: 'blur(16px)',
            borderRadius: '14px',
            border: '1px solid var(--a-border)',
            overflowX: 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--a-border)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--a-t2)' }}>مشتری</th>
                <th style={{ padding: '12px 16px', color: 'var(--a-t2)' }}>شماره تماس</th>
                <th style={{ padding: '12px 16px', color: 'var(--a-t2)' }}>کد ملی</th>
                <th style={{ padding: '12px 16px', color: 'var(--a-t2)' }}>نوع کسب‌وکار</th>
                <th style={{ padding: '12px 16px', color: 'var(--a-t2)' }}>وضعیت</th>
                <th style={{ padding: '12px 16px', color: 'var(--a-t2)' }}>سقف اعتبار</th>
                <th style={{ padding: '12px 16px', color: 'var(--a-t2)' }}>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--a-border)' }} className="hover:bg-[var(--a-hover)] transition-colors">
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--a-t1)' }}>
                    {item.userName}
                    {item.userStoreName && (
                      <div style={{ fontSize: '11px', color: 'var(--a-t3)', fontWeight: 400 }}>
                        {item.userStoreName}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--a-t1)' }}>{item.userPhone}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--a-t2)' }}>{item.nationalId}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--a-t2)' }}>{item.businessType}</td>
                  <td style={{ padding: '14px 16px' }}>{renderStatusBadge(item.status)}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 800, color: 'var(--a-brand)' }}>
                    {item.assignedCreditLimit > 0 ? formatMoney(item.assignedCreditLimit) : 'تعیین نشده'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <button
                      type="button"
                      className="a-btn a-btn--secondary"
                      onClick={() => openReviewModal(item)}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      🔍 بررسی مدارک / تغییر وضعیت
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>}

      {section === 'reports' && (
        <div className="a-card" style={{ overflowX: 'auto' }}>
          <table className="a-table" style={{ width: '100%', minWidth: '980px' }}>
            <thead><tr><th>مشتری</th><th>تاریخ ثبت</th><th>امتیاز</th><th>ریسک</th><th>چک برگشتی</th><th>اعتبار</th><th>وضعیت استخراج</th><th>عملیات</th></tr></thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td><strong>{report.userName}</strong><small style={{ display: 'block', color: 'var(--a-t3)' }}>{report.userStoreName || report.userPhone}</small></td>
                  <td>{new Date(report.createdAt).toLocaleString('fa-IR')}</td>
                  <td><strong>{report.score?.toLocaleString('fa-IR') ?? '—'}</strong></td>
                  <td>{[report.riskGrade, report.riskLevel].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{report.bouncedChequeCount?.toLocaleString('fa-IR') ?? '—'}</td>
                  <td><span className={`a-badge ${report.isExpired ? 'a-badge--danger' : 'a-badge--success'}`}>{report.isExpired ? 'منقضی' : `تا ${new Date(report.expiresAt).toLocaleDateString('fa-IR')}`}</span></td>
                  <td><span className={`a-badge ${report.extractionStatus === 'parsed' ? 'a-badge--success' : 'a-badge--warning'}`}>{report.extractionStatus === 'parsed' ? `استخراج شد (${report.confidence.toLocaleString('fa-IR')}٪)` : 'نیازمند بررسی'}</span></td>
                  <td style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" className="a-btn a-btn--secondary" onClick={() => setSelectedReport(report)}>جزئیات کامل</button>
                    <a className="a-btn a-btn--secondary" href={report.fileUrl} target="_blank" rel="noreferrer">PDF</a>
                  </td>
                </tr>
              ))}
              {!loading && reports.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>هنوز گزارش ICS24 ثبت نشده است.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {section === 'health' && (
        <>
          <section className="a-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {[
              ['کل مشتریان قسطی', health?.summary.totalCustomers ?? 0, 'var(--a-brand)'],
              ['خوش‌حساب', health?.summary.good ?? 0, '#16a34a'],
              ['نیازمند توجه', health?.summary.attention ?? 0, '#d97706'],
              ['بدحساب', health?.summary.bad ?? 0, '#dc2626'],
              ['رسید معوق', health?.summary.overdueWithoutReceipt ?? 0, '#b91c1c'],
            ].map(([label, value, color]) => (
              <article key={String(label)} className="a-card" style={{ padding: '16px' }}>
                <span style={{ color: 'var(--a-t2)', fontSize: '12px' }}>{label}</span>
                <strong style={{ display: 'block', marginTop: '8px', fontSize: '24px', color: String(color) }}>{Number(value).toLocaleString('fa-IR')}</strong>
              </article>
            ))}
          </section>
          <div className="a-card" style={{ overflowX: 'auto' }}>
            <table className="a-table" style={{ width: '100%', minWidth: '960px' }}>
              <thead><tr><th>مشتری</th><th>وضعیت</th><th>امتیاز</th><th>کل اقساط</th><th>به‌موقع</th><th>دیرکرد</th><th>بدون رسید معوق</th><th>چک برگشتی</th><th>در انتظار بررسی</th></tr></thead>
              <tbody>
                {(health?.customers ?? []).map((customer) => (
                  <tr key={customer.userId}>
                    <td><strong>{customer.userName}</strong><small style={{ display: 'block', color: 'var(--a-t3)' }}>{customer.userStoreName || customer.userPhone}</small></td>
                    <td><span className={`a-badge ${customer.classification === 'good' ? 'a-badge--success' : customer.classification === 'bad' ? 'a-badge--danger' : 'a-badge--warning'}`}>{customer.classification === 'good' ? 'خوش‌حساب' : customer.classification === 'bad' ? 'بدحساب' : 'نیازمند توجه'}</span></td>
                    <td><strong>{customer.score.toLocaleString('fa-IR')} از ۱۰۰</strong></td>
                    <td>{customer.totalInstallments.toLocaleString('fa-IR')}</td>
                    <td>{customer.approvedOnTime.toLocaleString('fa-IR')}</td>
                    <td>{customer.approvedLate.toLocaleString('fa-IR')}</td>
                    <td style={{ color: customer.overdueWithoutReceipt ? '#dc2626' : undefined, fontWeight: 800 }}>{customer.overdueWithoutReceipt.toLocaleString('fa-IR')}</td>
                    <td>{customer.bouncedCheques.toLocaleString('fa-IR')}</td>
                    <td>{customer.pendingReceipts.toLocaleString('fa-IR')}</td>
                  </tr>
                ))}
                {!loading && (health?.customers.length ?? 0) === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px' }}>هنوز سابقه پرداخت قسطی ثبت نشده است.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {section === 'receipts' && (
        <div className="a-card" style={{ overflowX: 'auto' }}>
          <table className="a-table" style={{ width: '100%', minWidth: '900px' }}>
            <thead><tr><th>مشتری</th><th>سفارش / قسط</th><th>مبلغ</th><th>سررسید</th><th>ثبت رسید</th><th>وضعیت</th><th>عملیات</th></tr></thead>
            <tbody>
              {(health?.receipts ?? []).map((receipt) => (
                <tr key={receipt.id}>
                  <td><strong>{receipt.userName}</strong><small style={{ display: 'block', color: 'var(--a-t3)' }}>{receipt.userPhone}</small></td>
                  <td>{receipt.orderCode} / قسط {(receipt.installmentIndex + 1).toLocaleString('fa-IR')}</td>
                  <td>{formatMoney(receipt.amount)}</td>
                  <td>{new Date(`${receipt.dueDate}T12:00:00+03:30`).toLocaleDateString('fa-IR')}</td>
                  <td>{new Date(receipt.submittedAt).toLocaleString('fa-IR')}</td>
                  <td><span className={`a-badge ${receipt.status === 'approved' ? 'a-badge--success' : receipt.status === 'rejected' ? 'a-badge--danger' : 'a-badge--warning'}`}>{receipt.status === 'approved' ? 'تأییدشده' : receipt.status === 'rejected' ? 'ردشده' : 'در انتظار'}</span></td>
                  <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <a className="a-btn a-btn--secondary" href={receipt.receiptUrl} target="_blank" rel="noreferrer">مشاهده</a>
                    {receipt.status !== 'approved' && <button type="button" className="a-btn a-btn--primary" disabled={reviewingReceiptId === receipt.id} onClick={() => void reviewReceipt(receipt.id, 'approved')}>تأیید</button>}
                    {receipt.status !== 'rejected' && <button type="button" className="a-btn a-btn--danger" disabled={reviewingReceiptId === receipt.id} onClick={() => void reviewReceipt(receipt.id, 'rejected')}>رد</button>}
                  </td>
                </tr>
              ))}
              {!loading && (health?.receipts.length ?? 0) === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>هنوز رسیدی ثبت نشده است.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {selectedReport && (
        <Modal open={true} onClose={() => setSelectedReport(null)} title={`گزارش اعتبارسنجی ${selectedReport.userName}`} wide>
          <div style={{ display: 'grid', gap: '18px' }}>
            <section className="a-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
              {[
                ['امتیاز اعتباری', selectedReport.score?.toLocaleString('fa-IR') ?? '—'],
                ['رتبه ریسک', selectedReport.riskGrade ?? '—'],
                ['سطح ریسک', selectedReport.riskLevel ?? '—'],
                ['احتمال خوش‌حسابی', selectedReport.goodPayerMinPercent === null ? '—' : `${selectedReport.goodPayerMinPercent.toLocaleString('fa-IR')} تا ${selectedReport.goodPayerMaxPercent?.toLocaleString('fa-IR')}٪`],
                ['چک برگشتی', selectedReport.bouncedChequeCount?.toLocaleString('fa-IR') ?? '—'],
                ['دقت استخراج', `${selectedReport.confidence.toLocaleString('fa-IR')}٪`],
              ].map(([label, value]) => <article key={label} className="a-card" style={{ padding: '14px' }}><span style={{ color: 'var(--a-t3)', fontSize: '11px' }}>{label}</span><strong style={{ display: 'block', marginTop: '6px' }}>{value}</strong></article>)}
            </section>

            <section className="a-card" style={{ padding: '16px' }}>
              <h3 style={{ marginTop: 0 }}>اطلاعات هویتی استخراج‌شده</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '13px' }}>
                <div><strong>نام:</strong> {selectedReport.data.identity.fullName ?? '—'}</div>
                <div><strong>کد ملی:</strong> {selectedReport.data.identity.nationalId ?? '—'}</div>
                <div><strong>نام پدر:</strong> {selectedReport.data.identity.fatherName ?? '—'}</div>
                <div><strong>تاریخ تولد:</strong> {selectedReport.data.identity.birthDate ?? '—'}</div>
                <div><strong>موبایل:</strong> {selectedReport.data.identity.mobile ?? '—'}</div>
                <div><strong>شماره گزارش:</strong> {selectedReport.reportNumber ?? '—'}</div>
              </div>
            </section>

            {selectedReport.data.negativeReasons.length > 0 && <section className="a-card" style={{ padding: '16px' }}><h3 style={{ marginTop: 0 }}>دلایل کاهش امتیاز</h3><ul>{selectedReport.data.negativeReasons.map((reason) => <li key={reason.code} style={{ marginBottom: '8px' }}><strong>{reason.code}:</strong> {reason.description}</li>)}</ul></section>}
            {selectedReport.data.taxStatuses.length > 0 && <section className="a-card" style={{ padding: '16px' }}><h3 style={{ marginTop: 0 }}>سوابق مالیاتی</h3>{selectedReport.data.taxStatuses.map((item) => <div key={`${item.year}-${item.status}`} style={{ padding: '8px 0', borderBottom: '1px solid var(--a-border)' }}><strong>{item.year}:</strong> {item.status}</div>)}</section>}

            <section className="a-card" style={{ padding: '16px' }}>
              <h3 style={{ marginTop: 0 }}>تمام اطلاعات استخراج‌شده از صفحات</h3>
              <p style={{ color: 'var(--a-t3)', fontSize: '12px' }}>برای کنترل دقیق، متن همه صفحات PDF بدون حذف در نسخه تاریخی ذخیره شده است.</p>
              {selectedReport.data.pages.map((page) => (
                <details key={page.page} style={{ borderTop: '1px solid var(--a-border)', padding: '10px 0' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 800 }}>صفحه {page.page.toLocaleString('fa-IR')}</summary>
                  <div style={{ marginTop: '10px', whiteSpace: 'pre-wrap', lineHeight: 1.9, fontSize: '12px', color: 'var(--a-t2)' }}>{page.rows.join('\n')}</div>
                </details>
              ))}
            </section>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <a className="a-btn a-btn--primary" href={selectedReport.fileUrl} target="_blank" rel="noreferrer">مشاهده فایل اصلی</a>
              <button type="button" className="a-btn a-btn--secondary" onClick={() => setSelectedReport(null)}>بستن</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Review & Edit Modal */}
      {selectedApp && (
        <Modal open={true} onClose={() => setSelectedApp(null)} title={`بررسی پرونده اعتباری ${selectedApp.userName}`} wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* User Info Header */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                backgroundColor: 'var(--a-surface-2)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--a-border)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '12px',
                fontSize: '12.5px',
              }}
            >
              <div><strong>مشتری:</strong> {selectedApp.userName}</div>
              <div><strong>موبایل:</strong> {selectedApp.userPhone}</div>
              <div><strong>فروشگاه:</strong> {selectedApp.userStoreName || 'نامشخص'}</div>
              <div><strong>کد ملی:</strong> {selectedApp.nationalId}</div>
              <div><strong>کسب‌وکار:</strong> {selectedApp.businessType}</div>
              {selectedApp.referralInfo && <div><strong>معرف:</strong> {selectedApp.referralInfo}</div>}
            </div>

            {/* Document Preview Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <strong style={{ fontSize: '14px', color: 'var(--a-t1)' }}>مدارک و تضامین بارگذاری شده:</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                <a
                  href={selectedApp.nationalCardUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid var(--a-border)',
                    backgroundColor: 'var(--a-surface-2)',
                    backdropFilter: 'blur(16px)',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                  className="hover:bg-[var(--a-hover)] transition-colors"
                >
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>🖼️</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--a-t1)' }}>کارت ملی</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--a-brand)' }}>مشاهده / دانلود</div>
                </a>

                <a
                  href={selectedApp.businessDocsUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid var(--a-border)',
                    backgroundColor: 'var(--a-surface-2)',
                    backdropFilter: 'blur(16px)',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                  className="hover:bg-[var(--a-hover)] transition-colors"
                >
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>📜</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--a-t1)' }}>جواز / اجاره‌نامه</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--a-brand)' }}>مشاهده / دانلود</div>
                </a>

                <a
                  href={selectedApp.checkImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--a-brand)',
                    backgroundColor: 'var(--a-surface-2)',
                    backdropFilter: 'blur(16px)',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                  className="hover:bg-[var(--a-hover)] transition-colors"
                >
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>💳</div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--a-t1)' }}>برگ چک صیادی</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--a-brand)' }}>مشاهده / دانلود</div>
                </a>

                {selectedApp.bankStatementUrl && (
                  <a
                    href={selectedApp.bankStatementUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid var(--a-border)',
                      backgroundColor: 'var(--a-surface-2)',
                      backdropFilter: 'blur(16px)',
                      textDecoration: 'none',
                      textAlign: 'center',
                    }}
                    className="hover:bg-[var(--a-hover)] transition-colors"
                  >
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>📊</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--a-t1)' }}>پرینت حساب</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--a-brand)' }}>مشاهده / دانلود</div>
                  </a>
                )}
              </div>
            </div>

            {/* Admin Controls Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid var(--a-border)', paddingTop: '16px' }}>
              <strong style={{ fontSize: '14px', color: 'var(--a-t1)' }}>تعیین وضعیت و سقف اعتبار:</strong>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--a-t1)' }}>وضعیت پرونده</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as CreditStatus)}
                    className="a-input"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                  >
                    <option value="pending">در صف بررسی</option>
                    <option value="reviewing">در حال بررسی</option>
                    <option value="active">تایید شده</option>
                    <option value="action_required">رد شده</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--a-t1)' }}>سقف اعتبار (تومان)</label>
                  <input
                    type="number"
                    step={1000000}
                    value={editLimit}
                    onChange={(e) => setEditLimit(Number(e.target.value))}
                    className="a-input"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--a-t1)' }}>نمره اعتباری (۰ تا ۱۰۰)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editScore}
                    onChange={(e) => setEditScore(Number(e.target.value))}
                    className="a-input"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                  />
                </div>
              </div>

              {editStatus === 'action_required' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--a-red)' }}>
                    علت رد درخواست (نمایش به مشتری)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: مدارک ناخوانا است..."
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="a-input"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px', border: '1px solid var(--a-red)' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--a-t1)' }}>
                  یادداشت داخلی (فقط برای ادمین)
                </label>
                <textarea
                  placeholder="یادداشت پشتیبانی و واحد مالی..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="a-input"
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px', minHeight: '60px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="a-btn a-btn--secondary" onClick={() => setSelectedApp(null)}>
                  انصراف
                </button>
                <button type="button" className="a-btn a-btn--primary" disabled={saving} onClick={handleSave}>
                  {saving ? 'در حال ثبت...' : 'ذخیره تغییرات'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
