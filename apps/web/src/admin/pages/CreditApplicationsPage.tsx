import { useCallback, useEffect, useState } from 'react';
import type { CreditApplicationDTO, CreditStatus, PaymentHealthDashboardDTO } from '@tamas/shared';
import { CREDIT_STATUS_LABELS, formatMoney } from '@tamas/shared';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { CreditReportOverview } from '../components/CreditReportOverview';
import { CreditReportsDashboard } from '../components/CreditReportsDashboard';
import type { AdminCreditReport } from '../components/creditReportAnalytics';
import { DocumentRecoveryPanel } from '../components/DocumentRecoveryPanel';
import { documentHasIssue, useDocumentHealth } from '../../lib/document-requests';
import { AdminState, TableState } from '../components/AdminState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import './credit-applications.css';

type CreditSection = 'applications' | 'reports' | 'health' | 'receipts' | 'documents';

export function CreditApplicationsPage({ initialSection = 'applications' }: { initialSection?: CreditSection }) {
  const toast = useToast();
  const documentHealth = useDocumentHealth();
  const missingDocuments = documentHealth.data?.items.filter(documentHasIssue) ?? [];
  const [items, setItems] = useState<CreditApplicationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [section, setSection] = useState<CreditSection>(initialSection);
  const [health, setHealth] = useState<PaymentHealthDashboardDTO | null>(null);
  const [reports, setReports] = useState<AdminCreditReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<AdminCreditReport | null>(null);
  const [reviewingReceiptId, setReviewingReceiptId] = useState<number | null>(null);
  const [rejectingReceiptId, setRejectingReceiptId] = useState<number | null>(null);
  const [receiptRejectReason, setReceiptRejectReason] = useState('');
  const [receiptRejectTouched, setReceiptRejectTouched] = useState(false);

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
    setLoadError(null);
    Promise.all([
      api.get<{ ok: true; items: CreditApplicationDTO[] }>('/admin/credit-applications'),
      api.get<{ ok: true } & PaymentHealthDashboardDTO>('/admin/credit-payment-health'),
      api.get<{ ok: true; items: AdminCreditReport[] }>('/admin/credit-reports'),
    ])
      .then(([applications, paymentHealth, creditReports]) => {
        if (applications.ok) setItems(applications.items);
        if (paymentHealth.ok) setHealth(paymentHealth);
        if (creditReports.ok) setReports(creditReports.items);
      })
      .catch((err) => {
        setLoadError(err);
        toast.error(err.message || 'فهرست اعتبارسنجی دریافت نشد.');
      })
      .finally(() => setLoading(false));
  }, [toast]);

  const reviewReceipt = async (id: number, status: 'approved' | 'rejected', reason?: string) => {
    const rejectionReason = status === 'rejected' ? reason ?? null : null;
    if (status === 'rejected' && !rejectionReason?.trim()) return;
    setReviewingReceiptId(id);
    try {
      await api.patch(`/admin/installment-receipts/${id}`, { status, rejectionReason });
      toast.ok(status === 'approved' ? 'رسید تأیید شد.' : 'رسید رد شد و مشتری مطلع شد.');
      if (status === 'rejected') closeReceiptReject();
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

  const openReceiptReject = (id: number) => {
    setRejectingReceiptId(id);
    setReceiptRejectReason('');
    setReceiptRejectTouched(false);
  };

  function closeReceiptReject() {
    setRejectingReceiptId(null);
    setReceiptRejectReason('');
    setReceiptRejectTouched(false);
  }

  const confirmReceiptReject = () => {
    if (rejectingReceiptId === null) return;
    setReceiptRejectTouched(true);
    if (!receiptRejectReason.trim()) return;
    void reviewReceipt(rejectingReceiptId, 'rejected', receiptRejectReason);
  };

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
        toast.ok('پرونده اعتباری به‌روزرسانی شد.');
        setSelectedApp(null);
        loadData();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'پرونده اعتباری ذخیره نشد؛ دوباره تلاش کنید.');
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

  const statusBadgeTone: Record<CreditStatus, string> = {
    pending: 'a-badge--warning',
    reviewing: 'a-badge--info',
    active: 'a-badge--success',
    action_required: 'a-badge--danger',
  };

  const renderStatusBadge = (status: CreditStatus) => (
    <span className={`a-badge ${statusBadgeTone[status]}`}>{CREDIT_STATUS_LABELS[status]}</span>
  );

  const isFiltered = filterStatus !== 'all' || search.trim() !== '';
  const showLoadError = Boolean(loadError) && !loading;

  return (
    <div className="a-page a-fade">
      <header className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">مدیریت پنل اعتباری و تضامین</h2>
          <p className="a-subtitle">بررسی مدارک، تعیین سقف اعتبار خرید و اعتبارسنجی مشتریان</p>
        </div>
        <div className="a-page-actions">
          <button type="button" className="a-btn a-btn--secondary" onClick={loadData} disabled={loading} aria-busy={loading || undefined}>
            {loading ? 'در حال به‌روزرسانی…' : 'به‌روزرسانی'}
          </button>
        </div>
      </header>

      <nav className="a-segmented ca-sections" aria-label="بخش‌های اعتبارسنجی">
        <button type="button" className={`a-seg${section === 'documents' ? ' a-seg--on' : ''}`} aria-current={section === 'documents' ? 'true' : undefined} onClick={() => setSection('documents')}>مدارک مفقود و تکمیل پرونده {missingDocuments.length ? `(${missingDocuments.length.toLocaleString('fa-IR')})` : ''}</button>
        <button type="button" className={`a-seg${section === 'applications' ? ' a-seg--on' : ''}`} aria-current={section === 'applications' ? 'true' : undefined} onClick={() => setSection('applications')}>پرونده‌های اعتباری</button>
        <button type="button" className={`a-seg${section === 'reports' ? ' a-seg--on' : ''}`} aria-current={section === 'reports' ? 'true' : undefined} onClick={() => setSection('reports')}>گزارش‌های ICS24</button>
        <button type="button" className={`a-seg${section === 'health' ? ' a-seg--on' : ''}`} aria-current={section === 'health' ? 'true' : undefined} onClick={() => setSection('health')}>خوش‌حسابی مشتریان</button>
        <button type="button" className={`a-seg${section === 'receipts' ? ' a-seg--on' : ''}`} aria-current={section === 'receipts' ? 'true' : undefined} onClick={() => setSection('receipts')}>رسیدهای اقساط {health?.summary.pendingReceipts ? `(${health.summary.pendingReceipts.toLocaleString('fa-IR')})` : ''}</button>
      </nav>

      {section !== 'documents' && missingDocuments.length > 0 && <aside className="ds-alert ds-alert--warning doc-request-notice"><span>{missingDocuments.length.toLocaleString('fa-IR')} فایل خصوصی نیازمند بررسی یا آپلود مجدد است.</span><button className="a-btn a-btn--secondary" type="button" onClick={() => setSection('documents')}>مشاهدهٔ حساب‌ها و مدارک</button></aside>}
      {section === 'documents' && <DocumentRecoveryPanel />}

      {/* Filters Toolbar */}
      {section === 'applications' && <>
      <section className="a-filterbar ca-filterbar">
        <input
          type="search"
          className="a-input ca-search"
          placeholder="جستجو بر اساس نام، تلفن، فروشگاه یا کد ملی…"
          aria-label="جستجوی پرونده‌های اعتباری"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="a-segmented ca-status-filter" role="group" aria-label="فیلتر وضعیت پرونده">
          {[
            { id: 'all', label: 'همه' },
            { id: 'pending', label: 'در صف بررسی' },
            { id: 'reviewing', label: 'در حال بررسی' },
            { id: 'active', label: 'تأییدشده' },
            { id: 'action_required', label: 'ردشده' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`a-seg${filterStatus === tab.id ? ' a-seg--on' : ''}`}
              aria-pressed={filterStatus === tab.id}
              onClick={() => setFilterStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Applications Table */}
      <section className="a-card a-card--flush">
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>مشتری</th>
                <th>شماره تماس</th>
                <th>کد ملی</th>
                <th>نوع کسب‌وکار</th>
                <th>وضعیت</th>
                <th className="a-num">سقف اعتبار</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <TableState colSpan={7} kind="loading" />
              ) : showLoadError && items.length === 0 ? (
                <TableState colSpan={7} kind="error" error={loadError} onRetry={loadData} />
              ) : filteredItems.length === 0 ? (
                <TableState
                  colSpan={7}
                  kind={isFiltered ? 'filtered' : 'empty'}
                  noun="پرونده اعتباری"
                  action={isFiltered ? (
                    <button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => { setSearch(''); setFilterStatus('all'); }}>
                      پاک کردن فیلترها
                    </button>
                  ) : undefined}
                />
              ) : filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="a-strong">{item.userName}</span>
                    {missingDocuments.some((document) => document.userId === item.userId && document.references.some((reference) => reference.source === 'application' && reference.recordId === item.id)) && <button type="button" className="doc-badge doc-badge--danger" onClick={() => setSection('documents')}>مدرک مفقود؛ بررسی و درخواست مجدد</button>}
                    {item.userStoreName && (
                      <div className="a-cell-sub">
                        {item.userStoreName}
                      </div>
                    )}
                  </td>
                  <td className="a-ltr">{item.userPhone}</td>
                  <td className="a-ltr">{item.nationalId}</td>
                  <td>{item.businessType}</td>
                  <td>{renderStatusBadge(item.status)}</td>
                  <td className="a-num">
                    {item.assignedCreditLimit > 0 ? <span className="a-money">{formatMoney(item.assignedCreditLimit)}</span> : <span className="a-hint">تعیین نشده</span>}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="a-btn a-btn--secondary a-btn--sm"
                      onClick={() => openReviewModal(item)}
                      aria-label={`بررسی پرونده اعتباری ${item.userName}`}
                    >
                      بررسی مدارک / تغییر وضعیت
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </>}

      {section === 'reports' && (
        <CreditReportsDashboard
          reports={reports}
          applicants={items}
          loading={loading}
          error={showLoadError ? loadError : undefined}
          onRetry={loadData}
          onSelectReport={setSelectedReport}
        />
      )}

      {section === 'health' && (
        <>
          {showLoadError && !health ? (
            <AdminState kind="error" title="وضعیت خوش‌حسابی دریافت نشد." error={loadError} onRetry={loadData} />
          ) : (
            <section className="ca-stats" aria-label="خلاصهٔ خوش‌حسابی">
              {([
                ['کل مشتریان قسطی', health?.summary.totalCustomers ?? 0, ''],
                ['خوش‌حساب', health?.summary.good ?? 0, 'ca-stat-value--success'],
                ['نیازمند توجه', health?.summary.attention ?? 0, 'ca-stat-value--warning'],
                ['بدحساب', health?.summary.bad ?? 0, 'ca-stat-value--danger'],
                ['رسید معوق', health?.summary.overdueWithoutReceipt ?? 0, 'ca-stat-value--danger'],
              ] as const).map(([label, value, tone]) => (
                <article key={label} className="a-card ca-stat">
                  <span className="ca-stat-label">{label}</span>
                  <strong className={`ca-stat-value ${tone}`}>{Number(value).toLocaleString('fa-IR')}</strong>
                </article>
              ))}
            </section>
          )}
          <section className="a-card a-card--flush">
            <div className="a-table-wrap">
              <table className="a-table ca-table--wide">
                <thead><tr><th>مشتری</th><th>وضعیت</th><th className="a-num">امتیاز</th><th className="a-num">کل اقساط</th><th className="a-num">به‌موقع</th><th className="a-num">دیرکرد</th><th className="a-num">بدون رسید معوق</th><th className="a-num">چک برگشتی</th><th className="a-num">در انتظار بررسی</th></tr></thead>
                <tbody>
                  {(health?.customers ?? []).map((customer) => (
                    <tr key={customer.userId}>
                      <td><span className="a-strong">{customer.userName}</span><div className={`a-cell-sub${customer.userStoreName ? '' : ' a-ltr'}`}>{customer.userStoreName || customer.userPhone}</div></td>
                      <td><span className={`a-badge ${customer.classification === 'good' ? 'a-badge--success' : customer.classification === 'bad' ? 'a-badge--danger' : 'a-badge--warning'}`}>{customer.classification === 'good' ? 'خوش‌حساب' : customer.classification === 'bad' ? 'بدحساب' : 'نیازمند توجه'}</span></td>
                      <td className="a-num"><strong>{customer.score.toLocaleString('fa-IR')} از ۱۰۰</strong></td>
                      <td className="a-num">{customer.totalInstallments.toLocaleString('fa-IR')}</td>
                      <td className="a-num">{customer.approvedOnTime.toLocaleString('fa-IR')}</td>
                      <td className="a-num">{customer.approvedLate.toLocaleString('fa-IR')}</td>
                      <td className={`a-num${customer.overdueWithoutReceipt ? ' ca-danger-text' : ''}`}>{customer.overdueWithoutReceipt.toLocaleString('fa-IR')}</td>
                      <td className="a-num">{customer.bouncedCheques.toLocaleString('fa-IR')}</td>
                      <td className="a-num">{customer.pendingReceipts.toLocaleString('fa-IR')}</td>
                    </tr>
                  ))}
                  {loading && !health && <TableState colSpan={9} kind="loading" />}
                  {showLoadError && !health && <TableState colSpan={9} kind="error" error={loadError} onRetry={loadData} />}
                  {!loading && health && health.customers.length === 0 && <TableState colSpan={9} kind="empty" title="هنوز سابقهٔ پرداخت قسطی ثبت نشده است." />}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {section === 'receipts' && (
        <section className="a-card a-card--flush">
          <div className="a-table-wrap">
            <table className="a-table ca-table--receipts">
              <thead><tr><th>مشتری</th><th>سفارش / قسط</th><th className="a-num">مبلغ</th><th>سررسید</th><th>ثبت رسید</th><th>وضعیت</th><th>عملیات</th></tr></thead>
              <tbody>
                {(health?.receipts ?? []).map((receipt) => (
                  <tr key={receipt.id}>
                    <td><span className="a-strong">{receipt.userName}</span><div className="a-cell-sub a-ltr">{receipt.userPhone}</div></td>
                    <td><span className="a-ltr">{receipt.orderCode}</span> / قسط {(receipt.installmentIndex + 1).toLocaleString('fa-IR')}</td>
                    <td className="a-num a-money">{formatMoney(receipt.amount)}</td>
                    <td>{new Date(`${receipt.dueDate}T12:00:00+03:30`).toLocaleDateString('fa-IR')}</td>
                    <td>{new Date(receipt.submittedAt).toLocaleString('fa-IR')}</td>
                    <td><span className={`a-badge ${receipt.status === 'approved' ? 'a-badge--success' : receipt.status === 'rejected' ? 'a-badge--danger' : 'a-badge--warning'}`}>{receipt.status === 'approved' ? 'تأییدشده' : receipt.status === 'rejected' ? 'ردشده' : 'در انتظار'}</span></td>
                    <td>
                      <div className="ca-row-actions">
                        <a className="a-btn a-btn--secondary a-btn--sm" href={receipt.receiptUrl} target="_blank" rel="noreferrer" aria-label={`مشاهدهٔ رسید ${receipt.userName} (در پنجرهٔ جدید)`}>مشاهده</a>
                        {receipt.status !== 'approved' && <button type="button" className="a-btn a-btn--outline a-btn--sm" disabled={reviewingReceiptId === receipt.id} aria-busy={reviewingReceiptId === receipt.id || undefined} aria-label={`تأیید رسید ${receipt.userName}`} onClick={() => void reviewReceipt(receipt.id, 'approved')}>تأیید</button>}
                        {receipt.status !== 'rejected' && <button type="button" className="a-btn a-btn--danger a-btn--sm" disabled={reviewingReceiptId === receipt.id} aria-label={`رد رسید ${receipt.userName}`} onClick={() => openReceiptReject(receipt.id)}>رد</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && !health && <TableState colSpan={7} kind="loading" />}
                {showLoadError && !health && <TableState colSpan={7} kind="error" error={loadError} onRetry={loadData} />}
                {!loading && health && health.receipts.length === 0 && <TableState colSpan={7} kind="empty" noun="رسید" />}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ConfirmDialog
        open={rejectingReceiptId !== null}
        title="رد رسید قسط"
        confirmLabel="رد رسید"
        busyLabel="در حال رد رسید…"
        busy={rejectingReceiptId !== null && reviewingReceiptId === rejectingReceiptId}
        hint={null}
        onClose={closeReceiptReject}
        onConfirm={confirmReceiptReject}
        description={
          <span className="a-field">
            <span>رسید رد می‌شود و علت آن برای مشتری نمایش داده می‌شود.</span>
            <label className="a-label" htmlFor="receipt-reject-reason">علت رد رسید <span className="a-req">*</span></label>
            <textarea
              id="receipt-reject-reason"
              className="a-textarea"
              rows={3}
              value={receiptRejectReason}
              onChange={(e) => setReceiptRejectReason(e.target.value)}
              placeholder="مثلاً: مبلغ رسید با قسط هم‌خوانی ندارد."
              aria-invalid={receiptRejectTouched && !receiptRejectReason.trim() ? true : undefined}
              aria-describedby={receiptRejectTouched && !receiptRejectReason.trim() ? 'receipt-reject-reason-error' : undefined}
            />
            {receiptRejectTouched && !receiptRejectReason.trim() && (
              <span id="receipt-reject-reason-error" className="a-field-error">علت رد را برای مشتری بنویسید.</span>
            )}
          </span>
        }
      />

      {selectedReport && (
        <Modal open={true} onClose={() => setSelectedReport(null)} title="نمای جامع اعتبارسنجی مشتری" size="xl">
          <CreditReportOverview report={selectedReport} onClose={() => setSelectedReport(null)} />
        </Modal>
      )}

      {/* Review & Edit Modal */}
      {selectedApp && (
        <Modal open={true} onClose={() => setSelectedApp(null)} title={`بررسی پرونده اعتباری ${selectedApp.userName}`} wide>
          <div className="ca-review">
            {/* User Info Header */}
            <div className="ca-info-grid">
              <div><strong>مشتری:</strong> {selectedApp.userName}</div>
              <div><strong>موبایل:</strong> <span className="a-ltr">{selectedApp.userPhone}</span></div>
              <div><strong>فروشگاه:</strong> {selectedApp.userStoreName || 'نامشخص'}</div>
              <div><strong>کد ملی:</strong> <span className="a-ltr">{selectedApp.nationalId}</span></div>
              <div><strong>کسب‌وکار:</strong> {selectedApp.businessType}</div>
              {selectedApp.referralInfo && <div><strong>معرف:</strong> {selectedApp.referralInfo}</div>}
            </div>

            {/* Document Preview Grid */}
            <section className="ca-section">
              <h4 className="ca-section-title">مدارک و تضامین بارگذاری‌شده</h4>
              <div className="ca-docs">
                <a href={selectedApp.nationalCardUrl} target="_blank" rel="noreferrer" className="ca-doc">
                  <span className="ca-doc-icon" aria-hidden="true">🖼️</span>
                  <span className="ca-doc-title">کارت ملی</span>
                  <span className="ca-doc-action">مشاهده / دانلود</span>
                </a>

                <a href={selectedApp.businessDocsUrl} target="_blank" rel="noreferrer" className="ca-doc">
                  <span className="ca-doc-icon" aria-hidden="true">📜</span>
                  <span className="ca-doc-title">جواز / اجاره‌نامه</span>
                  <span className="ca-doc-action">مشاهده / دانلود</span>
                </a>

                <a href={selectedApp.checkImageUrl} target="_blank" rel="noreferrer" className="ca-doc ca-doc--key">
                  <span className="ca-doc-icon" aria-hidden="true">💳</span>
                  <span className="ca-doc-title">برگ چک صیادی</span>
                  <span className="ca-doc-action">مشاهده / دانلود</span>
                </a>

                {selectedApp.bankStatementUrl && (
                  <a href={selectedApp.bankStatementUrl} target="_blank" rel="noreferrer" className="ca-doc">
                    <span className="ca-doc-icon" aria-hidden="true">📊</span>
                    <span className="ca-doc-title">پرینت حساب</span>
                    <span className="ca-doc-action">مشاهده / دانلود</span>
                  </a>
                )}
              </div>
            </section>

            {/* Admin Controls Form */}
            <section className="ca-section ca-section--divided">
              <h4 className="ca-section-title">تعیین وضعیت و سقف اعتبار</h4>

              <div className="ca-form-grid">
                <div className="a-field">
                  <label className="a-label" htmlFor="credit-edit-status">وضعیت پرونده</label>
                  <select
                    id="credit-edit-status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as CreditStatus)}
                    className="a-select"
                  >
                    <option value="pending">در صف بررسی</option>
                    <option value="reviewing">در حال بررسی</option>
                    <option value="active">تأییدشده</option>
                    <option value="action_required">ردشده</option>
                  </select>
                </div>

                <div className="a-field">
                  <label className="a-label" htmlFor="credit-edit-limit">سقف اعتبار (تومان)</label>
                  <input
                    id="credit-edit-limit"
                    type="number"
                    step={1000000}
                    inputMode="numeric"
                    dir="ltr"
                    value={editLimit}
                    onChange={(e) => setEditLimit(Number(e.target.value))}
                    className="a-input"
                  />
                </div>

                <div className="a-field">
                  <label className="a-label" htmlFor="credit-edit-score">نمره اعتباری (۰ تا ۱۰۰)</label>
                  <input
                    id="credit-edit-score"
                    type="number"
                    min={0}
                    max={100}
                    inputMode="numeric"
                    dir="ltr"
                    value={editScore}
                    onChange={(e) => setEditScore(Number(e.target.value))}
                    className="a-input"
                  />
                </div>
              </div>

              {editStatus === 'action_required' && (
                <div className="a-field">
                  <label className="a-label" htmlFor="credit-edit-reason">
                    علت رد درخواست (نمایش به مشتری)
                  </label>
                  <input
                    id="credit-edit-reason"
                    type="text"
                    placeholder="مثلاً: مدارک ناخوانا است."
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="a-input"
                  />
                </div>
              )}

              <div className="a-field">
                <label className="a-label" htmlFor="credit-edit-notes">
                  یادداشت داخلی (فقط برای مدیر)
                </label>
                <textarea
                  id="credit-edit-notes"
                  rows={3}
                  placeholder="یادداشت پشتیبانی و واحد مالی…"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="a-textarea"
                />
              </div>

              <div className="a-actions a-actions--end">
                <button type="button" className="a-btn a-btn--secondary" onClick={() => setSelectedApp(null)}>
                  انصراف
                </button>
                <button type="button" className="a-btn a-btn--primary" disabled={saving} aria-busy={saving || undefined} onClick={handleSave}>
                  {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
                </button>
              </div>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}
