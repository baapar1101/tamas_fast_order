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

export function SmsPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [testPhone, setTestPhone] = useState('');

  const settings = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<{ settings: Record<string, string> }>('/admin/settings'),
  });

  // Sync the local editable state from the server once loaded (and after saves).
  useEffect(() => {
    const all = settings.data?.settings;
    if (!all) return;
    const nextText: Record<string, string> = {};
    const nextToggles: Record<string, boolean> = {};
    for (const def of ALL_EVENTS) {
      nextText[def.templateKey] = all[def.templateKey] ?? '';
      nextToggles[def.templateKey] = !FALSY.has((all[enabledKeyFor(def)] ?? '1').trim().toLowerCase());
    }
    setDrafts(nextText);
    setToggles(nextToggles);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {};
      for (const def of ALL_EVENTS) {
        payload[def.templateKey] = drafts[def.templateKey] ?? '';
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

  const savedCount = useMemo(
    () => ALL_EVENTS.filter((def) => toggles[def.templateKey] !== false && (drafts[def.templateKey] ?? '').trim()).length,
    [drafts, toggles],
  );

  const renderEvent = (def: SmsEventDef, first: boolean) => {
    const enabled = toggles[def.templateKey] !== false;
    const text = drafts[def.templateKey] ?? '';
    return (
      <div key={def.templateKey} className={`space-y-3 py-4 ${first ? '' : 'border-t border-white/[0.06]'}`}>
        <div className="a-option-row">
          <div className="a-option-copy">
            <div className="a-option-title">{def.title}</div>
            <div className="a-option-desc">
              {def.desc} — متغیرها:{' '}
              {def.vars.map((v) => (
                <code key={v} className="mx-0.5 rounded bg-slate-800 px-1 py-0.5 text-[10px] text-emerald-300" dir="ltr">
                  {'{'}
                  {v}
                  {'}'}
                </code>
              ))}
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
          className="a-textarea"
          rows={2}
          dir="auto"
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