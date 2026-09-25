import { useEffect, useState } from 'react';
import type { CreditApplicationDTO, CreditStatus } from '@tamas/shared';
import { CREDIT_STATUS_DESCRIPTIONS, CREDIT_STATUS_LABELS, formatMoney } from '@tamas/shared';
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
  const [isEditing, setIsEditing] = useState(false);

  // Stepped Form State (1 -> 2 -> 3)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form Fields
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

  // Fetch existing application on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<{ ok: true; application: CreditApplicationDTO | null }>('/credit/my-application')
      .then((res) => {
        if (res.ok && res.application) {
          setExistingApp(res.application);
          // Prefill form
          setNationalId(res.application.nationalId || '');
          setBusinessType(res.application.businessType || 'مغازه‌دار');
          setNationalCardUrl(res.application.nationalCardUrl || '');
          setBusinessDocsUrl(res.application.businessDocsUrl || '');
          setCheckImageUrl(res.application.checkImageUrl || '');
          setBankStatementUrl(res.application.bankStatementUrl || '');
          setReferralInfo(res.application.referralInfo || '');
        } else {
          setExistingApp(null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
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

  const handleSubmit = async () => {
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
      }
    } catch (err: any) {
      toast.error(err.message || 'خطا در ثبت درخواست اعتباری');
    } finally {
      setSubmitting(false);
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

  const fullName = user ? `${user.name || ''} ${user.lastName || ''}`.trim() : '';

  const renderBody = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--tamas-muted)' }}>
          در حال دریافت اطلاعات...
        </div>
      );
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

            {existingApp.status === 'active' && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#166534',
                  fontSize: '15px',
                  fontWeight: 800,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>سقف خرید اعتباری اختصاص یافته:</span>
                <span style={{ fontSize: '18px', color: 'var(--tamas-accent)' }}>
                  {formatMoney(existingApp.assignedCreditLimit)}
                </span>
              </div>
            )}

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
                onClick={handleSubmit}
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
    <Modal open={open} onClose={onClose} title="درخواست فعال‌سازی سقف خرید اعتباری" wide>
      {renderBody()}
    </Modal>
  );
}
