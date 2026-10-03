import { useEffect, useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { ImagePicker } from '../components/ImagePicker';
import { PaymentMethodsSettings } from '../components/PaymentMethodsSettings';

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

interface TelegramGroup {
  id: string;
  name: string;
  chatId: string;
  enabled: boolean;
  messageThreadId?: number;
}

interface AttributionChannel {
  id: string;
  label: string;
  color: string;
}

const DEFAULT_ATTRIBUTION_CHANNELS: AttributionChannel[] = [
  { id: 'google', label: 'گوگل و موتورهای جستجو', color: '#34d399' },
  { id: 'instagram', label: 'اینستاگرام', color: '#22d3ee' },
  { id: 'telegram', label: 'تلگرام', color: '#38bdf8' },
  { id: 'whatsapp', label: 'واتساپ', color: '#4ade80' },
  { id: 'eitaa', label: 'ایتا', color: '#f59e0b' },
  { id: 'direct', label: 'ورود مستقیم / نامشخص', color: '#94a3b8' },
];

type TelegramEvent =
  | 'order.created'
  | 'order.status_changed'
  | 'payment.paid'
  | 'payment.failed'
  | 'payment.info_submitted'
  | 'user.registered'
  | 'user.profile_updated'
  | 'user.status_changed'
  | 'credit.application_submitted'
  | 'credit.application_status_changed'
  | 'credit.cheque_submitted'
  | 'credit.cheque_status_changed';

const TELEGRAM_EVENT_LABELS: Record<TelegramEvent, string> = {
  'order.created': 'سفارش جدید',
  'order.status_changed': 'تغییر وضعیت سفارش',
  'payment.paid': 'پرداخت موفق',
  'payment.failed': 'پرداخت ناموفق',
  'payment.info_submitted': 'ثبت اطلاعات پرداخت دستی',
  'user.registered': 'ثبت‌نام کاربر جدید',
  'user.profile_updated': 'تکمیل / ویرایش پروفایل',
  'user.status_changed': 'تغییر وضعیت کاربر',
  'credit.application_submitted': 'درخواست اعتبار جدید',
  'credit.application_status_changed': 'تغییر وضعیت اعتبار',
  'credit.cheque_submitted': 'چک جدید',
  'credit.cheque_status_changed': 'تغییر وضعیت چک',
};

function parseJsonSetting<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
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
  const [activeTab, setActiveTab] = useState<'general' | 'payment' | 'wallet' | 'telegram' | 'arvan' | 'tools' | 'logs' | 'crm' | 'advanced-sync'>('general');
  const [syncProgress, setSyncProgress] = useState<Record<string, { current: number; total: number; label: string; done: boolean; error: boolean }>>({});
  const syncRaf = useRef<Record<string, number>>({});
  const syncStart = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      Object.values(syncRaf.current).forEach((raf) => cancelAnimationFrame(raf));
    };
  }, []);

  function startSync(
    key: string,
    label: string,
    total: number,
    apiCall: () => Promise<{ pushed?: number; synced?: number; errors?: number; errorDetails?: string[]; ok?: boolean }>,
  ) {
    // cancel previous
    if (syncRaf.current[key]) cancelAnimationFrame(syncRaf.current[key]);
    setSyncProgress((prev) => ({ ...prev, [key]: { current: 0, total, label, done: false, error: false } }));
    const t0 = performance.now();
    syncStart.current[key] = t0;
    function tick(now: number) {
      const elapsed = now - t0;
      const progress = Math.min(elapsed / 1200, 1);
      const eased = progress * (2 - progress);
      const current = Math.round(eased * total);
      setSyncProgress((prev) => ({ ...prev, [key]: { current, total, label, done: false, error: false } }));
      if (progress < 1) {
        syncRaf.current[key] = requestAnimationFrame(tick);
      } else {
        apiCall()
          .then((res) => {
            const final = res?.pushed ?? res?.synced ?? total;
            setSyncProgress((prev) => ({ ...prev, [key]: { current: final, total, label: 'تکمیل شد', done: true, error: false } }));
            setTimeout(() => setSyncProgress((prev) => { const n = { ...prev }; delete n[key]; return n; }), 2500);
          })
          .catch(() => {
            setSyncProgress((prev) => ({ ...prev, [key]: { current: 0, total, label: 'خطا', done: true, error: true } }));
            setTimeout(() => setSyncProgress((prev) => { const n = { ...prev }; delete n[key]; return n; }), 2500);
          });
      }
    }
    syncRaf.current[key] = requestAnimationFrame(tick);
  }

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

  const knownKeys = new Set<string>([
    ...KNOWN_SETTINGS.map((s) => s.key),
    'payment_methods',
    'WALLET_ENABLED',
    'WALLET_ORDER_PAYMENT_ENABLED',
    'WALLET_MIN_TOPUP',
    'WALLET_MAX_TOPUP',
    'TELEGRAM_ENABLED',
    'private_TELEGRAM_BOT_TOKEN',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_PROXY_URL',
    'TELEGRAM_GROUPS',
    'TELEGRAM_ROUTES',
    'ARVAN_CDN_DOMAIN',
    'ARVAN_CDN_API_BASE',
    'private_ARVAN_API_KEY',
    'private_ARVAN_SECRET_KEY',
    'ARVAN_API_KEY',
    'ARVAN_SECRET_KEY',
    'ATTRIBUTION_CHANNELS',
  ]);
  const extraKeys = Object.keys(form).filter((k) => !knownKeys.has(k)).sort();

  const telegramGroups = parseJsonSetting<TelegramGroup[]>(form.TELEGRAM_GROUPS, []);
  const telegramRoutes = parseJsonSetting<Partial<Record<TelegramEvent, string[]>>>(form.TELEGRAM_ROUTES, {});
  const attributionChannels = parseJsonSetting<AttributionChannel[]>(form.ATTRIBUTION_CHANNELS, DEFAULT_ATTRIBUTION_CHANNELS);

  const updateTelegramGroups = (groups: TelegramGroup[]) => {
    setForm((current) => ({ ...current, TELEGRAM_GROUPS: JSON.stringify(groups) }));
  };

  const updateTelegramRoutes = (routes: Partial<Record<TelegramEvent, string[]>>) => {
    setForm((current) => ({ ...current, TELEGRAM_ROUTES: JSON.stringify(routes) }));
  };

  const updateAttributionChannels = (channels: AttributionChannel[]) => {
    setForm((current) => ({ ...current, ATTRIBUTION_CHANNELS: JSON.stringify(channels) }));
  };

  const TABS: { id: 'general' | 'payment' | 'wallet' | 'telegram' | 'arvan' | 'tools' | 'crm' | 'logs' | 'advanced-sync'; label: string }[] = [
    { id: 'general', label: 'تنظیمات عمومی' },
    { id: 'payment', label: '💳 روش‌های پرداخت' },
    { id: 'wallet', label: 'کیف پول' },
    { id: 'telegram', label: 'ربات تلگرام' },
    { id: 'arvan', label: 'تحلیل اروان کلاد' },
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

      {activeTab === 'payment' && (
        <PaymentMethodsSettings
          value={form.payment_methods}
          onChange={(newValue) => setForm({ ...form, payment_methods: newValue })}
          onSave={() => save.mutate(form)}
          isSaving={save.isPending}
        />
      )}

      {activeTab === 'wallet' && (
        <section className="a-card a-fade">
          <div className="a-card-head"><div><h3 className="a-card-title">تنظیمات کیف پول</h3><p className="a-card-subtitle">محدوده شارژ و امکان پرداخت سفارش با موجودی</p></div></div>
          <div className="a-form-grid a-cols--2">
            <div className="a-field"><label className="a-label">فعال بودن کیف پول</label><select className="a-select" value={form.WALLET_ENABLED ?? 'true'} onChange={e=>setForm({...form,WALLET_ENABLED:e.target.value})}><option value="true">فعال</option><option value="false">غیرفعال</option></select></div>
            <div className="a-field"><label className="a-label">پرداخت سفارش از کیف پول</label><select className="a-select" value={form.WALLET_ORDER_PAYMENT_ENABLED ?? 'true'} onChange={e=>setForm({...form,WALLET_ORDER_PAYMENT_ENABLED:e.target.value})}><option value="true">فعال</option><option value="false">غیرفعال</option></select></div>
            <div className="a-field"><label className="a-label">حداقل شارژ (تومان)</label><input className="a-input a-ltr" type="number" value={form.WALLET_MIN_TOPUP ?? '50000'} onChange={e=>setForm({...form,WALLET_MIN_TOPUP:e.target.value})}/></div>
            <div className="a-field"><label className="a-label">حداکثر شارژ (تومان)</label><input className="a-input a-ltr" type="number" value={form.WALLET_MAX_TOPUP ?? '100000000'} onChange={e=>setForm({...form,WALLET_MAX_TOPUP:e.target.value})}/></div>
          </div>
          <div className="mt-5"><button className="a-btn a-btn--primary" disabled={save.isPending} onClick={()=>save.mutate(form)}>ذخیره تنظیمات کیف پول</button></div>
        </section>
      )}

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

      {activeTab === 'telegram' && (
        <div className="a-page-stack a-fade">
          <section className="a-card">
            <div className="a-card-head a-card-head--split">
              <div>
                <h3 className="a-card-title">اتصال ربات تلگرام</h3>
                <p className="a-card-desc">توکن BotFather، پروکسی SOCKS اختیاری و مقصدهای اعلان را مدیریت کنید.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.TELEGRAM_ENABLED === 'true'}
                className="a-switch"
                onClick={() => setForm({ ...form, TELEGRAM_ENABLED: form.TELEGRAM_ENABLED === 'true' ? 'false' : 'true' })}
              />
            </div>
            <div className="a-form-grid a-cols--2">
              <div className="a-field">
                <label className="a-label">توکن ربات</label>
                <input
                  className="a-input a-ltr"
                  dir="ltr"
                  type="password"
                  placeholder="123456:ABC..."
                  autoComplete="new-password"
                  value={form.private_TELEGRAM_BOT_TOKEN ?? form.TELEGRAM_BOT_TOKEN ?? ''}
                  onChange={(e) => setForm({ ...form, private_TELEGRAM_BOT_TOKEN: e.target.value })}
                />
              </div>
              <div className="a-field">
                <label className="a-label">پروکسی SOCKS (اختیاری)</label>
                <input
                  className="a-input a-ltr"
                  dir="ltr"
                  placeholder="socks5h://user:pass@127.0.0.1:1080"
                  value={form.TELEGRAM_PROXY_URL ?? ''}
                  onChange={(e) => setForm({ ...form, TELEGRAM_PROXY_URL: e.target.value })}
                />
              </div>
            </div>
            <p className="a-note">ربات را به هر گروه اضافه و اجازه ارسال پیام بدهید. شناسه گروه معمولاً عددی منفی مانند <code>-1001234567890</code> است.</p>
          </section>

          <section className="a-card">
            <div className="a-card-head a-card-head--split">
              <div>
                <h3 className="a-card-title">گروه‌های مقصد</h3>
                <p className="a-card-desc">هر تعداد گروه یا سوپرگروه می‌توانید تعریف کنید.</p>
              </div>
              <button
                type="button"
                className="a-btn a-btn--secondary a-btn--xs"
                onClick={() => updateTelegramGroups([...telegramGroups, { id: `group-${Date.now()}`, name: 'گروه جدید', chatId: '', enabled: true }])}
              >
                + افزودن گروه
              </button>
            </div>

            <div className="a-page-stack">
              {telegramGroups.map((group, index) => (
                <div className="a-card" key={group.id}>
                  <div className="a-form-grid a-cols--2">
                    <div className="a-field">
                      <label className="a-label">نام نمایشی</label>
                      <input className="a-input" value={group.name} onChange={(e) => {
                        const next = [...telegramGroups];
                        next[index] = { ...group, name: e.target.value };
                        updateTelegramGroups(next);
                      }} />
                    </div>
                    <div className="a-field">
                      <label className="a-label">Chat ID</label>
                      <input className="a-input a-ltr" dir="ltr" placeholder="-1001234567890" value={group.chatId} onChange={(e) => {
                        const next = [...telegramGroups];
                        next[index] = { ...group, chatId: e.target.value };
                        updateTelegramGroups(next);
                      }} />
                    </div>
                    <div className="a-field">
                      <label className="a-label">Topic ID (اختیاری)</label>
                      <input className="a-input a-ltr" dir="ltr" type="number" value={group.messageThreadId ?? ''} onChange={(e) => {
                        const next = [...telegramGroups];
                        next[index] = { ...group, messageThreadId: e.target.value ? Number(e.target.value) : undefined };
                        updateTelegramGroups(next);
                      }} />
                    </div>
                    <div className="a-field">
                      <label className="a-label">عملیات</label>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={`a-btn a-btn--xs ${group.enabled ? 'a-btn--primary' : 'a-btn--secondary'}`} onClick={() => {
                          const next = [...telegramGroups];
                          next[index] = { ...group, enabled: !group.enabled };
                          updateTelegramGroups(next);
                        }}>{group.enabled ? 'فعال' : 'غیرفعال'}</button>
                        <button type="button" className="a-btn a-btn--secondary a-btn--xs" onClick={async () => {
                          try {
                            await save.mutateAsync(form);
                            const res = await api.post<{ message: string }>('/admin/telegram/test', { groupId: group.id });
                            toast.ok(res.message);
                          } catch (err) {
                            toast.error((err as Error).message);
                          }
                        }}>ذخیره و تست</button>
                        <button type="button" className="a-btn a-btn--danger a-btn--xs" onClick={() => {
                          updateTelegramGroups(telegramGroups.filter((item) => item.id !== group.id));
                          const nextRoutes = { ...telegramRoutes };
                          (Object.keys(nextRoutes) as TelegramEvent[]).forEach((event) => {
                            nextRoutes[event] = nextRoutes[event]?.filter((id) => id !== group.id);
                          });
                          updateTelegramRoutes(nextRoutes);
                        }}>حذف</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {telegramGroups.length === 0 && <p className="a-note">هنوز گروهی تعریف نشده است.</p>}
            </div>
          </section>

          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">مسیریابی اعلان‌ها</h3>
              <p className="a-card-desc">برای هر نوع اعلان، یک یا چند گروه را انتخاب کنید.</p>
            </div>
            <div className="a-table-wrap">
              <table className="a-table">
                <thead><tr><th>اعلان</th>{telegramGroups.map((group) => <th key={group.id}>{group.name}</th>)}</tr></thead>
                <tbody>
                  {(Object.keys(TELEGRAM_EVENT_LABELS) as TelegramEvent[]).map((event) => (
                    <tr key={event}>
                      <td>{TELEGRAM_EVENT_LABELS[event]}</td>
                      {telegramGroups.map((group) => {
                        const checked = (telegramRoutes[event] ?? []).includes(group.id);
                        return <td key={group.id}><input type="checkbox" checked={checked} onChange={() => {
                          const ids = new Set(telegramRoutes[event] ?? []);
                          if (checked) ids.delete(group.id); else ids.add(group.id);
                          updateTelegramRoutes({ ...telegramRoutes, [event]: [...ids] });
                        }} /></td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'arvan' && (
        <div className="a-page-stack a-fade">
          <section className="a-card">
            <div className="a-card-head a-card-head--split">
              <div>
                <h3 className="a-card-title">اتصال تحلیل کاربران به اروان کلاد</h3>
                <p className="a-card-desc">آمار بازدیدکنندگان و مصرف CDN مستقیماً از API نسخه ۴ اروان دریافت می‌شود.</p>
              </div>
              <span className="a-badge a-badge--brand">CDN API 4.0</span>
            </div>

            <div className="a-form-grid a-cols--2">
              <div className="a-field">
                <label className="a-label">دامنه متصل به CDN</label>
                <input
                  className="a-input a-ltr"
                  dir="ltr"
                  placeholder="tamasmarket.com"
                  value={form.ARVAN_CDN_DOMAIN ?? form.custom_domain ?? ''}
                  onChange={(e) => setForm({ ...form, ARVAN_CDN_DOMAIN: e.target.value })}
                />
              </div>
              <div className="a-field">
                <label className="a-label">آدرس API</label>
                <input
                  className="a-input a-ltr"
                  dir="ltr"
                  placeholder="https://napi.arvancloud.ir/cdn/4.0"
                  value={form.ARVAN_CDN_API_BASE ?? 'https://napi.arvancloud.ir/cdn/4.0'}
                  onChange={(e) => setForm({ ...form, ARVAN_CDN_API_BASE: e.target.value })}
                />
              </div>
              <div className="a-field">
                <label className="a-label">API Key</label>
                <input
                  className="a-input a-ltr"
                  dir="ltr"
                  type="password"
                  autoComplete="new-password"
                  placeholder="کلید ماشین‌کاربر اروان"
                  value={form.private_ARVAN_API_KEY ?? form.ARVAN_API_KEY ?? ''}
                  onChange={(e) => setForm({ ...form, private_ARVAN_API_KEY: e.target.value })}
                />
              </div>
              <div className="a-field">
                <label className="a-label">Secret Key (در صورت وجود)</label>
                <input
                  className="a-input a-ltr"
                  dir="ltr"
                  type="password"
                  autoComplete="new-password"
                  placeholder="اختیاری"
                  value={form.private_ARVAN_SECRET_KEY ?? form.ARVAN_SECRET_KEY ?? ''}
                  onChange={(e) => setForm({ ...form, private_ARVAN_SECRET_KEY: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="a-btn a-btn--primary"
                disabled={save.isPending}
                onClick={async () => {
                  try {
                    await save.mutateAsync(form);
                    const result = await api.post<{ message: string }>('/admin/analytics/arvan/test');
                    toast.ok(result.message);
                    void qc.invalidateQueries({ queryKey: ['admin', 'arvan-analytics'] });
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                {save.isPending ? 'در حال بررسی...' : 'ذخیره و بررسی اتصال'}
              </button>
              <p className="a-note m-0">کلیدها فقط توسط بک‌اند استفاده می‌شوند و در درخواست‌های مستقیم مرورگر به اروان ارسال نمی‌شوند.</p>
            </div>
          </section>

          <section className="a-card">
            <h3 className="a-card-title">دسترسی لازم در اروان</h3>
            <p className="a-card-desc mt-2 leading-7">
              برای ماشین‌کاربر، دسترسی خواندن دامنه و گزارش‌های CDN را فعال کنید. API رسمی CDN برای هویت‌سنجی یک مقدار
              Authorization می‌گیرد؛ اگر پنل شما یک جفت Key/Secret نمایش می‌دهد، هر دو را وارد کنید تا اتصال به‌صورت خودکار بررسی شود.
            </p>
          </section>

          <section className="a-card">
            <div className="a-card-head a-card-head--split">
              <div>
                <h3 className="a-card-title">لینک‌های قابل رهگیری جذب مشتری</h3>
                <p className="a-card-desc">برای هر کانال یک لینک اختصاصی بسازید؛ سفارش‌های ورودی با همان منبع در داشبورد ثبت می‌شوند.</p>
              </div>
              <button
                type="button"
                className="a-btn a-btn--secondary a-btn--xs"
                onClick={() => updateAttributionChannels([...attributionChannels, { id: `source-${Date.now()}`, label: 'منبع جدید', color: '#a78bfa' }])}
              >
                + افزودن منبع
              </button>
            </div>

            <div className="a-page-stack">
              {attributionChannels.map((channel, index) => {
                const origin = typeof window === 'undefined' ? 'https://tamasmarket.com' : window.location.origin;
                const trackingUrl = `${origin}/?utm_source=${encodeURIComponent(channel.id)}&utm_medium=share`;
                return (
                  <div className="a-card attribution-channel-row" key={`${channel.id}-${index}`}>
                    <div className="a-form-grid a-cols--2">
                      <div className="a-field">
                        <label className="a-label">نام نمایشی</label>
                        <input className="a-input" value={channel.label} onChange={(event) => {
                          const next = [...attributionChannels];
                          next[index] = { ...channel, label: event.target.value };
                          updateAttributionChannels(next);
                        }} />
                      </div>
                      <div className="a-field">
                        <label className="a-label">مقدار utm_source</label>
                        <input className="a-input a-ltr" dir="ltr" value={channel.id} onChange={(event) => {
                          const next = [...attributionChannels];
                          next[index] = { ...channel, id: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') };
                          updateAttributionChannels(next);
                        }} />
                      </div>
                      <div className="a-field sm:col-span-2">
                        <label className="a-label">لینک اشتراک‌گذاری</label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input className="a-input a-ltr a-grow" dir="ltr" readOnly value={trackingUrl} />
                          <input type="color" className="attribution-color" value={channel.color} aria-label="رنگ نمودار" onChange={(event) => {
                            const next = [...attributionChannels];
                            next[index] = { ...channel, color: event.target.value };
                            updateAttributionChannels(next);
                          }} />
                          <button type="button" className="a-btn a-btn--secondary a-btn--xs" onClick={async () => {
                            await navigator.clipboard.writeText(trackingUrl);
                            toast.ok('لینک رهگیری کپی شد.');
                          }}>کپی لینک</button>
                          {channel.id !== 'direct' && <button type="button" className="a-btn a-btn--danger a-btn--xs" onClick={() => updateAttributionChannels(attributionChannels.filter((_, itemIndex) => itemIndex !== index))}>حذف</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="a-note">پارامترهای استاندارد <code>utm_source</code>، <code>utm_medium</code> و <code>utm_campaign</code> پشتیبانی می‌شوند و انتساب اولین ورودی تا ۹۰ روز نگهداری می‌شود.</p>
          </section>
        </div>
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
              <button
                type="button"
                role="switch"
                aria-checked={form.CRM_SYNC_ENABLED === 'true'}
                className="a-switch"
                onClick={() => setForm({ ...form, CRM_SYNC_ENABLED: form.CRM_SYNC_ENABLED === 'true' ? 'false' : 'true' })}
              />
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

      {activeTab === 'advanced-sync' && (
        <div className="a-page-stack a-fade">
          {/* Live sync progress bars */}
          {Object.entries(syncProgress).map(([key, p]) => (
            <section className="a-card" key={key}>
              <div className="a-card-head a-card-head--split">
                <div>
                  <h3 className="a-card-title">{p.label}</h3>
                  <p className="a-card-desc">در حال همگام‌سازی با CRM</p>
                </div>
                <span className={`a-badge ${p.error ? 'a-badge--danger' : p.done ? 'a-badge--success' : 'a-badge--info'}`}>
                  {p.error ? 'خطا' : p.done ? 'تکمیل شد' : 'در حال برنامه‌ریزی'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-0 rounded-full transition-all duration-200 ${p.error ? 'bg-red-400' : p.done ? 'bg-emerald-400' : 'bg-blue-500'}`}
                    style={{ width: `${Math.min(100, Math.round((p.current / (p.total || 1)) * 100))}%` }}
                  />
                </div>
                <span className="a-ltr font-mono text-sm font-bold w-20 text-right">
                  {p.current}/{p.total}
                </span>
                {!p.done && (
                  <svg className="h-4 w-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
              </div>
            </section>
          ))}

          {/* CRM Connection Status */}
          <section className="a-card">
            <div className="a-card-head a-card-head--split">
              <div>
                <h3 className="a-card-title">وضعیت اتصال CRM</h3>
                <p className="a-card-desc">مشاهده وضعیت لحظه‌ای اتصال و تنظیمات همگام‌سازی</p>
              </div>
              <span className={`a-badge ${crmStats.data?.crm.reachable ? 'a-badge--success' : 'a-badge--danger'}`}>
                {crmStats.data?.crm.reachable ? 'متصل' : 'قطع'}
              </span>
            </div>

            {crmStats.isLoading ? (
              <div className="a-skeleton a-skeleton--text" />
            ) : crmStats.error ? (
              <div className="a-alert a-alert--error">
                خطا در بارگذاری وضعیت: {crmStats.error.message}
              </div>
            ) : crmStats.data && (
              <div className="a-grid a-grid--4 a-gap--4">
                <div className="a-stat-card">
                  <div className="a-stat-label">آدرس CRM</div>
                  <div className="a-stat-value a-ltr a-break-all">{crmStats.data.crm.baseUrl}</div>
                </div>
                <div className="a-stat-card">
                  <div className="a-stat-label">همگام‌سازی خودکار</div>
                  <div className="a-stat-value">
                    <span className={`a-badge ${crmStats.data.crm.syncEnabled ? 'a-badge--success' : 'a-badge--warning'}`}>
                      {crmStats.data.crm.syncEnabled ? 'فعال' : 'غیرفعال'}
                    </span>
                  </div>
                </div>
                <div className="a-stat-card">
                  <div className="a-stat-label">کاربران فعال</div>
                  <div className="a-stat-value">{crmStats.data.local.activeUsers.toLocaleString('fa-IR')}</div>
                </div>
                <div className="a-stat-card">
                  <div className="a-stat-label">کل سفارش‌ها</div>
                  <div className="a-stat-value">{crmStats.data.local.totalOrders.toLocaleString('fa-IR')}</div>
                </div>
                <div className="a-stat-card">
                  <div className="a-stat-label">محصولات فعال</div>
                  <div className="a-stat-value">{crmStats.data.local.activeProducts.toLocaleString('fa-IR')}</div>
                </div>
                <div className="a-stat-card">
                  <div className="a-stat-label">کل همگام‌سازی شده</div>
                  <div className="a-stat-value">{crmStats.data.syncStats?.totalSynced?.toLocaleString('fa-IR') ?? 0}</div>
                </div>
                <div className="a-stat-card">
                  <div className="a-stat-label">خطاهای همگام‌سازی</div>
                  <div className="a-stat-value text-red-400">{crmStats.data.syncStats?.totalErrors?.toLocaleString('fa-IR') ?? 0}</div>
                </div>
                <div className="a-stat-card">
                  <div className="a-stat-label">آخرین همگام‌سازی</div>
                  <div className="a-stat-value a-ltr">
                    {crmStats.data.syncStats?.lastSyncAt
                      ? new Date(crmStats.data.syncStats.lastSyncAt).toLocaleString('fa-IR')
                      : '—'}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Product Sync Detail Table */}
          <section className="a-card">
            <div className="a-card-head a-card-head--split">
              <div>
                <h3 className="a-card-title">جزئیات همگام‌سازی محصولات</h3>
                <p className="a-card-desc">مشاهده وضعیت هر محصول، پارامترهای سینک شده و خطاها</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="a-btn a-btn--secondary"
                  onClick={() => syncProducts.refetch()}
                  disabled={syncProducts.isFetching}
                >
                  {syncProducts.isFetching ? 'بارگذاری...' : 'بازآوری'}
                </button>
                <button
                  type="button"
                  className="a-btn a-btn--primary"
                  onClick={async () => {
                    try {
                      const res = await api.post<{ ok: boolean; pushed: number; errors: number; errorDetails: string[] }>('/crm/sync/products/push');
                      if (res.ok) toast.ok(`${res.pushed} محصول همگام‌سازی شد. خطاها: ${res.errors}`);
                      else toast.error(`خطاها: ${res.errorDetails?.slice(0, 3).join(', ')}`);
                      syncProducts.refetch();
                    } catch (err: any) {
                      toast.error(err.message || 'خطa در همگام‌سازی محصولات');
                    }
                  }}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  همگام‌سازی همه
                </button>
              </div>
            </div>

            {syncProducts.isLoading ? (
              <div className="a-skeleton a-skeleton--text" />
            ) : syncProducts.error ? (
              <div className="a-alert a-alert--error">
                خطa در بارگذاری جزئیات محصولات: {syncProducts.error.message}
              </div>
            ) : syncProducts.data?.items && syncProducts.data.items.length > 0 ? (
              <div className="a-table-wrap">
                <table className="a-table">
                  <thead>
                    <tr>
                      <th>تصویر</th>
                      <th>محصول / SKU</th>
                      <th>قیمت</th>
                      <th>موجودی</th>
                      <th>وضعیت CRM</th>
                      <th>ID در CRM</th>
                      <th>آخرین همگام‌سازی</th>
                      <th>خطa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncProducts.data.items.map((p) => (
                      <tr key={p.productId} className={p.syncStatus === 'error' ? 'a-row--error' : ''}>
                        <td>
                          {p.imageUrl && (
                            <img src={p.imageUrl} alt={p.title} className="w-12 h-12 object-cover rounded" />
                          )}
                        </td>
                        <td>
                          <div className="font-medium">{p.title}</div>
                          <div className="text-xs text-slate-400 a-ltr">{p.sku ?? '—'}</div>
                          <div className="text-xs text-slate-400 a-ltr">ID: {p.productId}</div>
                        </td>
                        <td className="a-ltr font-mono">{p.price.toLocaleString('fa-IR')}</td>
                        <td>
                          <div className="a-ltr font-mono">
                            {p.kermanStock !== undefined || p.tehranStock !== undefined
                              ? `کرمان: ${p.kermanStock ?? 0} | تهران: ${p.tehranStock ?? 0} | کل: ${p.stock}`
                              : `کل: ${p.stock}`}
                          </div>
                        </td>
                        <td>
                          <span className={`a-badge ${
                            p.syncStatus === 'synced' ? 'a-badge--success' :
                            p.syncStatus === 'pending' ? 'a-badge--warning' :
                            p.syncStatus === 'error' ? 'a-badge--danger' :
                            'a-badge--muted'
                          }`}>
                            {p.syncStatus === 'synced' ? 'همگام‌سازی شده' :
                             p.syncStatus === 'pending' ? 'در صف' :
                             p.syncStatus === 'error' ? 'خطa' :
                             'هرگز همگام‌سازی نشده'}
                          </span>
                        </td>
                        <td className="a-ltr font-mono">{p.crmId ?? '—'}</td>
                        <td className="text-xs text-slate-400">
                          {p.lastSyncedAt
                            ? new Date(p.lastSyncedAt).toLocaleString('fa-IR')
                            : '—'}
                        </td>
                        <td className="text-red-400 text-xs max-w-xs truncate block" title={p.syncError}>
                          {p.syncError ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="a-note">هیچ محصولی برای نمایش وجود ندارد.</p>
            )}
          </section>

          {/* Sync Logs */}
          <section className="a-card">
            <div className="a-card-head a-card-head--split">
              <div>
                <h3 className="a-card-title">لاگ همگام‌سازی</h3>
                <p className="a-card-desc">تاریخچه کامل عملیات همگام‌سازی با جزئیات درخواست و پاسخ</p>
              </div>
              <button
                type="button"
                className="a-btn a-btn--secondary"
                onClick={() => syncLogs.refetch()}
                disabled={syncLogs.isFetching}
              >
                {syncLogs.isFetching ? 'بارگذاری...' : 'بازآوری'}
              </button>
            </div>

            {syncLogs.isLoading ? (
              <div className="a-skeleton a-skeleton--text" />
            ) : syncLogs.error ? (
              <div className="a-alert a-alert--error">
                خطa در بارگذاری لاگ‌ها: {syncLogs.error.message}
              </div>
            ) : syncLogs.data?.items && syncLogs.data.items.length > 0 ? (
              <div className="a-table-wrap">
                <table className="a-table">
                  <thead>
                    <tr>
                      <th>زمان</th>
                      <th>موجودیت</th>
                      <th>عملیات</th>
                      <th>شناسه</th>
                      <th>وضعیت</th>
                      <th>ID در CRM</th>
                      <th>جزئیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncLogs.data.items.slice(0, 100).map((log) => (
                      <tr key={log.id} className={log.status === 'error' ? 'a-row--error' : ''}>
                        <td className="text-xs text-slate-400">
                          {new Date(log.createdAt).toLocaleString('fa-IR')}
                        </td>
                        <td className="font-mono text-xs">
                          {log.entity === 'order' ? 'سفارش' :
                           log.entity === 'product' ? 'محصول' :
                           log.entity === 'person' ? 'مشتری' : 'چت'}
                        </td>
                        <td>
                          <span className={`a-badge ${
                            log.action === 'create' ? 'a-badge--success' :
                            log.action === 'update' ? 'a-badge--info' :
                            log.action === 'delete' ? 'a-badge--danger' :
                            'a-badge--muted'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="a-ltr font-mono text-xs">{log.entityKey}</td>
                        <td>
                          <span className={`a-badge ${
                            log.status === 'success' ? 'a-badge--success' :
                            log.status === 'error' ? 'a-badge--danger' :
                            log.status === 'pending' ? 'a-badge--warning' :
                            'a-badge--muted'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="a-ltr font-mono text-xs">{log.remoteId ?? '—'}</td>
                        <td className="a-ltr text-xs max-w-md truncate block" title={log.error || JSON.stringify(log.response?.detail ?? log.response)}>
                          {log.error || (log.response ? 'مشاهده پاسخ' : '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="a-note">هنوز لاگی ثبت نشده است.</p>
            )}
          </section>

          {/* Manual Sync Actions */}
          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">عملیات همگام‌سازی دستی</h3>
            </div>
            <p className="a-note mb-4">
              این عملیات مستقیمااً API را صدا می‌زنند و نتیجه را در جدول لاگ‌ها و آمارها منعکس می‌کنند.
            </p>

            <div className="a-grid a-grid--2 a-gap--4">
              <button
                              type="button"
                              className="a-btn a-btn--secondary a-btn--block"
                              onClick={() => {
                                const total = crmStats.data?.local.activeProducts ?? 10;
                                startSync('products-push', 'همگام‌سازی محصولات', total, async () => {
                                  const res = await api.post<{ ok: boolean; pushed: number; errors: number; errorDetails: string[] }>('/crm/sync/products/push');
                                  if (res.ok) toast.ok(`${res.pushed} محصول همگام‌سازی شد. خطاها: ${res.errors}`);
                                  else toast.error(`خطاها: ${res.errorDetails?.slice(0, 3).join(', ')}`);
                                  syncProducts.refetch();
                                  syncLogs.refetch();
                                  crmStats.refetch();
                                  return res;
                                });
                              }}
                            >
                              <div className="flex items-center justify-center gap-2">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>همگام‌سازی کامل محصولات</span>
                              </div>
                            </button>

              <button
                type="button"
                className="a-btn a-btn--secondary a-btn--block"
                onClick={() => {
                  const total = crmStats.data?.local.activeProducts ?? 10;
                  startSync('stock-sync', 'همگام‌سازی موجودی (کرمان/تهران)', total, async () => {
                    const res = await api.post<{ ok: boolean; synced: number; errors: number; errorDetails: string[] }>('/crm/sync/stock');
                    if (res.ok) toast.ok(`${res.synced} محصول Stok همگam‌سازی شد. خطاها: ${res.errors}`);
                    else toast.error(`خطاها: ${res.errorDetails?.slice(0, 3).join(', ')}`);
                    syncProducts.refetch();
                    syncLogs.refetch();
                    return res;
                  });
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>همگam‌سازی Stok (کرمان/تهران)</span>
                </div>
              </button>

              <button
                type="button"
                className="a-btn a-btn--secondary a-btn--block"
                onClick={() => {
                  const total = crmStats.data?.local.totalOrders ?? 10;
                  startSync('orders-sync', 'همگam‌سازی سفارش‌های جدید', total, async () => {
                    const res = await api.post<{ ok: boolean; pushed: number; errors: number; errorDetails: string[] }>('/crm/sync/orders');
                    if (res.ok) toast.ok(`${res.pushed} سفارش همگam‌سازی شد. خطاها: ${res.errors}`);
                    else toast.error(`خطاها: ${res.errorDetails?.slice(0, 3).join(', ')}`);
                    syncLogs.refetch();
                    crmStats.refetch();
                    return res;
                  });
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <span>همگam‌سازی سفارش‌های جدید</span>
                </div>
              </button>

              <button
                type="button"
                className="a-btn a-btn--secondary a-btn--block"
                onClick={() => {
                  const total = crmStats.data?.local.activeUsers ?? 10;
                  startSync('persons-sync', 'همگam‌سازی مشتریان', total, async () => {
                    const res = await api.post<{ ok: boolean; pushed: number; errors: number; errorDetails: string[] }>('/crm/sync/persons');
                    if (res.ok) toast.ok(`${res.pushed} مشتری همگam‌سازی شد. خطاها: ${res.errors}`);
                    else toast.error(`خطاها: ${res.errorDetails?.slice(0, 3).join(', ')}`);
                    syncLogs.refetch();
                    crmStats.refetch();
                    return res;
                  });
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9V6a2 2 0 00-2-2H8a2 2 0 00-2 2v3m8-6v12a2 2 0 01-2 2H8a2 2 0 01-2-2V9m8-6h-6" />
                  </svg>
                  <span>همگam‌سازی مشتریان</span>
                </div>
              </button>
            </div>
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
