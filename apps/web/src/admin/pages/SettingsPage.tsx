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

interface SyncLogEntry {
  id: number;
  entity: 'order' | 'product' | 'person' | 'chat_message';
  entityKey: string;
  action: 'create' | 'update' | 'delete' | 'sync';
  status: 'success' | 'error' | 'pending' | 'skipped';
  remoteId?: string | number;
  error?: string;
  payload: Record<string, unknown>;
  response?: Record<string, unknown>;
  createdAt: string;
  durationMs?: number;
}

interface CrmStats {
  crm: { reachable: boolean; baseUrl: string; syncEnabled: boolean };
  local: { activeUsers: number; totalOrders: number; activeProducts: number };
  syncStats?: {
    totalSynced: number;
    totalErrors: number;
    lastSyncAt?: string;
    byEntity: Record<string, { synced: number; errors: number }>;
  };
}

interface SyncProductDetail {
  productId: string;
  sku: string | null;
  title: string;
  status: string;
  price: number;
  stock: number;
  kermanStock?: number;
  tehranStock?: number;
  imageUrl?: string | null;
  lastSyncedAt?: string;
  crmId?: number;
  syncStatus: 'synced' | 'pending' | 'error' | 'never';
  syncError?: string;
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

  const crmStats = useQuery({
    queryKey: ['admin', 'crm-stats'],
    queryFn: () => api.get<CrmStats>('/crm/stats'),
    enabled: !!settings.data?.settings.CRM_API_BASE,
    refetchInterval: 30000,
  });

  const syncLogs = useQuery({
    queryKey: ['admin', 'sync-logs'],
    queryFn: () => api.get<{ items: SyncLogEntry[] }>('/crm/sync/logs'),
    enabled: !!settings.data?.settings.CRM_API_BASE,
  });

  const syncProducts = useQuery({
    queryKey: ['admin', 'sync-products'],
    queryFn: () => api.get<{ items: SyncProductDetail[] }>('/crm/sync/products/detail'),
    enabled: !!settings.data?.settings.CRM_API_BASE,
  });

  const audit = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => api.get<{ items: AuditEntry[] }>('/admin/audit'),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'tools' | 'logs' | 'crm' | 'advanced-sync'>('general');

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

  const TABS: { id: 'general' | 'tools' | 'crm' | 'logs' | 'advanced-sync'; label: string }[] = [
    { id: 'general', label: 'تنظیمات عمومی' },
    { id: 'tools', label: 'ابزارها و پیشرفته' },
    { id: 'crm', label: 'اتصال CRM' },
    { id: 'logs', label: 'لاگ سیستم' },
    { id: 'advanced-sync', label: 'همگام‌سازی پیشرفته' },
  ];

  return (
    <div className="a-page a-fade">
      {/* Header */}
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">تنظیمات سیستم و پیکربندی</h2>
          <p className="a-subtitle">مدیریت اطلاعات عمومی فروشگاه، تست پیامک و کلیدهای پیکربندی</p>
        </div>
        <div className="a-page-actions">
          <button
            type="button"
            className="a-btn a-btn--primary"
            disabled={save.isPending}
            onClick={() => save.mutate(form)}
          >
            {save.isPending ? 'در حال ذخیره...' : 'ذخیره کل تنظیمات'}
          </button>
        </div>
      </section>

      {/* Tabs */}
      <div className="a-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`a-tab ${activeTab === t.id ? 'a-tab--on' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <section className="a-card a-fade">
          <div className="a-card-head">
            <h3 className="a-card-title">اطلاعات عمومی فروشگاه</h3>
          </div>
          <div className="a-form-grid a-cols--2">
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
                <div className={`a-field ${'textarea' in s && s.textarea ? 'sm:col-span-2' : ''}`} key={s.key}>
                  <label className="a-label">{s.label}</label>
                  {'textarea' in s && s.textarea ? (
                    <textarea
                      className="a-textarea"
                      rows={2}
                      value={form[s.key] ?? ''}
                      onChange={(e) => setForm({ ...form, [s.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      className={`a-input ${'ltr' in s && s.ltr ? 'a-ltr' : ''}`}
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
        <div className="a-page-stack a-fade">
          {/* SMS Gateway Test Panel Card */}
          <section className="a-card">
            <div className="a-card-head a-card-head--split">
              <div>
                <h3 className="a-card-title">تست سامانه پیامک (Rastin SMS Gateway)</h3>
                <p className="a-card-desc">ارسال پیامک تستی جهت اطمینان از عملکرد پترن و کد ورود</p>
              </div>
              <span className="a-badge a-badge--brand">پنل راستین‌اس‌ام‌اس فعال</span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                className="a-input a-input--auto sm:w-64 a-ltr"
                dir="ltr"
                placeholder="09130000000"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <button
                type="button"
                className="a-btn a-btn--primary"
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
          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">کلیدهای پیکربندی دلخواه</h3>
            </div>
            <p className="a-note">
              کلیدهای با پیشوند <code>private_</code> فقط در سمت سرور و پنل مدیریت قابل استفاده هستند.
            </p>

            <div className="a-page-stack">
              {extraKeys.map((key) => (
                <div key={key} className="a-key-row">
                  <input className="a-input a-key-row__key a-ltr" dir="ltr" value={key} readOnly />
                  <input
                    className="a-input a-grow"
                    value={form[key] ?? ''}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                  <button
                    type="button"
                    className="a-btn a-btn--danger a-btn--xs"
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
              {extraKeys.length === 0 && <p className="a-note">هیچ کلید دلخواهی تعریف نشده است.</p>}
            </div>

            <div className="a-key-row a-key-row--new">
              <input
                className="a-input a-key-row__key a-ltr"
                dir="ltr"
                placeholder="کلید جدید"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <input
                className="a-input a-grow"
                placeholder="مقدار"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
              <button
                type="button"
                className="a-btn a-btn--secondary a-btn--xs"
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
        <div className="a-page-stack a-fade">
          {/* CRM Connection Settings Card */}
          <section className="a-card">
            <div className="a-card-head a-card-head--split">
              <div>
                <h3 className="a-card-title">تنظیمات اتصال CRM (Hesabix/MarkStreet)</h3>
                <p className="a-card-desc">پیکربندی اتصال دوطرفه با سیستم CRM برای همگام‌سازی سفارش‌ها، مشتریان و محصولات</p>
              </div>
              <span className="a-badge a-badge--brand">همگام‌سازی سفارش/مشتری/محصول</span>
            </div>

            <div className="a-form-grid a-cols--2">
              <div className="a-field">
                <label className="a-label">آدرس API پایه CRM</label>
                <input
                  className="a-input a-ltr"
                  dir="ltr"
                  placeholder="https://tamastore.ir"
                  value={form.CRM_API_BASE ?? ''}
                  onChange={(e) => setForm({ ...form, CRM_API_BASE: e.target.value })}
                />
              </div>
              <div className="a-field">
                <label className="a-label">کلید API (Bearer Token)</label>
                <input
                  className="a-input a-ltr"
                  dir="ltr"
                  type="password"
                  placeholder="hsx_xsG3kMYcFToYiVEdc3h1jba9c0bShx7ZREK5JYufTbY"
                  value={form.CRM_API_KEY ?? ''}
                  onChange={(e) => setForm({ ...form, CRM_API_KEY: e.target.value })}
                />
              </div>
              <div className="a-field">
                <label className="a-label">شناسه کسب‌وکار در CRM</label>
                <input
                  className="a-input a-ltr"
                  dir="ltr"
                  type="number"
                  placeholder="1"
                  value={form.CRM_BUSINESS_ID ?? '1'}
                  onChange={(e) => setForm({ ...form, CRM_BUSINESS_ID: e.target.value })}
                />
              </div>
              <div className="a-field">
                <label className="a-label">مخفی رمز وب‌هوک (HMAC-SHA256)</label>
                <input
                  className="a-input a-ltr"
                  dir="ltr"
                  type="password"
                  placeholder="CRM_WEBHOOK_SECRET"
                  value={form.CRM_WEBHOOK_SECRET ?? ''}
                  onChange={(e) => setForm({ ...form, CRM_WEBHOOK_SECRET: e.target.value })}
                />
              </div>
            </div>

            <div className="a-option-row">
              <div className="a-option-copy">
                <div className="a-option-title">فعال‌سازی همگام‌سازی خودکار (سفارش/مشتری/محصول)</div>
                <div className="a-option-desc">پس از ذخیره، همگام‌سازی به صورت خودکار اجرا می‌شود</div>
              </div>
              <label className="a-switch">
                <input
                  type="checkbox"
                  checked={form.CRM_SYNC_ENABLED === 'true'}
                  onChange={(e) => setForm({ ...form, CRM_SYNC_ENABLED: e.target.checked ? 'true' : 'false' })}
                />
                <span className="a-switch-track"><span className="a-switch-thumb" /></span>
              </label>
            </div>

            <div className="a-option-row">
              <div className="a-option-copy">
                <div className="a-option-title">دیبانس همگام‌سازی (میلی‌ثانیه)</div>
                <div className="a-option-desc">فاصله زمانی بین اجرای متوالی سینک خودکار</div>
              </div>
              <input
                type="number"
                className="a-input a-input--auto a-ltr"
                dir="ltr"
                min="100"
                max="10000"
                value={parseInt(form.CRM_SYNC_DEBOUNCE_MS ?? '500', 10)}
                onChange={(e) => setForm({ ...form, CRM_SYNC_DEBOUNCE_MS: e.target.value })}
              />
            </div>
          </section>

          {/* CRM Health & Manual Sync Card */}
          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">بهداشت اتصال و همگام‌سازی دستی</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                className="a-btn a-btn--secondary"
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
                className="a-btn a-btn--primary"
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
                className="a-btn a-btn--secondary"
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
                className="a-btn a-btn--secondary"
                onClick={async () => {
                  try {
                    const res = await api.get<{ ok: boolean; crm: { reachable: boolean; baseUrl: string }; sync: { enabled: boolean; debounceMs: number }; local: { activeUsers: number; totalOrders: number; activeProducts: number } }>('/crm/stats');
                    const { crm, local } = res;
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

            <p className="a-note">
              <strong>نکته:</strong> تغییرات تنظیمات پس از ذخیره تنظیمات عمومی اعمال می‌شود. برای تست اتصال ابتدا تنظیمات را ذخیره کنید سپس دکمه «بررسی اتصال» را بزنید.
            </p>
            <p className="a-note">
              دکمه‌های «همگام‌سازی دستی» مستقیماً API را صدا می‌زنند و نتیجه را به صورت توست نمایش می‌دهند.
            </p>
          </section>
        </div>
      )}

      {activeTab === 'logs' && (
        <section className="a-card a-card--flush a-fade">
          <div className="a-card-head">
            <h3 className="a-card-title">تاریخچه تغییرات مدیریت (Audit Log)</h3>
          </div>

          <div className="a-table-wrap">
            <table className="a-table">
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
                    <td colSpan={4} className="a-empty">
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