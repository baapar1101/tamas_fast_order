import { useState } from 'react';
import type { PaymentMethodConfig } from '@tamas/shared';
import { Modal } from '../../components/Modal';
import { formatNumber } from '@tamas/shared';
import { parsePaymentMethods } from '../../lib/payment-methods';

interface Props {
  value: string | undefined;
  onChange: (newValue: string) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

const TYPE_LABELS: Record<PaymentMethodConfig['type'], { label: string; badgeClass: string; icon: string }> = {
  online: { label: 'درگاه آنلاین', badgeClass: 'a-badge--success', icon: '💳' },
  manual: { label: 'کارت به کارت / واریز', badgeClass: 'a-badge--info', icon: '🏦' },
  credit: { label: 'خرید اعتباری', badgeClass: 'a-badge--warning', icon: '⏳' },
  cheque: { label: 'چک صیادی', badgeClass: 'a-badge--purple', icon: '📄' },
  custom: { label: 'سفارشی / در محل', badgeClass: 'a-badge--neutral', icon: '🛍️' },
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
      <div className="a-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 className="a-card-title">💳 پیکربندی روش‌های پرداخت</h3>
          <p className="a-subtitle" style={{ margin: '4px 0 0' }}>
            مدیریت، فعال/غیرفعال‌سازی و تعاریف روش‌های پرداخت هنگام ثبت سفارش توسط خریدار
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="a-btn a-btn--secondary" onClick={openCreateModal}>
            ➕ افزودن روش پرداخت جدید
          </button>
          {onSave && (
            <button type="button" className="a-btn a-btn--primary" disabled={isSaving} onClick={onSave}>
              {isSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
          )}
        </div>
      </div>

      <div className="a-card-body" style={{ padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {methods.map((m, index) => {
            const typeInfo = TYPE_LABELS[m.type] ?? TYPE_LABELS.custom;
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: m.enabled ? 'var(--card, #fff)' : 'var(--tamas-surface-subtle, #f8fafc)',
                  border: m.enabled ? '1px solid var(--tamas-border, #e2e8f0)' : '1px dashed var(--tamas-border, #cbd5e1)',
                  borderRadius: 12,
                  opacity: m.enabled ? 1 : 0.65,
                  transition: 'all 0.2s ease',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                {/* Left side info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 240, flex: 1 }}>
                  {/* Status Toggle Switch */}
                  <label
                    style={{
                      position: 'relative',
                      display: 'inline-block',
                      width: 44,
                      height: 24,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    title={m.enabled ? 'فعال — جهت غیرفعال کردن کلیک کنید' : 'غیرفعال — جهت فعال کردن کلیک کنید'}
                  >
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      onChange={() => handleToggleEnabled(m.id)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: m.enabled ? '#10b981' : '#cbd5e1',
                        borderRadius: 24,
                        transition: '0.2s',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        height: 18,
                        width: 18,
                        left: m.enabled ? 22 : 3,
                        bottom: 3,
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        transition: '0.2s',
                      }}
                    />
                  </label>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16 }}>{typeInfo.icon}</span>
                      <strong style={{ fontSize: 14, color: 'var(--tamas-fg, #0f172a)' }}>{m.label}</strong>
                      <span className={`a-badge ${typeInfo.badgeClass}`} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12 }}>
                        {typeInfo.label}
                      </span>
                      {!m.enabled && (
                        <span className="a-badge a-badge--neutral" style={{ fontSize: 10, color: '#64748b' }}>
                          غیرفعال
                        </span>
                      )}
                    </div>
                    {m.desc && <p style={{ fontSize: 12, color: 'var(--tamas-muted, #64748b)', margin: '4px 0 0' }}>{m.desc}</p>}
                    {m.instructions && (
                      <div style={{ fontSize: 11, color: 'var(--tamas-accent, #0ea5e9)', marginTop: 4, whiteSpace: 'pre-line' }}>
                        ℹ️ {m.instructions.split('\n')[0]}
                      </div>
                    )}
                    {(m.minAmount || m.maxAmount) && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        {m.minAmount && <span>حداقل: {formatNumber(m.minAmount)} تومان </span>}
                        {m.maxAmount && <span> | حداکثر: {formatNumber(m.maxAmount)} تومان</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="a-btn a-btn--sm a-btn--ghost"
                    disabled={index === 0}
                    onClick={() => handleMove(index, 'up')}
                    title="انتقال به بالاتر"
                  >
                    ⬆️
                  </button>
                  <button
                    type="button"
                    className="a-btn a-btn--sm a-btn--ghost"
                    disabled={index === methods.length - 1}
                    onClick={() => handleMove(index, 'down')}
                    title="انتقال به پایین‌تر"
                  >
                    ⬇️
                  </button>
                  <button type="button" className="a-btn a-btn--sm a-btn--secondary" onClick={() => openEditModal(m)}>
                    ✏️ ویرایش
                  </button>
                  <button
                    type="button"
                    className="a-btn a-btn--sm a-btn--danger"
                    disabled={methods.length <= 1}
                    onClick={() => handleDelete(m.id)}
                    title="حذف"
                  >
                    🗑️
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
          title={editingMethod ? 'ویرایش روش پرداخت' : 'افزودن روش پرداخت جدید'}
          onClose={() => setModalOpen(false)}
          footer={
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="a-btn a-btn--ghost" onClick={() => setModalOpen(false)}>
                انصراف
              </button>
              <button type="button" className="a-btn a-btn--primary" onClick={handleSaveModal} disabled={!formLabel.trim()}>
                ذخیره روش پرداخت
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="a-field">
              <label className="a-label">عنوان روش پرداخت (برای مشتری)</label>
              <input
                className="a-input"
                placeholder="مثال: پرداخت در محل (کارتخوان سیار)"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
              />
            </div>

            <div className="a-field">
              <label className="a-label">توضیح کوتاه</label>
              <input
                className="a-input"
                placeholder="مثال: پرداخت کارت به کارت هنگام دریافت سفارش"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>

            <div className="a-field">
              <label className="a-label">نوع رفتار سیستم</label>
              <select
                className="a-input"
                value={formType}
                onChange={(e) => setFormType(e.target.value as PaymentMethodConfig['type'])}
              >
                <option value="online">💳 درگاه پرداخت آنلاین (اتصال به درگاه بانکی)</option>
                <option value="manual">🏦 کارت به کارت / واریز دستی (نیاز به آپلود رسید فیش)</option>
                <option value="credit">⏳ خرید اعتباری (ثبت سفارش اعتباری)</option>
                <option value="cheque">📄 چک صیادی (دریافت اطلاعات شماره چک)</option>
                <option value="custom">🛍️ سفارشی / پرداخت در محل (ثبت مستقیم سفارش)</option>
              </select>
            </div>

            <div className="a-field">
              <label className="a-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#10b981' }}
                />
                <span>این روش پرداخت فعال باشد</span>
              </label>
            </div>

            <div className="a-field">
              <label className="a-label">دستورالعمل، شماره حساب یا توضیحات تکمیلی مشتری (اختیاری)</label>
              <textarea
                className="a-textarea"
                rows={3}
                placeholder="مثلاً: شماره کارت یا شرایط تایید چک صیادی..."
                value={formInstructions}
                onChange={(e) => setFormInstructions(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="a-field">
                <label className="a-label">حداقل مبلغ سفارش (تومان)</label>
                <input
                  type="number"
                  className="a-input a-ltr"
                  placeholder="مثال: 1000000"
                  value={formMinAmount}
                  onChange={(e) => setFormMinAmount(e.target.value)}
                />
              </div>
              <div className="a-field">
                <label className="a-label">حداکثر مبلغ سفارش (تومان)</label>
                <input
                  type="number"
                  className="a-input a-ltr"
                  placeholder="مثال: 50000000"
                  value={formMaxAmount}
                  onChange={(e) => setFormMaxAmount(e.target.value)}
                />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
