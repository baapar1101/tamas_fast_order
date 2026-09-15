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

const KNOWN_SETTINGS = [
  { key: 'store_name', label: 'نام فروشگاه' },
  { key: 'store_tagline', label: 'شعار / توضیح کوتاه' },
  { key: 'support_phone', label: 'شماره پشتیبانی', ltr: true },
  { key: 'store_address', label: 'آدرس فروشگاه', textarea: true },
  { key: 'hero_image', label: 'بنر بالای صفحه', image: true },
  
  // Gateways
  { key: 'gateway_zarinpal_merchant', label: 'مرچنت زرین‌پال', ltr: true },
  { key: 'gateway_saman_terminal', label: 'ترمینال بانک سامان', ltr: true },
  
  // Couriers
  { key: 'shipping_post_cost', label: 'هزینه ارسال پستی (تومان)', ltr: true },
  { key: 'free_shipping_threshold', label: 'حداقل مبلغ ارسال رایگان', ltr: true },
  
  // Domains & SEO
  { key: 'custom_domain', label: 'دامنه اختصاصی (مثال: example.com)', ltr: true },
  { key: 'seo_meta_description', label: 'توضیحات سئو (Meta Description)', textarea: true },
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
  const [testPhone, setTestPhone] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'tools' | 'logs'>('general');

  useEffect(() => {
    if (settings.data) setForm(settings.data.settings);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (body: Record<string, string>) => api.put<{ message: string }>('/admin/settings', body),
    onSuccess: (res) => {
      toast.ok(res.message ?? 'تنظیمات با موفقیت ذخیره شد.');
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void qc.invalidateQueries({ queryKey: ['bootstrap'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeKey = useMutation({
    mutationFn: (key: string) => api.del(`/admin/settings/${encodeURIComponent(key)}`),
    onSuccess: () => {
      toast.ok('کلید تنظیمات حذف شد.');
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
  });

  const knownKeys = new Set<string>(KNOWN_SETTINGS.map((s) => s.key));
  const extraKeys = Object.keys(form).filter((k) => !knownKeys.has(k)).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-wrap items-center justify-between gap-4 animate-fade-up">
        <div>
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">تنظیمات سیستم و پیکربندی</h2>
          <p className="mt-1 text-xs text-slate-400">مدیریت اطلاعات عمومی فروشگاه، تست پیامک و کلیدهای پیکربندی</p>
        </div>
        <button
          type="button"
          className="huma-btn-primary"
          disabled={save.isPending}
          onClick={() => save.mutate(form)}
        >
          {save.isPending ? 'در حال ذخیره...' : 'ذخیره کل تنظیمات'}
        </button>
      </section>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/[0.06] mb-6">
        <button
          type="button"
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'general' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('general')}
        >
          تنظیمات عمومی
        </button>
        <button
          type="button"
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'tools' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('tools')}
        >
          ابزارها و پیشرفته
        </button>
        <button
          type="button"
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'logs' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
          }`}
          onClick={() => setActiveTab('logs')}
        >
          لاگ سیستم
        </button>
      </div>

      {activeTab === 'general' && (
        <section className="glass-card p-6 space-y-4 animate-fade-up">
        <h3 className="text-base font-bold text-white border-b border-white/[0.06] pb-3">اطلاعات عمومی فروشگاه</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {KNOWN_SETTINGS.map((s) =>
            'image' in s && s.image ? (
              <div className="sm:col-span-2" key={s.key}>
                <ImagePicker
                  label={s.label}
                  kind="slide"
                  value={form[s.key] ?? ''}
                  onChange={(url) => setForm({ ...form, [s.key]: url })}
                />
              </div>
            ) : (
              <div className={`space-y-1.5 ${'textarea' in s && s.textarea ? 'sm:col-span-2' : ''}`} key={s.key}>
                <label className="block text-xs font-semibold text-slate-400">{s.label}</label>
                {'textarea' in s && s.textarea ? (
                  <textarea
                    className="huma-input"
                    rows={2}
                    value={form[s.key] ?? ''}
                    onChange={(e) => setForm({ ...form, [s.key]: e.target.value })}
                  />
                ) : (
                  <input
                    className={`huma-input ${'ltr' in s && s.ltr ? 'text-left font-mono' : ''}`}
                    dir={'ltr' in s && s.ltr ? 'ltr' : 'rtl'}
                    value={form[s.key] ?? ''}
                    onChange={(e) => setForm({ ...form, [s.key]: e.target.value })}
                  />
                )}
              </div>
            ),
          )}
        </div>
      </section>
      )}

      {activeTab === 'tools' && (
        <div className="space-y-6 animate-fade-up">
          {/* SMS Gateway Test Panel Card */}
          <section className="glass-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/[0.06] pb-3 gap-3">
              <div>
            <h3 className="text-base font-bold text-white">تست سامانه پیامک (Rastin SMS Gateway)</h3>
            <p className="text-xs text-slate-400 mt-0.5">ارسال پیامک تستی جهت اطمینان از عملکرد پترن و کد ورود</p>
          </div>
          <span className="chip chip-brand">پنل راستین‌اس‌ام‌اس فعال</span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            className="huma-input sm:w-64 text-left font-mono"
            dir="ltr"
            placeholder="09130000000"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
          />
          <button
            type="button"
            className="huma-btn-primary justify-center"
            onClick={async () => {
              const phone = testPhone.trim();
              if (!phone || phone.length < 10) {
                toast.error('شماره همراه معتبر وارد کنید.');
                return;
              }
              try {
                const res = await api.post<{ ok: boolean }>('/auth/otp/request', { phone });
                if (res.ok) toast.ok(`پیامک تست با موفقیت به ${phone} ارسال شد.`);
                else toast.error('خطا در ارسال پیامک.');
              } catch (err: any) {
                toast.error(err.message || 'خطا در ارتباط با سامانه پیامک.');
              }
            }}
          >
            ارسال پیامک تست
          </button>
        </div>
      </section>

      {/* Extra Config Keys Card */}
      <section className="glass-card p-6 space-y-4">
        <h3 className="text-base font-bold text-white border-b border-white/[0.06] pb-3">کلیدهای پیکربندی دلخواه</h3>
        <p className="text-xs text-slate-400">
          کلیدهای با پیشوند <code>private_</code> فقط در سمت سرور و پنل مدیریت قابل استفاده هستند.
        </p>

        <div className="space-y-3">
          {extraKeys.map((key) => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-900/50 p-3 sm:p-0 sm:bg-transparent rounded-lg">
              <input className="huma-input w-full sm:w-48 text-left font-mono" dir="ltr" value={key} readOnly />
              <input
                className="huma-input flex-1 w-full"
                value={form[key] ?? ''}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
              <button
                type="button"
                className="huma-btn-secondary w-full sm:w-auto !bg-rose-500/15 !text-rose-300 justify-center"
                onClick={() => {
                  if (!confirm(`کلید «${key}» حذف شود؟`)) return;
                  removeKey.mutate(key);
                  const next = { ...form };
                  delete next[key];
                  setForm(next);
                }}
              >
                حذف
              </button>
            </div>
          ))}
          {extraKeys.length === 0 && <p className="text-xs text-slate-500 py-2">هیچ کلید دلخواهی تعریف نشده است.</p>}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-4 border-t border-white/[0.04] mt-4">
          <input
            className="huma-input w-full sm:w-48 text-left font-mono"
            dir="ltr"
            placeholder="کلید جدید"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <input
            className="huma-input flex-1 w-full"
            placeholder="مقدار"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <button
            type="button"
            className="huma-btn-secondary w-full sm:w-auto justify-center"
            onClick={() => {
              const k = newKey.trim();
              if (!k) return;
              setForm({ ...form, [k]: newValue });
              setNewKey('');
              setNewValue('');
            }}
          >
            + افزودن
          </button>
        </div>
          </button>
        </div>
      </section>
      </div>
      )}

      {activeTab === 'logs' && (
      <section className="glass-card overflow-hidden animate-fade-up">
        <div className="border-b border-white/[0.06] px-6 py-4">
          <h3 className="text-sm font-bold text-white">تاریخچه تغییرات مدیریت (Audit Log)</h3>
        </div>

        <div className="huma-table-container">
          <table className="huma-table">
            <thead>
              <tr>
                <th>زمان</th>
                <th>عملیات</th>
                <th>موضوع</th>
                <th>شناسه</th>
              </tr>
            </thead>
            <tbody>
              {(audit.data?.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    هیچ تغییر مدیریتی ثبت نشده است.
                  </td>
                </tr>
              ) : (
                audit.data?.items.slice(0, 30).map((a) => (
                  <tr key={a.id} className="order-row">
                    <td className="text-xs text-slate-400">
                      {new Date(a.createdAt).toLocaleString('fa-IR')}
                    </td>
                    <td className="font-mono text-xs text-emerald-300" dir="ltr">
                      {a.action}
                    </td>
                    <td className="font-mono text-xs text-slate-300" dir="ltr">
                      {a.entity}
                    </td>
                    <td className="font-mono text-xs text-slate-400" dir="ltr">
                      {a.entityKey ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </div>
  );
}
