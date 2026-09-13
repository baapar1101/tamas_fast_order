import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { ImagePicker } from '../components/ImagePicker';

interface AuditEntry {
  id: number;
  actorId: number | null;
  action: string;
  entity: string;
  entityKey: string | null;
  detail: unknown;
  createdAt: string;
}

/** Settings the panel offers as proper fields; anything else stays free-form. */
const KNOWN_SETTINGS = [
  { key: 'store_name', label: 'نام فروشگاه' },
  { key: 'store_tagline', label: 'شعار / توضیح کوتاه' },
  { key: 'support_phone', label: 'شماره پشتیبانی', ltr: true },
  { key: 'store_address', label: 'آدرس فروشگاه', textarea: true },
  { key: 'hero_image', label: 'بنر بالای صفحه', image: true },
] as const;

export function SettingsPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const settings = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<{ settings: Record<string, string> }>('/admin/settings'),
  });

  const audit = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => api.get<{ items: AuditEntry[] }>('/admin/audit'),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  // Seed the form once the server values arrive, without clobbering edits.
  useEffect(() => {
    if (settings.data) setForm(settings.data.settings);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (body: Record<string, string>) => api.put<{ message: string }>('/admin/settings', body),
    onSuccess: (res) => {
      toast.ok(res.message ?? 'تنظیمات ذخیره شد.');
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void qc.invalidateQueries({ queryKey: ['bootstrap'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeKey = useMutation({
    mutationFn: (key: string) => api.del(`/admin/settings/${encodeURIComponent(key)}`),
    onSuccess: () => {
      toast.ok('کلید حذف شد.');
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
  });

  const knownKeys = new Set<string>(KNOWN_SETTINGS.map((s) => s.key));
  const extraKeys = Object.keys(form).filter((k) => !knownKeys.has(k)).sort();

  return (
    <>
      <div className="admin-head">
        <h1>تنظیمات</h1>
        <span className="spacer" />
        <button type="button" className="btn primary" disabled={save.isPending} onClick={() => save.mutate(form)}>
          {save.isPending ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}
        </button>
      </div>

      {settings.isLoading ? (
        <div className="skeleton" style={{ height: 260 }} />
      ) : (
        <>
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <h3 style={{ marginTop: 0, fontSize: 14.5 }}>اطلاعات فروشگاه</h3>
            <div className="form-grid">
              {KNOWN_SETTINGS.map((s) =>
                'image' in s && s.image ? (
                  <div className="full" key={s.key}>
                    <ImagePicker
                      label={s.label}
                      kind="slide"
                      value={form[s.key] ?? ''}
                      onChange={(url) => setForm({ ...form, [s.key]: url })}
                    />
                  </div>
                ) : (
                  <div className={`field${'textarea' in s && s.textarea ? ' full' : ''}`} key={s.key}>
                    <label htmlFor={`s-${s.key}`}>{s.label}</label>
                    {'textarea' in s && s.textarea ? (
                      <textarea
                        id={`s-${s.key}`}
                        className="textarea"
                        rows={2}
                        value={form[s.key] ?? ''}
                        onChange={(e) => setForm({ ...form, [s.key]: e.target.value })}
                      />
                    ) : (
                      <input
                        id={`s-${s.key}`}
                        className={`input${'ltr' in s && s.ltr ? ' ltr' : ''}`}
                        value={form[s.key] ?? ''}
                        onChange={(e) => setForm({ ...form, [s.key]: e.target.value })}
                      />
                    )}
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <h3 style={{ marginTop: 0, fontSize: 14.5 }}>تست و بررسی سامانه پیامک (Rastin SMS)</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
              جهت اطمینان از عملکرد درست وب‌سرویس پیامک، می‌توانید یک پیامک تست یا کد ورود به شماره همراه ارسال کنید.
            </p>

            <div className="row" style={{ marginTop: 10, gap: 10 }}>
              <input
                className="input ltr"
                placeholder="09130000000"
                style={{ maxWidth: 220 }}
                id="test-phone-input"
              />
              <button
                type="button"
                className="btn primary"
                onClick={async () => {
                  const input = document.getElementById('test-phone-input') as HTMLInputElement | null;
                  const phone = input?.value.trim();
                  if (!phone || phone.length < 10) {
                    toast.error('شماره موبایل معتبر وارد کنید.');
                    return;
                  }
                  try {
                    const res = await api.post<{ ok: boolean }>('/auth/otp/request', { phone });
                    if (res.ok) toast.ok(`پیامک تستی به ${phone} ارسال شد.`);
                    else toast.error('ارسال پیامک با خطا مواجه شد.');
                  } catch (err: any) {
                    toast.error(err.message || 'خطا در ارتباط با وب‌سرویس پیامک.');
                  }
                }}
              >
                ارسال پیامک تست
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <h3 style={{ marginTop: 0, fontSize: 14.5 }}>کلیدهای دلخواه</h3>

            <p className="muted" style={{ marginTop: 0, fontSize: 12.5 }}>
              این کلیدها با جدول Settings در گوگل شیت همگام می‌شوند. کلیدهایی که با <code>private_</code> شروع شوند در
              فروشگاه دیده نمی‌شوند.
            </p>

            <div className="stack" style={{ gap: 8 }}>
              {extraKeys.map((key) => (
                <div className="row" key={key}>
                  <input className="input ltr" value={key} readOnly style={{ maxWidth: 220 }} />
                  <input
                    className="input"
                    value={form[key] ?? ''}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => {
                      if (!confirm(`کلید «${key}» حذف شود؟`)) return;
                      removeKey.mutate(key);
                      const next = { ...form };
                      delete next[key];
                      setForm(next);
                    }}
                    aria-label="حذف کلید"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {extraKeys.length === 0 && <span className="faint" style={{ fontSize: 12 }}>کلید دلخواهی ثبت نشده است.</span>}
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <input
                className="input ltr"
                placeholder="کلید جدید"
                style={{ maxWidth: 220 }}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <input className="input" placeholder="مقدار" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const key = newKey.trim();
                  if (!key) return;
                  setForm({ ...form, [key]: newValue });
                  setNewKey('');
                  setNewValue('');
                }}
              >
                افزودن
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 18 }}>
            <h3 style={{ marginTop: 0, fontSize: 14.5 }}>تاریخچه تغییرات</h3>
            {audit.isLoading ? (
              <div className="skeleton" style={{ height: 140 }} />
            ) : (audit.data?.items.length ?? 0) === 0 ? (
              <div className="empty">تغییری ثبت نشده است.</div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>زمان</th>
                      <th>عملیات</th>
                      <th>موضوع</th>
                      <th>شناسه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.data!.items.slice(0, 60).map((a) => (
                      <tr key={a.id}>
                        <td>{new Date(a.createdAt).toLocaleString('fa-IR')}</td>
                        <td className="ltr">{a.action}</td>
                        <td className="ltr">{a.entity}</td>
                        <td className="ltr">{a.entityKey ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
