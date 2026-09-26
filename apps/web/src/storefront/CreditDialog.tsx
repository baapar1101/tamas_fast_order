import { useEffect, useState } from 'react';
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
} from '@tamas/shared';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreditDialog({ open, onClose }: Props) {
  const toast = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingApp, setExistingApp] = useState<CreditApplicationDTO | null>(null);
  const [dashboard, setDashboard] = useState<CreditDashboardDTO | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'notifications' | 'cheques' | 'new_cheque' | 'details'>('summary');
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
  const [bankName, setBankName] = useState('بانک ملی');
  const [accountHolder, setAccountHolder] = useState(user ? `${user.name || ''} ${user.lastName || ''}`.trim() : '');
  const [chequeAmount, setChequeAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [chequeImageUrl, setChequeImageUrl] = useState('');
  const [chequeNotes, setChequeNotes] = useState('');
  const [submittingCheque, setSubmittingCheque] = useState(false);

  // Fetch credit dashboard on open
  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ ok: true } & CreditDashboardDTO>('/credit/dashboard');
      if (res.ok) {
        setDashboard(res);
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
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void fetchDashboard();
    }
  }, [open]);

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
    } catch (err: any) {
      toast.error(err.message || 'خطا در آپلود فایل');
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
    } catch (err: any) {
      toast.error(err.message || 'خطا در ثبت درخواست اعتباری');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCheque = async () => {
    if (!chequeNum.trim()) {
      toast.error('لطفاً شماره صیادی / چک را وارد کنید');
      return;
    }
    if (!chequeAmount || Number(chequeAmount) <= 0) {
      toast.error('لطفاً مبلغ چک را معتبر وارد کنید');
      return;
    }
    if (!dueDate.trim()) {
      toast.error('لطفاً تاریخ سررسید چک را وارد کنید');
      return;
    }

    setSubmittingCheque(true);
    try {
      const res = await api.post<{ ok: true }>('/credit/cheques', {
        chequeNumber: chequeNum.trim(),
        bankName,
        accountHolder: accountHolder.trim() || 'صاحب حساب',
        amount: Number(chequeAmount),
        dueDate: dueDate.trim(),
        imageUrl: chequeImageUrl || null,
        notes: chequeNotes.trim() || null,
      });

      if (res.ok) {
        toast.ok('چک جدید با موفقیت در سامانه اعتباری ثبت شد');
        setChequeNum('');
        setChequeAmount('');
        setDueDate('');
        setChequeImageUrl('');
        setChequeNotes('');
        setActiveTab('cheques');
        void fetchDashboard();
      }
    } catch (err: any) {
      toast.error(err.message || 'خطا در ثبت چک جدید');
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
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
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

        {/* Dashboard Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--tamas-border)',
            paddingBottom: '8px',
            overflowX: 'auto',
          }}
        >
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
                  🎉 پنل اعتباری شما فعال است
                </strong>
                <span style={{ fontSize: '12.5px', color: 'var(--tamas-muted)' }}>
                  شما می‌توانید برای خرید کالاهای پرگردش بدون پرداخت نقدی از گزینه پرداخت چکی یا اعتبار هفتگی هنگام ثبت سفارش استفاده کنید.
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
                <strong style={{ fontSize: '13.5px' }}>⏰ یادآوری‌های فوری سررسید چک:</strong>
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
                    <span style={{ fontSize: '12px', fontWeight: 800 }}>{notif.dueDate}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--tamas-muted)', fontSize: '13px' }}>
                ✓ هیچ چک سررسید شده یا معوقه‌ای در حال حاضر وجود ندارد.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Notifications */}
        {activeTab === 'notifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <strong style={{ fontSize: '14px' }}>🔔 ناتیفیکیشن‌ها و هشدار‌های سررسید چک:</strong>
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
                      سررسید: {notif.dueDate}
                    </span>
                  </div>
                  <div>{notif.message}</div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--tamas-muted)', fontSize: '13px' }}>
                هیچ سررسید چک یا هشداری ثبت نشده است.
              </div>
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
              <div style={{ overflowX: 'auto', border: '1px solid var(--tamas-border)', borderRadius: '12px' }}>
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
                        <td style={{ padding: '10px 12px' }}>{c.dueDate}</td>
                        <td style={{ padding: '10px 12px' }}>{renderChequeStatusBadge(c.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--tamas-border)', fontSize: '13px', backgroundColor: 'var(--card)' }}
                >
                  <option value="بانک ملی">بانک ملی</option>
                  <option value="بانک ملت">بانک ملت</option>
                  <option value="بانک صادرات">بانک صادرات</option>
                  <option value="بانک تجارت">بانک تجارت</option>
                  <option value="بانک سپه">بانک سپه</option>
                  <option value="بانک سامان">بانک سامان</option>
                  <option value="بانک پاسارگاد">بانک پاسارگاد</option>
                  <option value="بانک پارسیان">بانک پارسیان</option>
                  <option value="بانک کشاورزی">بانک کشاورزی</option>
                  <option value="بانک رفاه">بانک رفاه</option>
                  <option value="بانک آینده">بانک آینده</option>
                  <option value="بانک شهر">بانک شهر</option>
                </select>
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
                  مبلغ چک (تومان) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  placeholder="مثال: ۱۰,۰۰۰,۰۰۰"
                  value={chequeAmount}
                  onChange={(e) => setChequeAmount(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--tamas-border)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '4px' }}>
                  تاریخ سررسید (شمسی) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: ۱۴۰۳/۰۸/۱۵"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
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
                disabled={submittingCheque}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
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
            onClick={onClose}
            style={{ padding: '10px 20px', borderRadius: '10px' }}
          >
            بستن
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

    if (existingApp && !isEditing) {
      if (existingApp.status === 'active') {
        return renderActiveCreditBuyerDashboard();
      }

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
              onClick={onClose}
              style={{ padding: '10px 20px', borderRadius: '10px' }}
            >
              بستن
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', marginBottom: '8px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
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

  return (
    <Modal open={open} onClose={onClose} title={existingApp?.status === 'active' ? '💳 پنل خریداران اعتباری تماس مارکت' : 'درخواست فعال‌سازی سقف خرید اعتباری'} wide>
      {renderBody()}
    </Modal>
  );
}
