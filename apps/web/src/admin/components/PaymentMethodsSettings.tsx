import { useState } from 'react';
import type { PaymentMethodConfig } from '@tamas/shared';
import { Modal } from '../../components/Modal';
import { formatNumber } from '@tamas/shared';
import { parsePaymentMethods } from '../../lib/payment-methods';
import './payment-settings.css';

interface Props {
  value: string | undefined;
  onChange: (newValue: string) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

const TYPE_LABELS: Record<PaymentMethodConfig['type'], { label: string; badgeClass: string }> = {
  wallet: { label: 'کیف پول', badgeClass: 'a-badge--success' },
  online: { label: 'درگاه آنلاین', badgeClass: 'a-badge--success' },
  manual: { label: 'کارت به کارت / واریز', badgeClass: 'a-badge--info' },
  credit: { label: 'خرید اعتباری', badgeClass: 'a-badge--warning' },
  cheque: { label: 'چک صیادی', badgeClass: 'a-badge--neutral' },
  custom: { label: 'سفارشی / در محل', badgeClass: 'a-badge--neutral' },
};

export function PaymentMethodsSettings({ value, onChange, onSave, isSaving }: Props) {
  const methods = parsePaymentMethods(value);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethodConfig | null>(null);

  // Form state inside modal
  const [formId, setFormId] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<PaymentMethodConfig['type']>('custom');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formInstructions, setFormInstructions] = useState('');
  const [formMinAmount, setFormMinAmount] = useState('');
  const [formMaxAmount, setFormMaxAmount] = useState('');

  const openCreateModal = () => {
    setEditingMethod(null);
    setFormId(`pm_${Date.now()}`);
    setFormLabel('');
    setFormDesc('');
    setFormType('custom');
    setFormEnabled(true);
    setFormInstructions('');
    setFormMinAmount('');
    setFormMaxAmount('');
    setModalOpen(true);
  };

  const openEditModal = (m: PaymentMethodConfig) => {
    setEditingMethod(m);
    setFormId(m.id);
    setFormLabel(m.label);
    setFormDesc(m.desc);
    setFormType(m.type);
    setFormEnabled(m.enabled);
    setFormInstructions(m.instructions || '');
    setFormMinAmount(m.minAmount ? String(m.minAmount) : '');
    setFormMaxAmount(m.maxAmount ? String(m.maxAmount) : '');
    setModalOpen(true);
  };

  const handleSaveModal = () => {
    if (!formLabel.trim()) return;

    const newMethod: PaymentMethodConfig = {
      id: formId || `pm_${Date.now()}`,
      label: formLabel.trim(),
      desc: formDesc.trim(),
      type: formType,
      enabled: formEnabled,
      instructions: formInstructions.trim() || undefined,
      minAmount: formMinAmount ? Number(formMinAmount) : undefined,
      maxAmount: formMaxAmount ? Number(formMaxAmount) : undefined,
      sortOrder: editingMethod ? editingMethod.sortOrder : methods.length + 1,
    };

    let updated: PaymentMethodConfig[];
    if (editingMethod) {
      updated = methods.map((m) => (m.id === editingMethod.id ? newMethod : m));
    } else {
      updated = [...methods, newMethod];
    }

    onChange(JSON.stringify(updated));
    setModalOpen(false);
  };

  const handleToggleEnabled = (id: string) => {
    const updated = methods.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m));
    onChange(JSON.stringify(updated));
  };

  const handleDelete = (id: string) => {
    if (methods.length <= 1) return;
    const updated = methods.filter((m) => m.id !== id);
    onChange(JSON.stringify(updated));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= methods.length) return;

    const updated = [...methods];
    const temp = updated[index]!;
    updated[index] = updated[targetIdx]!;
    updated[targetIdx] = temp;

    updated.forEach((m, i) => {
      m.sortOrder = i + 1;
    });

    onChange(JSON.stringify(updated));
  };

  return (
    <div className="a-card a-fade">
      <div className="a-card-head pm-head">
        <div>
          <h3 className="a-card-title">پیکربندی روش‌های پرداخت</h3>
          <p className="a-subtitle pm-head__sub">
            مدیریت، فعال/غیرفعال‌سازی و تعریف روش‌های پرداخت هنگام ثبت سفارش توسط خریدار
          </p>
        </div>
        <div className="pm-head__actions">
          <button type="button" className="a-btn a-btn--secondary" onClick={openCreateModal}>
            + افزودن روش پرداخت
          </button>
          {onSave && (
            <button type="button" className="a-btn a-btn--primary" disabled={isSaving} aria-busy={isSaving || undefined} onClick={onSave}>
              {isSaving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
            </button>
          )}
        </div>
      </div>

      <div className="a-card-body pm-body">
        <div className="pm-list">
          {methods.map((m, index) => {
            const typeInfo = TYPE_LABELS[m.type] ?? TYPE_LABELS.custom;
            return (
              <div key={m.id} className={`pm-row${m.enabled ? '' : ' is-off'}`}>
                <div className="pm-row__main">
                  <button
                    type="button"
                    role="switch"
                    className="a-switch"
                    aria-checked={m.enabled}
                    aria-label={`فعال بودن «${m.label}»`}
                    title={m.enabled ? 'فعال؛ برای غیرفعال کردن کلیک کنید' : 'غیرفعال؛ برای فعال کردن کلیک کنید'}
                    onClick={() => handleToggleEnabled(m.id)}
                  />

                  <div>
                    <div className="pm-row__title">
                      <strong className="pm-row__label">{m.label}</strong>
                      <span className={`a-badge ${typeInfo.badgeClass}`}>{typeInfo.label}</span>
                      {!m.enabled && <span className="a-badge a-badge--neutral">غیرفعال</span>}
                    </div>
                    {m.desc && <p className="pm-row__desc">{m.desc}</p>}
                    {m.instructions && <div className="pm-row__note">{m.instructions.split('\n')[0]}</div>}
                    {(m.minAmount || m.maxAmount) && (
                      <div className="pm-row__note pm-row__note--muted">
                        {m.minAmount && <span>حداقل: {formatNumber(m.minAmount)} تومان </span>}
                        {m.maxAmount && <span> | حداکثر: {formatNumber(m.maxAmount)} تومان</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pm-row__actions">
                  <button
                    type="button"
                    className="a-btn a-btn--sm a-btn--ghost a-btn--icon"
                    disabled={index === 0}
                    onClick={() => handleMove(index, 'up')}
                    title="انتقال به بالاتر"
                    aria-label={`بردن «${m.label}» به بالا`}
                  >
                    <span aria-hidden="true">▲</span>
                  </button>
                  <button
                    type="button"
                    className="a-btn a-btn--sm a-btn--ghost a-btn--icon"
                    disabled={index === methods.length - 1}
                    onClick={() => handleMove(index, 'down')}
                    title="انتقال به پایین‌تر"
                    aria-label={`بردن «${m.label}» به پایین`}
                  >
                    <span aria-hidden="true">▼</span>
                  </button>
                  <button type="button" className="a-btn a-btn--sm a-btn--secondary" onClick={() => openEditModal(m)}>
                    ویرایش
                  </button>
                  <button
                    type="button"
                    className="a-btn a-btn--sm a-btn--danger"
                    disabled={methods.length <= 1}
                    onClick={() => handleDelete(m.id)}
                    title={methods.length <= 1 ? 'دست‌کم یک روش پرداخت لازم است.' : 'حذف'}
                    aria-label={`حذف «${m.label}»`}
                  >
                    حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal for Add / Edit */}
      {modalOpen && (
        <Modal
          open={modalOpen}
          title={editingMethod ? 'ویرایش روش پرداخت' : 'افزودن روش پرداخت'}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button type="button" className="a-btn a-btn--primary" onClick={handleSaveModal} disabled={!formLabel.trim()}>
                ذخیره روش پرداخت
              </button>
              <button type="button" className="a-btn a-btn--secondary" onClick={() => setModalOpen(false)}>
                انصراف
              </button>
            </>
          }
        >
          <div className="pm-form">
            <label className="a-field">
              <span className="a-label">عنوان روش پرداخت (برای مشتری)</span>
              <input
                className="a-input"
                placeholder="مثلاً: پرداخت در محل (کارتخوان سیار)"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
              />
            </label>

            <label className="a-field">
              <span className="a-label">توضیح کوتاه</span>
              <input
                className="a-input"
                placeholder="مثلاً: پرداخت کارت به کارت هنگام دریافت سفارش"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </label>

            <label className="a-field">
              <span className="a-label">نوع رفتار سیستم</span>
              <select
                className="a-select"
                value={formType}
                onChange={(e) => setFormType(e.target.value as PaymentMethodConfig['type'])}
              >
                <option value="online">درگاه پرداخت آنلاین (اتصال به درگاه بانکی)</option>
                <option value="manual">کارت به کارت / واریز دستی (نیاز به آپلود رسید فیش)</option>
                <option value="credit">خرید اعتباری (ثبت سفارش اعتباری)</option>
                <option value="cheque">چک صیادی (دریافت اطلاعات شماره چک)</option>
                <option value="custom">سفارشی / پرداخت در محل (ثبت مستقیم سفارش)</option>
              </select>
            </label>

            <label className="pm-check">
              <input
                type="checkbox"
                checked={formEnabled}
                onChange={(e) => setFormEnabled(e.target.checked)}
              />
              <span>این روش پرداخت فعال باشد</span>
            </label>

            <label className="a-field">
              <span className="a-label">دستورالعمل، شماره حساب یا توضیحات تکمیلی مشتری (اختیاری)</span>
              <textarea
                className="a-textarea"
                rows={3}
                placeholder="مثلاً: شماره کارت یا شرایط تأیید چک صیادی…"
                value={formInstructions}
                onChange={(e) => setFormInstructions(e.target.value)}
              />
            </label>

            <div className="pm-form__pair">
              <label className="a-field">
                <span className="a-label">حداقل مبلغ سفارش (تومان)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  className="a-input a-ltr"
                  placeholder="مثلاً ۱٬۰۰۰٬۰۰۰"
                  value={formMinAmount}
                  onChange={(e) => setFormMinAmount(e.target.value)}
                />
              </label>
              <label className="a-field">
                <span className="a-label">حداکثر مبلغ سفارش (تومان)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  className="a-input a-ltr"
                  placeholder="مثلاً ۵۰٬۰۰۰٬۰۰۰"
                  value={formMaxAmount}
                  onChange={(e) => setFormMaxAmount(e.target.value)}
                />
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
