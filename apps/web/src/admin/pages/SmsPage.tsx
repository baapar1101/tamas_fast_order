import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

interface SmsEventDef {
  /** Unique suffix used to build the enabled key: sms_enabled_<key>. */
  key: string;
  templateKey: string;
  title: string;
  desc: string;
  vars: string[];
  placeholder: string;
}

interface SmsProviderConfig {
  smsProvider: 'rastin' | 'payamresan' | 'melipayamak';
  firstFallback: 'none' | 'melipayamak';
  secondFallback: 'none' | 'smsir';
  rastinUsername: string;
  rastinPasswordSet: boolean;
  rastinSender: string;
  rastinUrl: string;
  payamresanApiKeySet: boolean;
  payamresanSender: string;
  payamresanBaseUrl: string;
  melipayamakUsername: string;
  melipayamakApiKeySet: boolean;
  melipayamakSender: string;
  melipayamakBaseUrl: string;
  melipayamakPatternBaseUrl: string;
  melipayamakOtpBodyId: string;
  smsirApiKeySet: boolean;
  smsirLineNumber: string;
  smsirBaseUrl: string;
  smsirOtpTemplateId: string;
  smsirOtpParameter: string;
}

const EMPTY_PROVIDER_CONFIG: SmsProviderConfig = {
  smsProvider: 'payamresan',
  firstFallback: 'melipayamak',
  secondFallback: 'smsir',
  rastinUsername: '',
  rastinPasswordSet: false,
  rastinSender: '',
  rastinUrl: 'https://www.rastinsms.com/APISend.aspx',
  payamresanApiKeySet: false,
  payamresanSender: '',
  payamresanBaseUrl: 'https://api.sms-webservice.com/api/V3',
  melipayamakUsername: '',
  melipayamakApiKeySet: false,
  melipayamakSender: '',
  melipayamakBaseUrl: 'https://rest.payamak-panel.com/api/SendSMS',
  melipayamakPatternBaseUrl: 'https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber',
  melipayamakOtpBodyId: '556182',
  smsirApiKeySet: false,
  smsirLineNumber: '',
  smsirBaseUrl: 'https://api.sms.ir',
  smsirOtpTemplateId: '',
  smsirOtpParameter: 'PARAMETER1',
};

const NEW_ORDER_EVENTS: SmsEventDef[] = [
  {
    key: 'order_new',
    templateKey: 'sms_template_order_new',
    title: 'ثبت سفارش',
    desc: 'همین که مشتری سفارش جدیدی ثبت می‌کند',
    vars: ['name', 'order_code'],
    placeholder: 'سلام {name} عزیز، سفارش شما با کد {order_code} با موفقیت ثبت شد.',
  },
  {
    key: 'payment_paid',
    templateKey: 'sms_template_payment_paid',
    title: 'پرداخت موفق سفارش',
    desc: 'هنگامی که مبلغ سفارش به صورت آنلاین پرداخت شود',
    vars: ['name', 'order_code'],
    placeholder: 'سلام {name}، پرداخت سفارش {order_code} با موفقیت انجام شد. متشکریم.',
  },
];

const STATUS_EVENTS: SmsEventDef[] = ORDER_STATUSES.map((status) => ({
  key: `order_${status}`,
  templateKey: `sms_template_order_${status}`,
  title: `وضعیت: ${ORDER_STATUS_LABELS[status]}`,
  desc: 'هنگامی که وضعیت سفارش توسط اپراتور تغییر کند',
  vars: ['name', 'order_code', 'status'],
  placeholder: 'سلام {name}، وضعیت سفارش {order_code} به «{status}» تغییر کرد.',
}));

const ENTRIES_EVENTS: SmsEventDef[] = [
  {
    key: 'user_approved',
    templateKey: 'sms_template_user_approved',
    title: 'تأیید حساب کاربری',
    desc: 'هنگامی که مدیر حساب مشتری را تأیید و فعال می‌کند',
    vars: [],
    placeholder: 'حساب کاربری شما در تماس مارکت تایید شد',
  },
  {
    key: 'otp',
    templateKey: 'sms_template_otp',
    title: 'کد تایید ورود',
    desc: 'کد یکبارمصرف برای ورود، ثبت‌نام و بازنشانی رمز',
    vars: ['code'],
    placeholder: 'کد تایید شما در تماس مارکت: {code}',
  },
];

const ALL_EVENTS = [...NEW_ORDER_EVENTS, ...STATUS_EVENTS, ...ENTRIES_EVENTS];

const FALSY = new Set(['0', 'false', 'disabled', 'off', 'no']);

function enabledKeyFor(def: SmsEventDef): string {
  return `sms_enabled_${def.key}`;
}

function getInitialDrafts(): Record<string, string> {
  const initial: Record<string, string> = {};
  for (const def of ALL_EVENTS) {
    initial[def.templateKey] = def.placeholder;
  }
  return initial;
}

export function SmsPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [drafts, setDrafts] = useState<Record<string, string>>(getInitialDrafts);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [testPhone, setTestPhone] = useState('');
  const [providerDraft, setProviderDraft] = useState<SmsProviderConfig>(EMPTY_PROVIDER_CONFIG);
  const [secretDrafts, setSecretDrafts] = useState({
    rastinPassword: '',
    payamresanApiKey: '',
    melipayamakApiKey: '',
    smsirApiKey: '',
  });

  const settings = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<{ settings: Record<string, string> }>('/admin/settings'),
  });

  const providers = useQuery({
    queryKey: ['admin', 'sms', 'providers'],
    queryFn: () => api.get<{ config: SmsProviderConfig }>('/admin/sms/providers'),
  });

  useEffect(() => {
    if (providers.data?.config) setProviderDraft(providers.data.config);
  }, [providers.data]);

  // Sync the local editable state from the server once loaded (and after saves).
  useEffect(() => {
    const all = settings.data?.settings;
    if (!all) return;
    const nextText: Record<string, string> = {};
    const nextToggles: Record<string, boolean> = {};
    for (const def of ALL_EVENTS) {
      const serverVal = all[def.templateKey];
      nextText[def.templateKey] = serverVal && serverVal.trim() !== '' ? serverVal : def.placeholder;
      nextToggles[def.templateKey] = !FALSY.has((all[enabledKeyFor(def)] ?? '1').trim().toLowerCase());
    }
    setDrafts(nextText);
    setToggles(nextToggles);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {};
      for (const def of ALL_EVENTS) {
        payload[def.templateKey] = drafts[def.templateKey] ?? def.placeholder;
        payload[enabledKeyFor(def)] = toggles[def.templateKey] !== false ? '1' : '0';
      }
      return api.put<{ message: string }>('/admin/settings', payload);
    },
    onSuccess: (res) => {
      toast.ok(res.message ?? 'پیامک‌ها ذخیره شد.');
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const test = useMutation({
    mutationFn: ({ def, text }: { def: SmsEventDef; text: string }) =>
      api.post<{ ok: boolean }>('/admin/sms/test', {
        phone: testPhone.trim(),
        templateKey: def.templateKey,
        text,
      }),
    onSuccess: () => toast.ok(`پیامک تست به ${testPhone.trim()} ارسال شد.`),
    onError: (err: Error) => toast.error(err.message),
  });

  const saveProviders = useMutation({
    mutationFn: () => api.put<{ message: string; config: SmsProviderConfig }>('/admin/sms/providers', {
      ...providerDraft,
      ...Object.fromEntries(Object.entries(secretDrafts).filter(([, value]) => value.trim())),
    }),
    onSuccess: (res) => {
      toast.ok(res.message);
      setSecretDrafts({ rastinPassword: '', payamresanApiKey: '', melipayamakApiKey: '', smsirApiKey: '' });
      void qc.invalidateQueries({ queryKey: ['admin', 'sms', 'providers'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const testProvider = useMutation({
    mutationFn: (provider: 'rastin' | 'payamresan' | 'melipayamak' | 'melipayamak-otp' | 'smsir' | 'chain') =>
      api.post<{ ok: boolean; message: string }>('/admin/sms/providers/test', {
        phone: testPhone.trim(),
        provider,
      }),
    onSuccess: (res) => toast.ok(res.message),
    onError: (err: Error) => toast.error(err.message),
  });

  const updateProvider = <K extends keyof SmsProviderConfig>(key: K, value: SmsProviderConfig[K]) => {
    setProviderDraft((prev) => ({ ...prev, [key]: value }));
  };

  const providerTestButton = (provider: 'rastin' | 'payamresan' | 'melipayamak' | 'smsir') => (
    <button
      type="button"
      className="a-btn a-btn--secondary a-btn--xs"
      disabled={!testPhone.trim() || testProvider.isPending}
      onClick={() => testProvider.mutate(provider)}
    >
      تست مستقل
    </button>
  );

  const savedCount = useMemo(
    () => ALL_EVENTS.filter((def) => toggles[def.templateKey] !== false && (drafts[def.templateKey] ?? def.placeholder).trim()).length,
    [drafts, toggles],
  );

  const renderEvent = (def: SmsEventDef, first: boolean) => {
    const enabled = toggles[def.templateKey] !== false;
    const text = drafts[def.templateKey] ?? def.placeholder;
    return (
      <div key={def.templateKey} className={`space-y-3 py-4 ${first ? '' : 'border-t border-white/[0.06]'}`}>
        <div className="a-option-row">
          <div className="a-option-copy">
            <div className="a-option-title">{def.title}</div>
            <div className="a-option-desc">
              {def.desc}
              {def.vars.length > 0 && (
                <>
                  {' — متغیرها: '}
                  {def.vars.map((v) => (
                    <code key={v} className="mx-0.5 rounded bg-slate-800 px-1 py-0.5 text-[10px] text-emerald-300" dir="ltr">
                      {'{'}
                      {v}
                      {'}'}
                    </code>
                  ))}
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            className="a-switch"
            onClick={() => setToggles((prev) => ({ ...prev, [def.templateKey]: !enabled }))}
            aria-label={`فعال یا غیرفعال کردن ${def.title}`}
          />
        </div>

        <textarea
          className="a-textarea text-right"
          rows={2}
          dir="rtl"
          value={text}
          placeholder={def.placeholder}
          disabled={!enabled}
          onChange={(e) => setDrafts((prev) => ({ ...prev, [def.templateKey]: e.target.value }))}
        />

        <div className="flex items-center justify-between gap-3">
          <span className="a-note">
            {enabled ? (text.trim() ? 'الگوی ذخیره‌شده ارسال می‌شود.' : 'در صورت خالی بودن، پیامکی ارسال نمی‌شود.') : 'پیامک این رویداد غیرفعال است.'}
          </span>
          <button
            type="button"
            className="a-btn a-btn--secondary a-btn--xs"
            disabled={!enabled || !text.trim() || !testPhone.trim() || test.isPending}
            onClick={() => test.mutate({ def, text })}
          >
            {test.isPending ? 'در حال ارسال...' : 'ارسال تست'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="a-page a-fade">
      {/* Header */}
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">پیامک هوشمند</h2>
          <p className="a-subtitle">متن پیامک‌های خودکار در موقعیت‌های مختلف سفارش و ورود کاربران</p>
        </div>
        <div className="a-page-actions">
          <span className="a-badge a-badge--brand">{savedCount} پیامک فعال</span>
          <button
            type="button"
            className="a-btn a-btn--primary"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'در حال ذخیره...' : 'ذخیره همه پیامک‌ها'}
          </button>
        </div>
      </section>

      {/* SMS providers */}
      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">درگاه‌ها و ترتیب fallback</h3>
            <p className="a-card-desc">کلیدها هرگز از سرور به مرورگر برگردانده نمی‌شوند؛ کادر خالی یعنی کلید فعلی حفظ شود.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="a-btn a-btn--secondary"
              disabled={!testPhone.trim() || testProvider.isPending}
              onClick={() => testProvider.mutate('chain')}
            >
              تست زنجیره کامل
            </button>
            <button
              type="button"
              className="a-btn a-btn--primary"
              disabled={saveProviders.isPending}
              onClick={() => saveProviders.mutate()}
            >
              {saveProviders.isPending ? 'در حال ذخیره...' : 'ذخیره تنظیمات درگاه‌ها'}
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2 text-xs glass-text-t2">
            <span>درگاه اصلی</span>
            <select className="a-input w-full" value={providerDraft.smsProvider} onChange={(e) => updateProvider('smsProvider', e.target.value as SmsProviderConfig['smsProvider'])}>
              <option value="payamresan">پیام‌رسان</option>
              <option value="melipayamak">ملی‌پیامک</option>
              <option value="rastin">راستین</option>
            </select>
          </label>
          <label className="space-y-2 text-xs glass-text-t2">
            <span>fallback اول</span>
            <select className="a-input w-full" value={providerDraft.firstFallback} onChange={(e) => updateProvider('firstFallback', e.target.value as SmsProviderConfig['firstFallback'])}>
              <option value="melipayamak">ملی‌پیامک</option>
              <option value="none">غیرفعال</option>
            </select>
          </label>
          <label className="space-y-2 text-xs glass-text-t2">
            <span>fallback دوم</span>
            <select className="a-input w-full" value={providerDraft.secondFallback} onChange={(e) => updateProvider('secondFallback', e.target.value as SmsProviderConfig['secondFallback'])}>
              <option value="smsir">sms.ir</option>
              <option value="none">غیرفعال</option>
            </select>
          </label>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.08] p-4 space-y-3">
            <div className="flex items-center justify-between"><strong>پیام‌رسان</strong>{providerTestButton('payamresan')}</div>
            <input className="a-input w-full a-ltr" dir="ltr" value={providerDraft.payamresanSender} onChange={(e) => updateProvider('payamresanSender', e.target.value)} placeholder="شماره فرستنده" />
            <input className="a-input w-full a-ltr" dir="ltr" value={providerDraft.payamresanBaseUrl} onChange={(e) => updateProvider('payamresanBaseUrl', e.target.value)} placeholder="Base URL" />
            <input className="a-input w-full a-ltr" dir="ltr" type="password" value={secretDrafts.payamresanApiKey} onChange={(e) => setSecretDrafts((prev) => ({ ...prev, payamresanApiKey: e.target.value }))} placeholder={providerDraft.payamresanApiKeySet ? 'API Key تنظیم شده — برای تغییر مقدار جدید وارد کنید' : 'API Key'} autoComplete="new-password" />
          </div>

          <div className="rounded-2xl border border-white/[0.08] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>ملی‌پیامک</strong>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="a-btn a-btn--secondary a-btn--xs"
                  disabled={!testPhone.trim() || testProvider.isPending}
                  onClick={() => testProvider.mutate('melipayamak-otp')}
                >
                  تست الگوی OTP
                </button>
                {providerTestButton('melipayamak')}
              </div>
            </div>
            <input className="a-input w-full a-ltr" dir="ltr" value={providerDraft.melipayamakUsername} onChange={(e) => updateProvider('melipayamakUsername', e.target.value)} placeholder="نام کاربری" />
            <input className="a-input w-full a-ltr" dir="ltr" value={providerDraft.melipayamakSender} onChange={(e) => updateProvider('melipayamakSender', e.target.value)} placeholder="خط فرستنده" />
            <input className="a-input w-full a-ltr" dir="ltr" value={providerDraft.melipayamakBaseUrl} onChange={(e) => updateProvider('melipayamakBaseUrl', e.target.value)} placeholder="Base URL" />
            <input className="a-input w-full a-ltr" dir="ltr" value={providerDraft.melipayamakPatternBaseUrl} onChange={(e) => updateProvider('melipayamakPatternBaseUrl', e.target.value)} placeholder="Pattern Base URL" />
            <input className="a-input w-full a-ltr" dir="ltr" value={providerDraft.melipayamakOtpBodyId} onChange={(e) => updateProvider('melipayamakOtpBodyId', e.target.value)} placeholder="کد الگوی OTP" inputMode="numeric" />
            <input className="a-input w-full a-ltr" dir="ltr" type="password" value={secretDrafts.melipayamakApiKey} onChange={(e) => setSecretDrafts((prev) => ({ ...prev, melipayamakApiKey: e.target.value }))} placeholder={providerDraft.melipayamakApiKeySet ? 'API Key تنظیم شده — برای تغییر مقدار جدید وارد کنید' : 'API Key'} autoComplete="new-password" />
          </div>

          <div className="rounded-2xl border border-white/[0.08] p-4 space-y-3">
            <div className="flex items-center justify-between"><strong>sms.ir</strong>{providerTestButton('smsir')}</div>
            <input className="a-input w-full a-ltr" dir="ltr" value={providerDraft.smsirLineNumber} onChange={(e) => updateProvider('smsirLineNumber', e.target.value)} placeholder="خط ارسال" />
            <input className="a-input w-full a-ltr" dir="ltr" value={providerDraft.smsirBaseUrl} onChange={(e) => updateProvider('smsirBaseUrl', e.target.value)} placeholder="Base URL" />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="a-input w-full a-ltr" dir="ltr" value={providerDraft.smsirOtpTemplateId} onChange={(e) => updateProvider('smsirOtpTemplateId', e.target.value)} placeholder="شناسه قالب OTP (اختیاری)" />
              <input className="a-input w-full a-ltr" dir="ltr" value={providerDraft.smsirOtpParameter} onChange={(e) => updateProvider('smsirOtpParameter', e.target.value)} placeholder="نام پارامتر OTP" />
            </div>
            <input className="a-input w-full a-ltr" dir="ltr" type="password" value={secretDrafts.smsirApiKey} onChange={(e) => setSecretDrafts((prev) => ({ ...prev, smsirApiKey: e.target.value }))} placeholder={providerDraft.smsirApiKeySet ? 'API Key تنظیم شده — برای تغییر مقدار جدید وارد کنید' : 'API Key'} autoComplete="new-password" />
          </div>

          <div className="rounded-2xl border border-white/[0.08] p-4 space-y-3">
            <div className="flex items-center justify-between"><strong>راستین (قدیمی)</strong>{providerTestButton('rastin')}</div>
            <input className="a-input w-full a-ltr" dir="ltr" value={providerDraft.rastinUsername} onChange={(e) => updateProvider('rastinUsername', e.target.value)} placeholder="نام کاربری" />
            <input className="a-input w-full a-ltr" dir="ltr" value={providerDraft.rastinSender} onChange={(e) => updateProvider('rastinSender', e.target.value)} placeholder="خط فرستنده" />
            <input className="a-input w-full a-ltr" dir="ltr" value={providerDraft.rastinUrl} onChange={(e) => updateProvider('rastinUrl', e.target.value)} placeholder="URL" />
            <input className="a-input w-full a-ltr" dir="ltr" type="password" value={secretDrafts.rastinPassword} onChange={(e) => setSecretDrafts((prev) => ({ ...prev, rastinPassword: e.target.value }))} placeholder={providerDraft.rastinPasswordSet ? 'رمز تنظیم شده — برای تغییر مقدار جدید وارد کنید' : 'رمز عبور'} autoComplete="new-password" />
          </div>
        </div>
      </section>

      {/* Test phone */}
      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">شماره تست</h3>
            <p className="a-card-desc">پیامکی که با دکمه «ارسال تست» هر رویداد می‌زنید، به این شماره ارسال می‌شود.</p>
          </div>
        </div>
        <input
          className="a-input a-input--auto sm:w-72 a-ltr"
          dir="ltr"
          placeholder="09130000000"
          value={testPhone}
          onChange={(e) => setTestPhone(e.target.value)}
        />
      </section>

      {/* Order registration & payment */}
      <section className="a-card">
        <div className="a-card-head">
          <h3 className="a-card-title">ثبت سفارش و پرداخت</h3>
        </div>
        {NEW_ORDER_EVENTS.map((def, i) => renderEvent(def, i === 0))}
      </section>

      {/* Order status changes */}
      <section className="a-card">
        <div className="a-card-head">
          <h3 className="a-card-title">تغییر وضعیت سفارش</h3>
          <p className="a-card-desc">هنگامی که اپراتور وضعیت یک سفارش را تغییر می‌دهد</p>
        </div>
        {STATUS_EVENTS.map((def, i) => renderEvent(def, i === 0))}
      </section>

      {/* OTP */}
      <section className="a-card a-container-md">
        <div className="a-card-head">
          <h3 className="a-card-title">کد تایید ورود</h3>
        </div>
        {ENTRIES_EVENTS.map((def, i) => renderEvent(def, i === 0))}
      </section>
    </div>
  );
}
