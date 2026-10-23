import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CreditApplicationDTO,
  CreditDashboardDTO,
  CreditChequeDTO,
  ChequeNotificationDTO,
  CreditStatus,
  ChequeStatus,
} from '@tamas/shared';
import {
  CREDIT_STATUS_DESCRIPTIONS,
  CREDIT_STATUS_LABELS,
  CHEQUE_STATUS_LABELS,
  formatMoney,
  formatPersianDueDate,
} from '@tamas/shared';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { AnimatedDropdown } from '../admin/components/AnimatedDropdown';
import { CreditReportPanel } from './CreditReportPanel';

const BANK_OPTIONS = [
  'بانک ملی', 'بانک ملت', 'بانک صادرات', 'بانک تجارت', 'بانک سپه', 'بانک سامان',
  'بانک پاسارگاد', 'بانک پارسیان', 'بانک کشاورزی', 'بانک رفاه', 'بانک آینده', 'بانک شهر',
].map((label) => ({ value: label, label }));

export function CreditDashboard({ onBack }: { onBack: () => void }) {
  const toast = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingApp, setExistingApp] = useState<CreditApplicationDTO | null>(null);
  const [dashboard, setDashboard] = useState<CreditDashboardDTO | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'notifications' | 'receipts' | 'cheques' | 'new_cheque' | 'credit_report' | 'details'>('summary');
  const [isEditing, setIsEditing] = useState(false);

  // Stepped Form State (1 -> 2 -> 3) for initial application
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form Fields for Application
  const [nationalId, setNationalId] = useState('');
  const [businessType, setBusinessType] = useState('مغازه‌دار');
  const [nationalCardUrl, setNationalCardUrl] = useState('');
  const [businessDocsUrl, setBusinessDocsUrl] = useState('');
  const [checkImageUrl, setCheckImageUrl] = useState('');
  const [bankStatementUrl, setBankStatementUrl] = useState('');
  const [referralInfo, setReferralInfo] = useState('');
  const [agreed, setAgreed] = useState(false);

  // Upload progress states
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // New Cheque Submission Form State
  const [chequeNum, setChequeNum] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [bankName, setBankName] = useState('بانک ملی');
  const [accountHolder, setAccountHolder] = useState(user ? `${user.name || ''} ${user.lastName || ''}`.trim() : '');
  const [chequeImageUrl, setChequeImageUrl] = useState('');
  const [chequeNotes, setChequeNotes] = useState('');
  const [submittingCheque, setSubmittingCheque] = useState(false);

  // Fetch credit dashboard when the dedicated page mounts.
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<{ ok: true } & CreditDashboardDTO>('/credit/dashboard');
      if (res.ok) {
        const chequeOrders = res.chequeOrders ?? [];
        setDashboard({
          ...res,
          chequeOrders,
          installmentOrders: res.installmentOrders ?? [],
          creditReports: res.creditReports ?? [],
          currentCreditReport: res.currentCreditReport ?? null,
          creditReportRequired: res.creditReportRequired ?? true,
        });
        setSelectedOrderId((current) => {
          const stillAvailable = chequeOrders.some((order) => String(order.orderId) === current && order.canSubmitNextCheque);
          return stillAvailable ? current : String(chequeOrders.find((order) => order.canSubmitNextCheque)?.orderId ?? '');
        });
        setExistingApp(res.application);
        if (res.application) {
          setNationalId(res.application.nationalId || '');
          setBusinessType(res.application.businessType || 'مغازه‌دار');
          setNationalCardUrl(res.application.nationalCardUrl || '');
          setBusinessDocsUrl(res.application.businessDocsUrl || '');
          setCheckImageUrl(res.application.checkImageUrl || '');
          setBankStatementUrl(res.application.bankStatementUrl || '');
          setReferralInfo(res.application.referralInfo || '');
        }
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const selectedChequeOrder = useMemo(
    () => dashboard?.chequeOrders.find((order) => String(order.orderId) === selectedOrderId) ?? null,
    [dashboard?.chequeOrders, selectedOrderId],
  );

  // Upload file helper
  const handleFileUpload = async (field: string, file: File) => {
    try {
      setUploadingField(field);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', 'certificate');

      const res = await api.upload<{ ok: true; url: string }>('/uploads', formData);
      if (res.ok && res.url) {
        if (field === 'nationalCardUrl') setNationalCardUrl(res.url);
        else if (field === 'businessDocsUrl') setBusinessDocsUrl(res.url);
        else if (field === 'checkImageUrl') setCheckImageUrl(res.url);
        else if (field === 'bankStatementUrl') setBankStatementUrl(res.url);
        else if (field === 'chequeImageUrl') setChequeImageUrl(res.url);
        toast.ok('فایل با موفقیت بارگذاری شد');
      } else {
        toast.error('خطا در بارگذاری فایل');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در آپلود فایل');
    } finally {
      setUploadingField(null);
    }
  };

  const handleInstallmentReceiptUpload = async (orderId: number, installmentIndex: number, file: File) => {
    const field = `receipt-${orderId}-${installmentIndex}`;
    try {
      setUploadingField(field);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', 'certificate');
      const upload = await api.upload<{ ok: true; url: string }>('/uploads', formData);
      if (!upload.ok || !upload.url) throw new Error('بارگذاری فایل رسید انجام نشد.');
      await api.post(`/credit/installments/${orderId}/${installmentIndex}/receipt`, { receiptUrl: upload.url });
      toast.ok('رسید قسط ثبت شد و در انتظار بررسی مالی است.');
      await fetchDashboard();
      setActiveTab('receipts');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ثبت رسید قسط انجام نشد.');
    } finally {
      setUploadingField(null);
    }
  };

  const handleNextStep1 = () => {
    if (!nationalId.trim() || nationalId.trim().length !== 10) {
      toast.error('لطفاً کد ملی ۱۰ رقمی معتبر وارد کنید');
      return;
    }
    if (!nationalCardUrl) {
      toast.error('لطفاً تصویر کارت ملی را بارگذاری کنید');
      return;
    }
    if (!businessDocsUrl) {
      toast.error('لطفاً تصویر جواز کسب یا اجاره‌نامه را بارگذاری کنید');
      return;
    }
    if (!dashboard?.currentCreditReport) {
      toast.error('لطفاً گزارش اعتبارسنجی جدید ICS24 را بارگذاری کنید');
      return;
    }
    if (dashboard.currentCreditReport.extractedNationalId && dashboard.currentCreditReport.extractedNationalId !== nationalId.trim()) {
      toast.error('کد ملی گزارش ICS24 با کد ملی واردشده مطابقت ندارد');
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = () => {
    if (!checkImageUrl) {
      toast.error('لطفاً تصویر برگ چک صیادی را بارگذاری کنید');
      return;
    }
    setStep(3);
  };

  const handleSubmitApplication = async () => {
    if (!agreed) {
      toast.error('لطفاً تعهدنامه خوش‌حسابی را تایید کنید');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ ok: true; application: CreditApplicationDTO }>('/credit/apply', {
        nationalId: nationalId.trim(),
        businessType,
        nationalCardUrl,
        businessDocsUrl,
        checkImageUrl,
        bankStatementUrl: bankStatementUrl || null,
        referralInfo: referralInfo || null,
      });

      if (res.ok) {
        toast.ok('درخواست پنل اعتباری شما با موفقیت ثبت شد');
        setExistingApp(res.application);
        setIsEditing(false);
        void fetchDashboard();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ثبت درخواست اعتباری');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCheque = async () => {
    if (!chequeNum.trim()) {
      toast.error('لطفاً شماره صیادی / چک را وارد کنید');
      return;
    }
    if (!selectedChequeOrder?.canSubmitNextCheque || !selectedChequeOrder.nextInstallment) {
      toast.error(selectedChequeOrder?.blockedReason || 'سفارش چکی قابل ثبت را انتخاب کنید');
      return;
    }

    setSubmittingCheque(true);
    try {
      const res = await api.post<{ ok: true }>('/credit/cheques', {
        orderId: selectedChequeOrder.orderId,
        chequeNumber: chequeNum.trim(),
        bankName,
        accountHolder: accountHolder.trim() || 'صاحب حساب',
        amount: selectedChequeOrder.nextInstallment.amount,
        dueDate: selectedChequeOrder.nextInstallment.dueDate,
        imageUrl: chequeImageUrl || null,
        notes: chequeNotes.trim() || null,
      });

      if (res.ok) {
        toast.ok('چک جدید با موفقیت در سامانه اعتباری ثبت شد');
        setChequeNum('');
        setChequeImageUrl('');
        setChequeNotes('');
        setActiveTab('cheques');
        void fetchDashboard();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ثبت چک جدید');
    } finally {
      setSubmittingCheque(false);
    }
  };

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
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: 800,
          backgroundColor: bgMap[status],
          color: colorMap[status],
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        ● {CREDIT_STATUS_LABELS[status]}
      </span>
    );
  };

  const renderChequeStatusBadge = (status: ChequeStatus) => {
    const config: Record<ChequeStatus, { bg: string; color: string; text: string }> = {
      pending: { bg: '#fef3c7', color: '#d97706', text: '● در انتظار سررسید' },
      passed: { bg: '#dcfce7', color: '#15803d', text: '● پاس شده' },
      bounced: { bg: '#fee2e2', color: '#dc2626', text: '● برگشتی' },
      returned: { bg: '#f1f5f9', color: '#64748b', text: '● عودت داده شده' },
    };
    const c = config[status] || config.pending;

    return (
      <span
        style={{
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '11.5px',
          fontWeight: 800,
          backgroundColor: c.bg,
          color: c.color,
          display: 'inline-block',
        }}
      >
        {c.text}
      </span>
    );
  };

  const fullName = user ? `${user.name || ''} ${user.lastName || ''}`.trim() : '';

  const renderActiveCreditBuyerDashboard = () => {
    const totalLimit = dashboard?.totalCreditLimit ?? 0;
    const used = dashboard?.usedCredit ?? 0;
    const remaining = dashboard?.remainingCredit ?? 0;
    const chequesCount = dashboard?.cheques?.length ?? 0;
    const notificationsCount = dashboard?.notifications?.length ?? 0;
    const pctUsed = totalLimit > 0 ? Math.min(100, Math.round((used / totalLimit) * 100)) : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header Hero Metrics */}
        <div
          className="credit-metrics"
          style={{
            display: 'grid',
            gap: '12px',
            background: 'linear-gradient(135deg, var(--card), var(--surface))',
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid var(--tamas-border)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          }}
        >
          {/* Card 1: Total Limit */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--tamas-muted)', fontWeight: 700 }}>💳 سقف اعتبار کل</span>
            <strong style={{ fontSize: '16px', color: 'var(--tamas-fg)' }}>{formatMoney(totalLimit)}</strong>
            <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>✓ تخصیص داده شده</span>
          </div>

          {/* Card 2: Used Credit */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--tamas-muted)', fontWeight: 700 }}>📉 اعتبار مصرف‌شده</span>
            <strong style={{ fontSize: '16px', color: 'var(--danger)' }}>{formatMoney(used)}</strong>
            <span style={{ fontSize: '11px', color: 'var(--tamas-muted)' }}>{pctUsed}% از سقف کل</span>
          </div>

          {/* Card 3: Remaining Credit */}
          <div
            style={{
              padding: '14px',
              borderRadius: '12px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--tamas-muted)', fontWeight: 700 }}>🟢 اعتبار باقیمانده</span>
            <strong style={{ fontSize: '16px', color: 'var(--tamas-accent)' }}>{formatMoney(remaining)}</strong>
            <span style={{ fontSize: '11px', color: 'var(--tamas-accent)', fontWeight: 700 }}>آماده برای سفارش اعتباری</span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div style={{ padding: '0 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px', color: 'var(--tamas-muted)' }}>
            <span>میزان استفاده از اعتبار</span>
            <span>{pctUsed}% مصرف شده</span>
          </div>
          <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${pctUsed}%`,
                height: '100%',
                backgroundColor: pctUsed > 80 ? 'var(--danger)' : 'var(--tamas-accent)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        {dashboard?.creditReportRequired ? (
          <div className="credit-report-renewal-alert" role="alert">
            <div>
              <strong>گزارش اعتبارسنجی شما ثبت نشده یا بیش از دو ماه از آن گذشته است.</strong>
              <span>برای به‌روز ماندن پرونده اعتباری، نسخه جدید ICS24 را بارگذاری کنید.</span>
            </div>
            <button type="button" className="btn primary" onClick={() => setActiveTab('credit_report')}>به‌روزرسانی گزارش</button>
          </div>
        ) : null}

        {/* Dashboard Tabs */}
        <div
          className="credit-tabs"
          style={{
            gap: '8px',
            borderBottom: '1px solid var(--tamas-border)',
            paddingBottom: '8px',
          }}
        >
          <button
            type="button"
            className={`btn ${activeTab === 'receipts' ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab('receipts')}
            style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '10px' }}
          >
            🧾 رسید اقساط
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'summary' ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab('summary')}
            style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '10px' }}
          >
            📊 خلاصه‌وضعیت
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'notifications' ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab('notifications')}
            style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '10px', position: 'relative' }}
          >
            🔔 سررسیدها و ناتیفیکیشن‌ها
            {notificationsCount > 0 && (
              <span
                style={{
                  marginInlineStart: '6px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  backgroundColor: 'var(--danger)',
                  color: '#fff',
                  fontWeight: 800,
                }}
              >
                {notificationsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'cheques' ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab('cheques')}
            style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '10px' }}
          >
            📑 مدیریت چک‌ها ({chequesCount})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'new_cheque' ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab('new_cheque')}
            style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '10px' }}
          >
            ➕ ثبت چک جدید
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'credit_report' ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab('credit_report')}
            style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '10px' }}
          >
            🛡️ گزارش اعتبارسنجی
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'details' ? 'primary' : 'ghost'}`}
            onClick={() => setActiveTab('details')}
            style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '10px' }}
          >
            📄 مدارک و پرونده
          </button>
        </div>

        {/* Tab 1: Summary */}
        {activeTab === 'summary' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: 'var(--tamas-info-bg)',
                border: '1px solid var(--tamas-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong style={{ fontSize: '14px', color: 'var(--tamas-fg)', display: 'block', marginBottom: '4px' }}>
                  {existingApp?.status === 'active' ? '🎉 پنل اعتباری شما فعال است' : '🧾 مدیریت پرداخت‌های قسطی'}
                </strong>
                <span style={{ fontSize: '12.5px', color: 'var(--tamas-muted)' }}>
                  {existingApp?.status === 'active'
                    ? 'شما می‌توانید برای خرید کالاهای پرگردش بدون پرداخت نقدی از گزینه پرداخت چکی یا اعتبار هفتگی هنگام ثبت سفارش استفاده کنید.'
                    : 'رسید هر قسط را پس از پرداخت از تب «رسید اقساط» بارگذاری و نتیجه بررسی آن را پیگیری کنید.'}
                </span>
              </div>
            </div>

            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                backgroundColor: 'var(--card)',
                border: '1px solid var(--tamas-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '20px' }}>📈</span>
              <div>
                <strong style={{ fontSize: '13.5px', color: 'var(--tamas-fg)', display: 'block', marginBottom: '4px' }}>
                  نحوه ارتقاء سقف اعتبار
                </strong>
                <span style={{ fontSize: '12.5px', color: 'var(--tamas-muted)', lineHeight: 1.6, display: 'block' }}>
                  سقف اعتبار شما به صورت خودکار بر اساس <strong>خوش‌حسابی (تسویه به‌موقع)</strong> و <strong>خریدهای منظم</strong> توسط سیستم بررسی و افزایش می‌یابد.
                </span>
              </div>
            </div>

            {/* Quick Notifications List */}
            {dashboard?.notifications && dashboard.notifications.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <strong style={{ fontSize: '13.5px' }}>⏰ یادآوری‌های فوری پرداخت:</strong>
                {dashboard.notifications.slice(0, 3).map((notif) => (
                  <div
                    key={notif.id}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: `1px solid ${notif.severity === 'danger' ? '#fecaca' : notif.severity === 'warning' ? '#fef08a' : '#bfdbfe'}`,
                      backgroundColor: notif.severity === 'danger' ? '#fef2f2' : notif.severity === 'warning' ? '#fffbeb' : '#eff6ff',
                      color: notif.severity === 'danger' ? '#991b1b' : notif.severity === 'warning' ? '#92400e' : '#1e40af',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <strong>{notif.title}: </strong>
                      <span>{notif.message}</span>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 800 }}>{formatPersianDueDate(notif.dueDate)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--tamas-muted)', fontSize: '13px' }}>
                ✓ هیچ پرداخت یا چک سررسیدشده‌ای در حال حاضر وجود ندارد.
              </div>
            )}
          </div>
        )}

        {activeTab === 'credit_report' && (
          <CreditReportPanel
            currentReport={dashboard?.currentCreditReport ?? null}
            reports={dashboard?.creditReports ?? []}
            onUploaded={fetchDashboard}
            showHistory
          />
        )}

        {/* Tab 2: Notifications */}
        {activeTab === 'notifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <strong style={{ fontSize: '14px' }}>🔔 اعلان‌ها و هشدارهای سررسید پرداخت:</strong>
            {dashboard?.notifications && dashboard.notifications.length > 0 ? (
              dashboard.notifications.map((notif) => (
                <div
                  key={notif.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: `1px solid ${notif.severity === 'danger' ? '#fecaca' : notif.severity === 'warning' ? '#fef08a' : '#bfdbfe'}`,
                    backgroundColor: notif.severity === 'danger' ? '#fef2f2' : notif.severity === 'warning' ? '#fffbeb' : '#eff6ff',
                    color: notif.severity === 'danger' ? '#991b1b' : notif.severity === 'warning' ? '#92400e' : '#1e40af',
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '14px' }}>{notif.title}</strong>
                    <span style={{ fontSize: '12px', fontWeight: 800, padding: '2px 8px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.6)' }}>
                      سررسید: {formatPersianDueDate(notif.dueDate)}
                    </span>
                  </div>
                  <div>{notif.message}</div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--tamas-muted)', fontSize: '13px' }}>
                هیچ سررسید پرداخت یا هشداری ثبت نشده است.
              </div>
            )}
          </div>
        )}

        {activeTab === 'receipts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div role="note" style={{ padding: '12px 14px', border: '1px solid var(--tamas-border)', borderRadius: '12px', background: 'var(--tamas-info-bg)', color: 'var(--tamas-fg)', fontSize: '13px', lineHeight: 1.8 }}>
              پس از پرداخت هر قسط، تصویر یا فایل رسید همان قسط را اینجا بارگذاری کنید. اگر رسید قسط سررسیدشده ثبت نشود، روزانه سه یادآوری برای شما ارسال می‌شود.
            </div>
            {(dashboard?.installmentOrders?.length ?? 0) > 0 ? dashboard!.installmentOrders.map((order) => (
              <section key={order.orderId} style={{ border: '1px solid var(--tamas-border)', borderRadius: '14px', overflow: 'hidden', background: 'var(--card)' }}>
                <header style={{ padding: '12px 14px', background: 'var(--tamas-surface)', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <strong>سفارش {order.orderCode}</strong>
                  <span style={{ color: 'var(--tamas-muted)', fontSize: '12px' }}>{order.planLabel}</span>
                </header>
                <div style={{ display: 'grid', gap: '10px', padding: '12px' }}>
                  {order.schedule.map((installment) => {
                    const uploadKey = `receipt-${order.orderId}-${installment.index}`;
                    const receipt = installment.receipt;
                    const statusText = receipt?.status === 'approved' ? 'تأیید شده' : receipt?.status === 'pending' ? 'در انتظار بررسی' : receipt?.status === 'rejected' ? 'رد شده' : 'رسید ثبت نشده';
                    const statusColor = receipt?.status === 'approved' ? '#15803d' : receipt?.status === 'pending' ? '#b45309' : installment.isDue ? '#b91c1c' : 'var(--tamas-muted)';
                    return (
                      <div className="credit-receipt-row" key={installment.index} style={{ padding: '12px', border: `1px solid ${installment.isOverdue ? '#fecaca' : 'var(--tamas-border)'}`, borderRadius: '12px', display: 'grid', gap: '12px', alignItems: 'center' }}>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ display: 'block', fontSize: '13.5px' }}>قسط {(installment.index + 1).toLocaleString('fa-IR')} — {formatMoney(installment.amount)}</strong>
                          <span style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: 'var(--tamas-muted)' }}>سررسید: {formatPersianDueDate(installment.dueDate)}</span>
                          <span style={{ display: 'block', marginTop: '5px', fontSize: '12px', fontWeight: 800, color: statusColor }}>{statusText}</span>
                          {receipt?.rejectionReason && <span style={{ display: 'block', marginTop: '4px', color: '#b91c1c', fontSize: '12px' }}>علت رد: {receipt.rejectionReason}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {receipt && <a className="btn ghost sm" href={receipt.receiptUrl} target="_blank" rel="noreferrer">مشاهده رسید</a>}
                          {receipt?.status !== 'approved' && (
                            <>
                              <input
                                id={uploadKey}
                                type="file"
                                accept="image/*,application/pdf"
                                hidden
                                disabled={uploadingField === uploadKey}
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (file) void handleInstallmentReceiptUpload(order.orderId, installment.index, file);
                                  event.currentTarget.value = '';
                                }}
                              />
                              <label className="btn primary sm" htmlFor={uploadKey} aria-disabled={uploadingField === uploadKey}>
                                {uploadingField === uploadKey ? 'در حال ثبت...' : receipt ? 'بارگذاری مجدد' : 'بارگذاری رسید'}
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--tamas-muted)' }}>سفارش قسطی فعالی برای ثبت رسید وجود ندارد.</div>
            )}
          </div>
        )}

        {/* Tab 3: Cheques Ledger */}
        {activeTab === 'cheques' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '14px' }}>📑 دفترچه ثبت چک‌ها</strong>
              <button
                type="button"
                className="btn primary sm"
                onClick={() => setActiveTab('new_cheque')}
                style={{ padding: '6px 12px', fontSize: '12.5px' }}
              >
                + ثبت چک جدید
              </button>
            </div>

            {dashboard?.cheques && dashboard.cheques.length > 0 ? (
              <>
              <p className="credit-table-hint">برای دیدن همهٔ ستون‌ها، جدول را به چپ و راست بکشید.</p>
              <div className="credit-table-wrap" role="region" aria-label="جدول چک‌ها" tabIndex={0} style={{ overflowX: 'auto', border: '1px solid var(--tamas-border)', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--tamas-surface)', borderBottom: '1px solid var(--tamas-border)' }}>
                      <th style={{ padding: '10px 12px' }}>شماره صیادی / چک</th>
                      <th style={{ padding: '10px 12px' }}>بانک صادرکننده</th>
                      <th style={{ padding: '10px 12px' }}>صاحب حساب</th>
                      <th style={{ padding: '10px 12px' }}>مبلغ (تومان)</th>
                      <th style={{ padding: '10px 12px' }}>تاریخ سررسید</th>
                      <th style={{ padding: '10px 12px' }}>وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.cheques.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--tamas-border)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace' }}>{c.chequeNumber}</td>
                        <td style={{ padding: '10px 12px' }}>{c.bankName}</td>
                        <td style={{ padding: '10px 12px' }}>{c.accountHolder}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{formatMoney(c.amount)}</td>
                        <td style={{ padding: '10px 12px' }}>{formatPersianDueDate(c.dueDate)}</td>
                        <td style={{ padding: '10px 12px' }}>{renderChequeStatusBadge(c.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--tamas-muted)', fontSize: '13px' }}>
                هنوز هیچ چکی ثبت نکرده‌اید. با کلیک بر روی «ثبت چک جدید» اطلاعات چک‌های خود را وارد کنید.
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Register New Cheque */}
        {activeTab === 'new_cheque' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: 'var(--card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--tamas-border)' }}>
            <strong style={{ fontSize: '14px', color: 'var(--tamas-fg)' }}>➕ ثبت اطلاعات چک جدید</strong>

            {dashboard?.chequeOrders.some((order) => order.canSubmitNextCheque) ? (
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '4px' }}>
                  سفارش چکی <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <AnimatedDropdown
                  variant="storefront"
                  options={dashboard.chequeOrders
                    .filter((order) => order.canSubmitNextCheque)
                    .map((order) => ({
                      value: String(order.orderId),
                      label: `${order.orderCode} — قسط ${order.nextInstallment ? formatMoney(order.nextInstallment.amount) : ''}`,
                    }))}
                  value={selectedOrderId}
                  onChange={setSelectedOrderId}
                  ariaLabel="انتخاب سفارش چکی"
                  buttonClassName="credit-bank-select"
                />
                {selectedChequeOrder?.nextInstallment && (
                  <div style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '10px', background: 'var(--tamas-surface)', fontSize: '12.5px', lineHeight: 1.8 }}>
                    مبلغ و سررسید توسط سامانه تعیین شده است: <strong>{formatMoney(selectedChequeOrder.nextInstallment.amount)}</strong>
                    {' — '}سررسید <strong>{selectedChequeOrder.nextInstallment.dueLabel}</strong>
                    {selectedChequeOrder.schedule.every((item) => !item.registered) && (
                      <div>چک اول باید حداکثر تا {new Date(selectedChequeOrder.submissionDeadline).toLocaleDateString('fa-IR')} ثبت شود.</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div role="alert" style={{ padding: '12px', borderRadius: '10px', background: '#fff7ed', color: '#9a3412', fontSize: '13px' }}>
                سفارش چکی فعالی برای ثبت قسط بعدی وجود ندارد.
                {dashboard?.chequeOrders.find((order) => order.blockedReason)?.blockedReason
                  ? ` ${dashboard.chequeOrders.find((order) => order.blockedReason)?.blockedReason}`
                  : ''}
              </div>
            )}

            <div className="credit-form-grid" style={{ display: 'grid', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '4px' }}>
                  شماره صیادی / شماره چک <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: ۱۲۳۴۵۶۷۸۹۰۱۲"
                  value={chequeNum}
                  onChange={(e) => setChequeNum(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--tamas-border)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '4px' }}>
                  بانک صادرکننده <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <AnimatedDropdown
                  variant="storefront"
                  options={BANK_OPTIONS}
                  value={bankName}
                  onChange={setBankName}
                  ariaLabel="بانک صادرکننده"
                  buttonClassName="credit-bank-select"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '4px' }}>
                  نام صاحب حساب <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--tamas-border)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '4px' }}>
                  مبلغ چک
                </label>
                <input
                  type="text"
                  readOnly
                  value={selectedChequeOrder?.nextInstallment ? formatMoney(selectedChequeOrder.nextInstallment.amount) : ''}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--tamas-border)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '4px' }}>
                  تاریخ سررسید
                </label>
                <input
                  type="text"
                  readOnly
                  value={selectedChequeOrder?.nextInstallment?.dueLabel ?? ''}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--tamas-border)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '4px' }}>
                  تصویر برگ چک (اختیاری)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  id="cheque-img-upload"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload('chequeImageUrl', f);
                  }}
                />
                <label
                  htmlFor="cheque-img-upload"
                  className="btn ghost sm"
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--tamas-border)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  📁 {uploadingField === 'chequeImageUrl' ? 'در حال آپلود...' : 'انتخاب تصویر چک'}
                </label>
                {chequeImageUrl && <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 800, marginInlineStart: '8px' }}>✓ بارگذاری شد</span>}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '4px' }}>
                توضیحات یا بابت سفارش (اختیاری)
              </label>
              <input
                type="text"
                placeholder="توضیحات بابت شماره فاکتور یا تسویه..."
                value={chequeNotes}
                onChange={(e) => setChequeNotes(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--tamas-border)', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                className="btn primary"
                disabled={submittingCheque || !selectedChequeOrder?.canSubmitNextCheque}
                onClick={handleCreateCheque}
                style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '13.5px' }}
              >
                {submittingCheque ? 'در حال ثبت...' : 'ثبت چک در حساب اعتباری'}
              </button>
            </div>
          </div>
        )}

        {/* Tab 5: Account Details */}
        {activeTab === 'details' && existingApp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: 'var(--card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--tamas-border)' }}>
            <strong style={{ fontSize: '14px' }}>📄 اطلاعات پرونده اعتباری و تضامین</strong>
            <div className="credit-form-grid" style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
              <div>• کد ملی: <b>{existingApp.nationalId}</b></div>
              <div>• نوع کسب‌وکار: <b>{existingApp.businessType}</b></div>
              <div>• امتیاز اعتباری سنجش‌شده: <b style={{ color: 'var(--tamas-accent)' }}>{existingApp.adminCreditScore} از ۱۰۰</b></div>
              <div>• تاریخ ثبت پرونده: <b>{new Date(existingApp.createdAt).toLocaleDateString('fa-IR')}</b></div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button
            type="button"
            className="btn ghost"
            onClick={onBack}
            style={{ padding: '10px 20px', borderRadius: '10px' }}
          >
            بازگشت به فروشگاه
          </button>
        </div>
      </div>
    );
  };

  const renderBody = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--tamas-muted)' }}>
          در حال دریافت اطلاعات...
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="credit-load-error" role="alert">
          <p>دریافت اطلاعات پروندهٔ اعتباری ناموفق بود. لطفاً دوباره تلاش کنید.</p>
          <button type="button" className="btn primary" onClick={() => void fetchDashboard()}>تلاش دوباره</button>
        </div>
      );
    }

    if (!isEditing && (existingApp?.status === 'active' || (dashboard?.installmentOrders.length ?? 0) > 0)) {
      return renderActiveCreditBuyerDashboard();
    }

    if (existingApp && !isEditing) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid var(--tamas-border)',
              backgroundColor: 'var(--card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '15px', fontWeight: 800 }}>وضعیت پرونده اعتباری شما</span>
              {renderStatusBadge(existingApp.status)}
            </div>

            <p style={{ fontSize: '14px', color: 'var(--tamas-fg)', margin: 0, lineHeight: 1.6 }}>
              {CREDIT_STATUS_DESCRIPTIONS[existingApp.status]}
            </p>

            {existingApp.status === 'action_required' && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: '13.5px',
                  lineHeight: 1.6,
                }}
              >
                <strong>علت نیاز به ویرایش:</strong> {existingApp.rejectionReason || 'مدارک ناخوانا یا ناقص است.'}
              </div>
            )}
          </div>

          <CreditReportPanel
            currentReport={dashboard?.currentCreditReport ?? null}
            reports={dashboard?.creditReports ?? []}
            onUploaded={fetchDashboard}
            showHistory
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            {existingApp.status === 'action_required' && (
              <button
                type="button"
                className="btn primary"
                onClick={() => setIsEditing(true)}
                style={{ padding: '10px 20px', borderRadius: '10px' }}
              >
                اصلاح و ارسال مجدد مدارک
              </button>
            )}
            <button
              type="button"
              className="btn ghost"
              onClick={onBack}
              style={{ padding: '10px 20px', borderRadius: '10px' }}
            >
              بازگشت به فروشگاه
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="credit-steps" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', marginBottom: '8px' }}>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '10%',
              right: '10%',
              height: '2px',
              backgroundColor: 'var(--tamas-border)',
              zIndex: 0,
              transform: 'translateY(-50%)',
            }}
          />
          {[
            { num: 1, label: 'اطلاعات هویتی و شغلی' },
            { num: 2, label: 'تضامین مالی' },
            { num: 3, label: 'تأیید نهایی' },
          ].map((s) => {
            const active = step >= s.num;
            const current = step === s.num;
            return (
              <div
                key={s.num}
                style={{
                  zIndex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--card)',
                  paddingInline: '8px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: active ? 'var(--tamas-accent)' : '#e2e8f0',
                    color: active ? '#ffffff' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '14px',
                    boxShadow: current ? '0 0 0 4px var(--tamas-info-bg)' : undefined,
                    transition: 'all 0.25s ease',
                  }}
                >
                  {s.num}
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: active ? 800 : 600, color: active ? 'var(--tamas-fg)' : 'var(--tamas-muted)' }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            padding: '14px 16px',
            borderRadius: '12px',
            backgroundColor: 'var(--tamas-info-bg)',
            border: '1px solid var(--tamas-border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '12.5px',
            color: 'var(--tamas-fg)',
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontSize: '18px', color: 'var(--tamas-accent)' }}>🔒</span>
          <div>
            <strong>چرا مدارک می‌گیریم؟</strong>
            <div>
              برای ارائه خرید چکی و اعتباری، نیاز داریم تا هویت تجاری و سابقه مالی شما را تأیید کنیم. این اطلاعات کاملاً محرمانه باقی می‌مانند.
            </div>
          </div>
        </div>

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="credit-form-grid" style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                  نام و نام خانوادگی
                </label>
                <input
                  type="text"
                  value={fullName}
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--tamas-border)',
                    backgroundColor: 'var(--tamas-surface)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                  کد ملی (۱۰ رقم) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="مثال: ۰۰۱۲۳۴۵۶۷۸"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--tamas-border)',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                نوع کسب‌وکار <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--tamas-border)',
                  fontSize: '13px',
                  backgroundColor: 'var(--card)',
                }}
              >
                <option value="مغازه‌دار">مغازه‌دار / فروشگاه حضوری</option>
                <option value="عمده‌فروش">عمده‌فروش / بنکدار</option>
                <option value="آنلاین‌شاپ">آنلاین‌شاپ / پیج اینستاگرام / سایت</option>
                <option value="شرکت">شرکت / سازمان خصوصی</option>
                <option value="غیره">سایر موارد</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                تصویر کارت ملی <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="file"
                  accept="image/*"
                  id="national-card-input"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload('nationalCardUrl', f);
                  }}
                />
                <label
                  htmlFor="national-card-input"
                  className="btn ghost"
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: '1px solid var(--tamas-border)',
                  }}
                >
                  📁 {uploadingField === 'nationalCardUrl' ? 'در حال بارگذاری...' : 'انتخاب تصویر کارت ملی'}
                </label>
                {nationalCardUrl && (
                  <span style={{ color: '#10b981', fontWeight: 800, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    ✓ بارگذاری شد
                  </span>
                )}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                تصویر جواز کسب یا اجاره‌نامه <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <div style={{ fontSize: '11.5px', color: 'var(--tamas-muted)', marginBottom: '8px' }}>
                راهنما: لطفاً فایل تصویر کامل و خوانا باشد.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="file"
                  accept="image/*"
                  id="business-docs-input"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload('businessDocsUrl', f);
                  }}
                />
                <label
                  htmlFor="business-docs-input"
                  className="btn ghost"
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: '1px solid var(--tamas-border)',
                  }}
                >
                  📁 {uploadingField === 'businessDocsUrl' ? 'در حال بارگذاری...' : 'انتخاب تصویر جواز / اجاره‌نامه'}
                </label>
                {businessDocsUrl && (
                  <span style={{ color: '#10b981', fontWeight: 800, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    ✓ بارگذاری شد
                  </span>
                )}
              </div>
            </div>

            <CreditReportPanel
              currentReport={dashboard?.currentCreditReport ?? null}
              reports={dashboard?.creditReports ?? []}
              onUploaded={fetchDashboard}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button
                type="button"
                className="btn primary"
                onClick={handleNextStep1}
                style={{ padding: '12px 24px', borderRadius: '10px', fontSize: '14px' }}
              >
                ادامه (مرحله ۲)
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: '1.5px dashed var(--tamas-accent)',
                backgroundColor: 'var(--tamas-info-bg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--tamas-fg)' }}>
                تصویر برگ چک صیادی <span style={{ color: 'var(--danger)' }}>* (الزامی)</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--tamas-muted)' }}>
                لطفاً تصویر کامل چک به همراه سریال صیادی خوانا را بارگذاری کنید.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                <input
                  type="file"
                  accept="image/*"
                  id="check-image-input"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload('checkImageUrl', f);
                  }}
                />
                <label
                  htmlFor="check-image-input"
                  className="btn primary"
                  style={{
                    padding: '10px 18px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  💳 {uploadingField === 'checkImageUrl' ? 'در حال بارگذاری...' : 'آپلود تصویر چک صیادی'}
                </label>
                {checkImageUrl && (
                  <span style={{ color: '#10b981', fontWeight: 800, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    ✓ چک با موفقیت بارگذاری شد
                  </span>
                )}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
                پرینت ۳ ماهه حساب اصلی <span style={{ color: 'var(--tamas-muted)' }}>(اختیاری)</span>
              </label>
              <div style={{ fontSize: '11.5px', color: 'var(--tamas-muted)', marginBottom: '8px' }}>
                آپلود این مدرک به افزایش سقف اعتبار اولیه شما کمک می‌کند.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  id="bank-statement-input"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload('bankStatementUrl', f);
                  }}
                />
                <label
                  htmlFor="bank-statement-input"
                  className="btn ghost"
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: '1px solid var(--tamas-border)',
                  }}
                >
                  📊 {uploadingField === 'bankStatementUrl' ? 'در حال بارگذاری...' : 'انتخاب فایل پرینت حساب'}
                </label>
                {bankStatementUrl && (
                  <span style={{ color: '#10b981', fontWeight: 800, fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    ✓ بارگذاری شد
                  </span>
                )}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
                نام معرف / همکار <span style={{ color: 'var(--tamas-muted)' }}>(اختیاری)</span>
              </label>
              <div style={{ fontSize: '11.5px', color: 'var(--tamas-muted)', marginBottom: '6px' }}>
                در صورت معرفی توسط یکی از همکاران قدیمی ما، نام یا شماره تماس ایشان را وارد کنید.
              </div>
              <input
                type="text"
                placeholder="نام یا شماره تماس معرف..."
                value={referralInfo}
                onChange={(e) => setReferralInfo(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--tamas-border)',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setStep(1)}
                style={{ padding: '10px 20px', borderRadius: '10px' }}
              >
                مرحله قبل
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleNextStep2}
                style={{ padding: '12px 24px', borderRadius: '10px', fontSize: '14px' }}
              >
                ادامه (تأیید نهایی)
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div
              style={{
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: 'var(--tamas-surface)',
                border: '1px solid var(--tamas-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '13px',
              }}
            >
              <strong style={{ fontSize: '14px' }}>خلاصه مدارک آماده ارسال:</strong>
              <div>• کد ملی: {nationalId}</div>
              <div>• نوع کسب‌وکار: {businessType}</div>
              <div>• کارت ملی: {nationalCardUrl ? '✓ بارگذاری شده' : '❌ بارگذاری نشده'}</div>
              <div>• جواز کسب / اجاره‌نامه: {businessDocsUrl ? '✓ بارگذاری شده' : '❌ بارگذاری نشده'}</div>
              <div>• برگ چک صیادی: {checkImageUrl ? '✓ بارگذاری شده' : '❌ بارگذاری نشده'}</div>
              {bankStatementUrl && <div>• پرینت حساب: ✓ بارگذاری شده</div>}
              {referralInfo && <div>• معرف: {referralInfo}</div>}
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '12.5px', lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: '3px' }}
              />
              <span>
                تعهدنامه خوش‌حسابی را مطالعه کرده‌ام و می‌پذیرم که سقف اعتبار بر اساس استعلام تیم مالی تماس مارکت تعیین می‌شود.
              </span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setStep(2)}
                style={{ padding: '10px 20px', borderRadius: '10px' }}
              >
                مرحله قبل
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={submitting || !agreed}
                onClick={handleSubmitApplication}
                style={{
                  padding: '12px 28px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 800,
                  backgroundColor: 'var(--tamas-accent)',
                }}
              >
                {submitting ? 'در حال ارسال...' : 'ارسال مدارک جهت بررسی'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return <div className="credit-dashboard">{renderBody()}</div>;
}
