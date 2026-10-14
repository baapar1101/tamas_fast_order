import type {
  AccessoryPaymentRule,
  CategoryDTO,
  MobilePaymentRule,
  PaymentTermsConfig,
} from '@tamas/shared';
import { parsePaymentTermsConfig } from '@tamas/shared';

interface Props {
  value: string | undefined;
  categories: CategoryDTO[];
  onChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
}

const numeric = (value: string, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const installmentText = (rule: MobilePaymentRule): string => rule.installments
  .map((item) => item.percent == null ? 'اختیاری' : String(item.percent))
  .join('، ');

const parseInstallments = (value: string) => value
  .split(/[،,]/)
  .map((part) => part.trim())
  .filter(Boolean)
  .map((part, index) => ({
    day: index + 1,
    percent: part === '-' || part === 'اختیاری' ? null : numeric(part),
  }));

export function PaymentTermsSettings({ value, categories, onChange, onSave, isSaving }: Props) {
  const config = parsePaymentTermsConfig(value);
  const update = (next: PaymentTermsConfig) => onChange(JSON.stringify(next));
  const updateAccessoryRule = (id: string, patch: Partial<AccessoryPaymentRule>) => update({
    ...config,
    accessory: {
      ...config.accessory,
      rules: config.accessory.rules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule),
    },
  });
  const updateMobileRule = (id: string, patch: Partial<MobilePaymentRule>) => update({
    ...config,
    mobile: {
      ...config.mobile,
      rules: config.mobile.rules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule),
    },
  });

  return (
    <div className="a-page-stack a-fade">
      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">شرایط پرداخت کالا</h3>
            <p className="a-card-desc">درصد پیش‌پرداخت، تخفیف، هزینه خدمات و برنامه سررسیدها مطابق دستور پرداخت</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.enabled}
            className={`a-switch ${config.enabled ? 'a-switch--on' : ''}`}
            onClick={() => update({ ...config, enabled: !config.enabled })}
            title={config.enabled ? 'فعال' : 'غیرفعال'}
          />
        </div>

        <div className="a-field">
          <label className="a-label">دسته‌های کالای موبایل</label>
          <p className="a-note">تمام دسته‌های انتخاب‌نشده، کالای جانبی محسوب می‌شوند.</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {categories.map((category) => {
              const checked = config.mobileCategoryIds.includes(category.id);
              return (
                <label key={category.id} className={`a-btn a-btn--xs ${checked ? 'a-btn--primary' : 'a-btn--secondary'}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => update({
                      ...config,
                      mobileCategoryIds: checked
                        ? config.mobileCategoryIds.filter((id) => id !== category.id)
                        : [...config.mobileCategoryIds, category.id],
                    })}
                    style={{ marginInlineEnd: 6 }}
                  />
                  {category.faName}
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">کالاهای جانبی - شرایط چک</h3>
            <p className="a-card-desc">عدد صفر در پیش‌پرداخت یا تخفیف، معادل خط تیره در فایل مبنا است.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.accessory.enabled}
            className={`a-switch ${config.accessory.enabled ? 'a-switch--on' : ''}`}
            onClick={() => update({ ...config, accessory: { ...config.accessory, enabled: !config.accessory.enabled } })}
          />
        </div>
        <div className="a-field mb-4">
          <label className="a-label">توضیح حساب کالاهای جانبی</label>
          <textarea className="a-textarea" rows={2} value={config.accessory.accountInstructions} onChange={(event) => update({
            ...config,
            accessory: { ...config.accessory, accountInstructions: event.target.value },
          })} />
        </div>
        {(['monthly', 'bimonthly'] as const).map((group) => (
          <div className="a-table-wrap mb-5" key={group}>
            <table className="a-table">
              <thead><tr><th colSpan={6}>{group === 'monthly' ? 'چک‌های ماه‌به‌ماه' : 'چک‌های دوماه‌به‌دوماه'}</th></tr><tr><th>فعال</th><th>عنوان</th><th>مدت (ماه)</th><th>پیش‌پرداخت ٪</th><th>تخفیف ٪</th><th /></tr></thead>
              <tbody>
                {config.accessory.rules.filter((rule) => rule.group === group).map((rule) => (
                  <tr key={rule.id}>
                    <td><input type="checkbox" checked={rule.enabled} onChange={(event) => updateAccessoryRule(rule.id, { enabled: event.target.checked })} /></td>
                    <td><input className="a-input" value={rule.label} onChange={(event) => updateAccessoryRule(rule.id, { label: event.target.value })} /></td>
                    <td><input className="a-input a-ltr" type="number" min="0" value={rule.termMonths} onChange={(event) => updateAccessoryRule(rule.id, { termMonths: numeric(event.target.value) })} /></td>
                    <td><input className="a-input a-ltr" type="number" min="0" max="100" step="0.01" value={rule.upfrontPercent} onChange={(event) => updateAccessoryRule(rule.id, { upfrontPercent: numeric(event.target.value) })} /></td>
                    <td><input className="a-input a-ltr" type="number" min="0" max="100" step="0.01" value={rule.discountPercent} onChange={(event) => updateAccessoryRule(rule.id, { discountPercent: numeric(event.target.value) })} /></td>
                    <td><button type="button" className="a-btn a-btn--danger a-btn--xs" onClick={() => update({ ...config, accessory: { ...config.accessory, rules: config.accessory.rules.filter((item) => item.id !== rule.id) } })}>حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="a-btn a-btn--secondary a-btn--xs mt-3" onClick={() => update({
              ...config,
              accessory: {
                ...config.accessory,
                rules: [...config.accessory.rules, {
                  id: `accessory-${group}-${Date.now()}`, label: 'شرایط جدید', enabled: true, group,
                  termMonths: 1, upfrontPercent: 0, discountPercent: 0,
                }],
              },
            })}>+ افزودن ردیف</button>
          </div>
        ))}
      </section>

      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">موبایل - تسویه روزانه</h3>
            <p className="a-card-desc">الگوی دریافت را به‌ترتیب روزها با ویرگول وارد کنید؛ برای روز اختیاری بنویسید «اختیاری».</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.mobile.enabled}
            className={`a-switch ${config.mobile.enabled ? 'a-switch--on' : ''}`}
            onClick={() => update({ ...config, mobile: { ...config.mobile, enabled: !config.mobile.enabled } })}
          />
        </div>
        <div className="a-form-grid a-cols--2 mb-4">
          <div className="a-field"><label className="a-label">توضیح حساب پرداخت نقدی</label><textarea className="a-textarea" rows={2} value={config.mobile.cashAccountInstructions} onChange={(event) => update({ ...config, mobile: { ...config.mobile, cashAccountInstructions: event.target.value } })} /></div>
          <div className="a-field"><label className="a-label">توضیح حساب سررسیدهای روزانه</label><textarea className="a-textarea" rows={2} value={config.mobile.dailyAccountInstructions} onChange={(event) => update({ ...config, mobile: { ...config.mobile, dailyAccountInstructions: event.target.value } })} /></div>
        </div>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead><tr><th>فعال</th><th>عنوان</th><th>روز تسویه</th><th>دریافتی</th><th>کارمزد روزانه ٪</th><th>کارمزد کل ٪</th><th>روزهای دریافت</th><th /></tr></thead>
            <tbody>
              {config.mobile.rules.map((rule) => (
                <tr key={rule.id}>
                  <td><input type="checkbox" checked={rule.enabled} onChange={(event) => updateMobileRule(rule.id, { enabled: event.target.checked })} /></td>
                  <td><input className="a-input" value={rule.label} onChange={(event) => updateMobileRule(rule.id, { label: event.target.value })} /></td>
                  <td><input className="a-input a-ltr" type="number" min="0" value={rule.days} onChange={(event) => updateMobileRule(rule.id, { days: numeric(event.target.value) })} /></td>
                  <td><input className="a-input" value={rule.receivedLabel} onChange={(event) => updateMobileRule(rule.id, { receivedLabel: event.target.value })} /></td>
                  <td><input className="a-input a-ltr" type="number" min="0" step="0.01" value={rule.dailyServicePercent} onChange={(event) => updateMobileRule(rule.id, { dailyServicePercent: numeric(event.target.value) })} /></td>
                  <td><input className="a-input a-ltr" type="number" min="0" step="0.01" value={rule.totalServicePercent} onChange={(event) => updateMobileRule(rule.id, { totalServicePercent: numeric(event.target.value) })} /></td>
                  <td><input className="a-input" style={{ minWidth: 220 }} value={installmentText(rule)} onChange={(event) => updateMobileRule(rule.id, { installments: parseInstallments(event.target.value) })} /></td>
                  <td><button type="button" className="a-btn a-btn--danger a-btn--xs" onClick={() => update({ ...config, mobile: { ...config.mobile, rules: config.mobile.rules.filter((item) => item.id !== rule.id) } })}>حذف</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="a-btn a-btn--secondary a-btn--xs" onClick={() => update({
            ...config,
            mobile: {
              ...config.mobile,
              rules: [...config.mobile.rules, {
                id: `mobile-${Date.now()}`, label: 'تسویه جدید', enabled: true, days: 1,
                receivedLabel: 'اختیاری', dailyServicePercent: 0, totalServicePercent: 0,
                installments: [{ day: 1, percent: 100 }],
              }],
            },
          })}>+ افزودن برنامه</button>
          <button type="button" className="a-btn a-btn--primary" disabled={isSaving} onClick={onSave}>{isSaving ? 'در حال ذخیره...' : 'ذخیره شرایط پرداخت'}</button>
        </div>
      </section>
    </div>
  );
}
