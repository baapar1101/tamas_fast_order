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

const SMS_SETTINGS = [
  { key: 'sms_template_otp', label: 'متن پیامک کد تایید (متغیرها: {code})', textarea: true },
  { key: 'sms_template_order_pending', label: 'متن پیامک ثبت سفارش (متغیرها: {name}, {order_code})', textarea: true },
  { key: 'sms_template_order_confirmed', label: 'متن پیامک تایید سفارش (متغیرها: {name}, {order_code})', textarea: true },
  { key: 'sms_template_order_shipped', label: 'متن پیامک ارسال سفارش (متغیرها: {name}, {order_code})', textarea: true },
  { key: 'sms_template_order_cancelled', label: 'متن پیامک لغو سفارش (متغیرها: {name}, {order_code})', textarea: true },
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
  const [activeTab, setActiveTab] = useState<'general' | 'tools' | 'logs' | 'sms' | 'crm'>('general');

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
                  activeTab === 'crm' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
                }`}
                onClick={() => setActiveTab('crm')}
              >
                اتصال CRM
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
      </section>
            </div>
            )}

            {activeTab === 'crm' && (
              <div className="space-y-6 animate-fade-up">
                {/* CRM Connection Settings Card */}
                <section className="glass-card p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                    <div>
                      <h3 className="text-base font-bold text-white">تنظیمات اتصال CRM (Hesabix/MarkStreet)</h3>
                      <p className="text-xs text-slate-400 mt-0.5">پیکربندی اتصال دوطرفه با سیستم CRM برای همگام‌سازی سفارش‌ها، مشتریان و محصولات</p>
                    </div>
                    <span className="chip chip-brand">همگام‌سازی سفارش/مشتری/محصول</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-400">آدرس API پایه CRM</label>
                      <input
                        className="huma-input text-left font-mono"
                        dir="ltr"
                        placeholder="https://tamastore.ir"
                        value={form.CRM_API_BASE ?? ''}
                        onChange={(e) => setForm({ ...form, CRM_API_BASE: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-400">کلید API (Bearer Token)</label>
                      <input
                        className="huma-input text-left font-mono"
                        dir="ltr"
                        type="password"
                        placeholder="hsx_xsG3kMYcFToYiVEdc3h1jba9c0bShx7ZREK5JYufTbY"
                        value={form.CRM_API_KEY ?? ''}
                        onChange={(e) => setForm({ ...form, CRM_API_KEY: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-400">شناسه کسب‌وکار در CRM</label>
                      <input
                        className="huma-input text-left font-mono"
                        dir="ltr"
                        type="number"
                        placeholder="1"
                        value={form.CRM_BUSINESS_ID ?? '1'}
                        onChange={(e) => setForm({ ...form, CRM_BUSINESS_ID: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-400">مخفی رمز وب‌هوک (HMAC-SHA256)</label>
                      <input
                        className="huma-input text-left font-mono"
                        dir="ltr"
                        type="password"
                        placeholder="CRM_WEBHOOK_SECRET"
                        value={form.CRM_WEBHOOK_SECRET ?? ''}
                        onChange={(e) => setForm({ ...form, CRM_WEBHOOK_SECRET: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-white/[0.06]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-emerald-500 rounded border-slate-600 bg-slate-800"
                        checked={form.CRM_SYNC_ENABLED === 'true'}
                        onChange={(e) => setForm({ ...form, CRM_SYNC_ENABLED: e.target.checked ? 'true' : 'false' })}
                      />
                      <span className="text-sm text-slate-300">فعال‌سازی همگام‌سازی خودکار (سفارش/مشتری/محصول)</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-white/[0.06]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="number"
                        className="huma-input w-24 text-left font-mono"
                        dir="ltr"
                        min="100"
                        max="10000"
                        value={parseInt(form.CRM_SYNC_DEBOUNCE_MS ?? '500', 10)}
                        onChange={(e) => setForm({ ...form, CRM_SYNC_DEBOUNCE_MS: e.target.value })}
                      />
                      <span className="text-sm text-slate-300">دیبانس همگام‌سازی (میلی‌ثانیه)</span>
                    </label>
                  </div>
                </section>

                {/* CRM Health & Manual Sync Card */}
                <section className="glass-card p-6 space-y-4">
                  <h3 className="text-base font-bold text-white border-b border-white/[0.06] pb-3">بهداشت اتصال و همگام‌سازی دستی</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <button
                      type="button"
                      className="huma-btn-secondary"
                      onClick={async () => {
                        try {
                          const res = await api.get<{ ok: boolean; crm: { reachable: boolean; baseUrl: string } }>('/crm/health');
                          if (res.crm?.reachable) toast.ok(`CRM قابل دسترسی: ${res.crm.baseUrl}`);
                          else toast.error('CRM غیرقابل دسترسی است');
                        } catch (err: any) {
                          toast.error(err.message || 'خطا در بررسی اتصال');
                        }
                      }}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      بررسی اتصال
                    </button>

                    <button
                      type="button"
                      className="huma-btn-primary"
                      onClick={async () => {
                        try {
                          const res = await api.post<{ ok: boolean; pushed: number; errors: number; errorDetails: string[] }>('/crm/sync/products/push');
                          if (res.ok) toast.ok(`${res.pushed} محصول همگام‌سازی شد. خطاها: ${res.errors}`);
                          else toast.error(`خطاها: ${res.errorDetails?.slice(0, 3).join(', ')}`);
                        } catch (err: any) {
                          toast.error(err.message || 'خطا در همگام‌سازی محصولات');
                        }
                      }}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      ارسال همه محصولات
                    </button>

                    <button
                      type="button"
                      className="huma-btn-secondary"
                      onClick={async () => {
                        try {
                          const res = await api.post<{ ok: boolean; synced: number; errors: number; errorDetails: string[] }>('/crm/sync/stock');
                          if (res.ok) toast.ok(`${res.synced} محصول Stok همگام‌سازی شد. خطاها: ${res.errors}`);
                          else toast.error(`خطاها: ${res.errorDetails?.slice(0, 3).join(', ')}`);
                        } catch (err: any) {
                          toast.error(err.message || 'خطا در همگام‌سازی Stok');
                        }
                      }}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      همگام‌سازی Stok
                    </button>

                    <button
                      type="button"
                      className="huma-btn-secondary"
                      onClick={async () => {
                        try {
                          const res = await api.get<{ ok: boolean; crm: { reachable: boolean; baseUrl: string }; sync: { enabled: boolean; debounceMs: number }; local: { activeUsers: number; totalOrders: number; activeProducts: number } }>('/crm/stats');
                          const { crm, sync, local } = res;
                          toast.ok(`CRM: ${crm.reachable ? 'آنلاین' : 'آفلاین'} | کاربران: ${local.activeUsers} | سفارش‌ها: ${local.totalOrders} | محصولات: ${local.activeProducts}`);
                        } catch (err: any) {
                          toast.error(err.message || 'خطا در دریافت آمار');
                        }
                      }}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      آمار همگام‌سازی
                    </button>
                  </div>

                  <div className="p-3 bg-slate-900/50 rounded-xl border border-white/[0.06] text-xs text-slate-400">
                    <p><strong>نکته:</strong> تغییرات تنظیمات پس از ذخیره تنظیمات عمومی اعمال می‌شود. برای تست اتصال ابتدا تنظیمات را ذخیره کنید سپس دکمه «بررسی اتصال» را بزنید.</p>
                    <p className="mt-1">دکمه‌های «همگام‌سازی دستی» مستقیماً API را صدا می‌زنند و نتیجه را به صورت توست نمایش می‌دهند.</p>
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
