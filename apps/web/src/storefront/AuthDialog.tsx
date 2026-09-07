import { useCallback, useEffect, useRef, useState } from 'react';
import type { UserDTO } from '@tamas/shared';
import { PROFILE_FIELD_LABELS, formatNumber, isValidPhone, normalizePhone, toAsciiDigits } from '@tamas/shared';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { ApiRequestError, api } from '../lib/api';
import { useAuth } from '../store/auth';

type Step = 'phone' | 'code' | 'profile' | 'account';

interface Props {
  open: boolean;
  initialStep?: Step;
  onClose: () => void;
  /** Called once the user is signed in *and* has a complete profile. */
  onReady?: () => void;
}

interface OtpRequestResponse {
  resendAfter: number;
  devCode?: string;
}

interface AuthResponse {
  token: string;
  user: UserDTO;
  complete: boolean;
  missing: string[];
  isNew: boolean;
}

interface ProfileResponse {
  user: UserDTO;
  complete: boolean;
  missing: string[];
  message?: string;
}

const PROFILE_FIELDS = [
  { key: 'name', label: 'نام', required: true },
  { key: 'lastName', label: 'نام خانوادگی', required: true },
  { key: 'storeName', label: 'نام فروشگاه', required: true, full: true },
  { key: 'landline', label: 'تلفن ثابت', ltr: true },
  { key: 'postalCode', label: 'کد پستی', ltr: true },
  { key: 'address', label: 'آدرس', required: true, full: true, textarea: true },
  { key: 'certificateFileUrl', label: 'لینک جواز کسب', full: true },
] as const;

type ProfileForm = Record<string, string>;

const emptyProfile = (user: UserDTO | null): ProfileForm => ({
  name: user?.name ?? '',
  lastName: user?.lastName ?? '',
  storeName: user?.storeName ?? '',
  landline: user?.landline ?? '',
  postalCode: user?.postalCode ?? '',
  address: user?.address ?? '',
  certificateFileUrl: user?.certificateFileUrl ?? '',
});

export function AuthDialog({ open, initialStep = 'phone', onClose, onReady }: Props) {
  const toast = useToast();
  const { user, complete, missing, applyLogin, applyProfile, logout } = useAuth();

  const [step, setStep] = useState<Step>(initialStep);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [form, setForm] = useState<ProfileForm>(emptyProfile(null));
  const [invalid, setInvalid] = useState<string[]>([]);
  const timerRef = useRef<number | null>(null);

  // Reopening the dialog must not show whatever was left on screen last time.
  useEffect(() => {
    if (!open) return;
    setError('');
    setCode('');
    setInvalid([]);
    if (user) {
      setForm(emptyProfile(user));
      setStep(complete ? (initialStep === 'profile' ? 'profile' : 'account') : 'profile');
      setInvalid(complete ? [] : missing);
    } else {
      setStep('phone');
    }
  }, [open, user, complete, missing, initialStep]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    timerRef.current = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [cooldown]);

  const requestCode = useCallback(
    async (resend: boolean) => {
      const clean = normalizePhone(phone);
      if (!isValidPhone(clean)) {
        setError('شماره موبایل را درست وارد کنید (مثل 09121234567).');
        return;
      }
      setError('');
      setBusy(true);
      try {
        const res = await api.post<OtpRequestResponse>('/auth/otp/request', { phone: clean });
        setCooldown(res.resendAfter);
        setStep('code');
        // In development the API returns the code so the field can be prefilled.
        if (res.devCode) {
          setCode(res.devCode);
          toast.show(`کد تست: ${res.devCode}`);
        } else {
          toast.ok(resend ? 'کد جدید ارسال شد.' : 'کد تایید برای شما پیامک شد.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ارسال کد ناموفق بود.');
      } finally {
        setBusy(false);
      }
    },
    [phone, toast],
  );

  const verify = useCallback(async () => {
    const digits = toAsciiDigits(code).replace(/\D/g, '');
    if (digits.length < 4) {
      setError('کد تایید را کامل وارد کنید.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const data = await api.post<AuthResponse>('/auth/otp/verify', { phone: normalizePhone(phone), code: digits });
      applyLogin(data);
      setForm(emptyProfile(data.user));
      if (!data.complete) {
        setInvalid(data.missing);
        setStep('profile');
        toast.show(data.isNew ? 'ثبت‌نام انجام شد. اطلاعات خود را کامل کنید.' : 'اطلاعات حساب شما کامل نیست.');
      } else {
        toast.ok('با موفقیت وارد شدید.');
        onReady?.();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ورود ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }, [code, phone, applyLogin, toast, onReady, onClose]);

  const saveProfile = useCallback(async () => {
    setError('');
    setBusy(true);
    try {
      const data = await api.put<ProfileResponse>('/auth/profile', form);
      applyProfile(data);
      setInvalid([]);
      toast.ok(data.message ?? 'اطلاعات شما ذخیره شد.');
      onReady?.();
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setInvalid(err.missingFields);
        setError(
          err.missingFields.length > 0
            ? `تکمیل این موارد الزامی است: ${err.missingFields.map((f) => PROFILE_FIELD_LABELS[f] ?? f).join('، ')}`
            : err.message,
        );
      } else {
        setError('ذخیره اطلاعات ناموفق بود.');
      }
    } finally {
      setBusy(false);
    }
  }, [form, applyProfile, toast, onReady, onClose]);

  const title =
    step === 'phone'
      ? 'ورود / ثبت نام'
      : step === 'code'
        ? 'تایید شماره موبایل'
        : step === 'profile'
          ? complete
            ? 'ویرایش اطلاعات'
            : 'تکمیل اطلاعات'
          : 'حساب کاربری';

  return (
    <Modal open={open} title={title} onClose={onClose} busy={busy}>
      {error && (
        <div className="alert error" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      {step === 'phone' && (
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>
            شماره موبایل خود را وارد کنید. کد تایید پیامک می‌شود.
          </p>
          <div className="field">
            <label htmlFor="auth-phone">شماره موبایل</label>
            <input
              id="auth-phone"
              className="input ltr"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={13}
              placeholder="09xxxxxxxxx"
              value={phone}
              onChange={(e) => setPhone(toAsciiDigits(e.target.value).replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void requestCode(false);
              }}
            />
          </div>
          <button type="button" className="btn primary block" disabled={busy} onClick={() => void requestCode(false)}>
            {busy ? 'در حال ارسال…' : 'ارسال کد تایید'}
          </button>
        </div>
      )}

      {step === 'code' && (
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>
            کد پیامک‌شده به <b className="ltr-inline">{phone}</b> را وارد کنید.
            <button type="button" className="btn ghost sm" onClick={() => setStep('phone')}>
              تغییر شماره
            </button>
          </p>
          <input
            className="input otp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            autoFocus
            onChange={(e) => setCode(toAsciiDigits(e.target.value).replace(/\D/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void verify();
            }}
          />
          <button type="button" className="btn primary block" disabled={busy} onClick={() => void verify()}>
            {busy ? 'در حال بررسی…' : 'تایید و ورود'}
          </button>
          <button
            type="button"
            className="btn block"
            disabled={busy || cooldown > 0}
            onClick={() => void requestCode(true)}
          >
            {cooldown > 0 ? `ارسال مجدد تا ${formatNumber(cooldown)} ثانیه` : 'ارسال مجدد کد'}
          </button>
        </div>
      )}

      {step === 'profile' && (
        <div className="stack">
          <div className="phone-chip">
            شماره تاییدشده: <b className="ltr-inline">{user?.phone}</b>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {complete
              ? 'می‌توانید اطلاعات حساب خود را به‌روزرسانی کنید.'
              : 'برای ثبت سفارش، فیلدهای ستاره‌دار را کامل کنید.'}
          </p>

          <div className="auth-grid">
            {PROFILE_FIELDS.map((f) => (
              <div className={`field${'full' in f && f.full ? ' full' : ''}`} key={f.key}>
                <label htmlFor={`p-${f.key}`}>
                  {f.label}
                  {'required' in f && f.required ? ' *' : ''}
                </label>
                {'textarea' in f && f.textarea ? (
                  <textarea
                    id={`p-${f.key}`}
                    className={`textarea${invalid.includes(f.key) ? ' invalid' : ''}`}
                    rows={3}
                    value={form[f.key] ?? ''}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                ) : (
                  <input
                    id={`p-${f.key}`}
                    className={`input${'ltr' in f && f.ltr ? ' ltr' : ''}${invalid.includes(f.key) ? ' invalid' : ''}`}
                    inputMode={'ltr' in f && f.ltr ? 'numeric' : undefined}
                    value={form[f.key] ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [f.key]: 'ltr' in f && f.ltr ? toAsciiDigits(e.target.value).replace(/\D/g, '') : e.target.value,
                      })
                    }
                  />
                )}
              </div>
            ))}
          </div>

          <button type="button" className="btn primary block" disabled={busy} onClick={() => void saveProfile()}>
            {busy ? 'در حال ذخیره…' : 'ذخیره اطلاعات'}
          </button>
          <button type="button" className="btn block" onClick={onClose} disabled={busy}>
            {complete ? 'بستن' : 'بعداً'}
          </button>
        </div>
      )}

      {step === 'account' && user && (
        <div className="stack">
          <div className="card" style={{ padding: 14 }}>
            <div className="stack" style={{ gap: 7 }}>
              <div className="row">
                <span className="muted">نام</span>
                <span className="spacer" />
                <b>
                  {user.name} {user.lastName}
                </b>
              </div>
              <div className="row">
                <span className="muted">فروشگاه</span>
                <span className="spacer" />
                <b>{user.storeName || '—'}</b>
              </div>
              <div className="row">
                <span className="muted">موبایل</span>
                <span className="spacer" />
                <b className="ltr-inline">{user.phone}</b>
              </div>
              <div className="row">
                <span className="muted">وضعیت</span>
                <span className="spacer" />
                <span className={`badge ${user.isActive ? 'success' : 'warn'}`}>
                  {user.isActive ? 'تایید شده' : 'در انتظار تایید'}
                </span>
              </div>
            </div>
          </div>

          <button type="button" className="btn block" onClick={() => setStep('profile')}>
            ویرایش اطلاعات
          </button>
          <button
            type="button"
            className="btn danger block"
            onClick={async () => {
              await logout();
              toast.ok('از حساب خود خارج شدید.');
              onClose();
            }}
          >
            خروج از حساب
          </button>
        </div>
      )}
    </Modal>
  );
}
