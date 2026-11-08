import { useState, type ChangeEvent } from 'react';
import type { OrderDTO } from '@tamas/shared';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';

const PAYMENT_STATUS: Record<OrderDTO['paymentStatus'], { label: string; tone: string }> = {
  paid: { label: 'پرداخت‌شده', tone: 'success' },
  pending: { label: 'در انتظار تأیید پرداخت', tone: 'warn' },
  unpaid: { label: 'پرداخت‌نشده', tone: 'danger' },
};

export function PaymentStatusBadge({ order }: { order: OrderDTO }) {
  if (order.status === 'cancelled') return null;
  const info = PAYMENT_STATUS[order.paymentStatus] ?? PAYMENT_STATUS.unpaid;
  return <span className={`badge ${info.tone} ord-pay-badge`}>{info.label}</span>;
}

function needsPayment(order: OrderDTO): boolean {
  return order.status !== 'cancelled' && order.paymentStatus !== 'paid';
}

/** Orders paid by bank transfer or cheque collect their proof after checkout. */
function acceptsPaymentInfo(order: OrderDTO): 'receipt' | 'cheque' | null {
  if (!needsPayment(order)) return null;
  // Large orders get their destination account from the finance team later;
  // there is nothing to send a receipt for until that has happened.
  if (order.paymentInstructions?.status === 'pending') return null;
  if (order.paymentPlan?.kind === 'cheque' || order.paymentMethod?.startsWith('check_')) return 'cheque';
  if (order.paymentPlan?.kind === 'cash' || order.paymentMethod === 'online') return 'receipt';
  return null;
}

export function OrderPaymentActions({ order }: { order: OrderDTO }) {
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const infoKind = acceptsPaymentInfo(order);
  const canPayOnline = needsPayment(order) && order.paymentMethod === 'aqayepardakht';

  const awaitingInstructions = !canPayOnline && needsPayment(order) && order.paymentInstructions?.status === 'pending';
  if (awaitingInstructions) {
    return <span className="badge warn">اطلاعات پرداخت به‌زودی برای شما ارسال می‌شود</span>;
  }
  if (!canPayOnline && !infoKind) return null;

  const payOnline = async () => {
    setPaying(true);
    try {
      const res = await api.post<{ ok: boolean; url: string }>('/payment/create', { orderId: order.id });
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      toast.error('آدرس درگاه پرداخت دریافت نشد.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'اتصال به درگاه پرداخت ناموفق بود.');
    }
    setPaying(false);
  };

  const upload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    setBusy(true);
    try {
      const res = await api.upload<{ ok: boolean; url?: string; message?: string }>('/uploads', formData);
      if (res.ok && res.url) {
        const url = res.url;
        setFields((current) => ({ ...current, receiptImageUrl: url }));
      } else {
        toast.error(res.message || 'آپلود فایل ناموفق بود.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'آپلود فایل ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (infoKind === 'cheque' && (!fields.checkNumber?.trim() || !fields.checkBankName?.trim())) {
      toast.error('شماره صیادی و نام بانک چک را وارد کنید.');
      return;
    }
    if (infoKind === 'receipt' && !fields.receiptImageUrl && !fields.receiptNote?.trim()) {
      toast.error('تصویر رسید یا شماره پیگیری واریز را وارد کنید.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ ok?: boolean; message?: string }>('/orders/payment-info', {
        orderId: order.id,
        paymentMethod: order.paymentMethod ?? (infoKind === 'cheque' ? 'cheque' : 'online'),
        ...fields,
      });
      if (res.ok === false) throw new Error(res.message || 'ثبت اطلاعات پرداخت ناموفق بود.');
      toast.ok('اطلاعات پرداخت ثبت شد و پس از بررسی واحد مالی تأیید می‌شود.');
      setSubmitted(true);
      setFormOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ثبت اطلاعات پرداخت ناموفق بود.');
    } finally {
      setBusy(false);
    }
  };

  const set = (key: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFields((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
      {canPayOnline && (
        <button type="button" className="btn primary sm" disabled={paying} onClick={() => void payOnline()}>
          {paying ? 'در حال اتصال به درگاه…' : 'پرداخت آنلاین'}
        </button>
      )}
      {infoKind && !submitted && !formOpen && (
        <button type="button" className="btn sm" onClick={() => setFormOpen(true)}>
          {infoKind === 'cheque' ? 'ثبت اطلاعات چک' : 'ارسال رسید واریز'}
        </button>
      )}
      {submitted && <span className="badge success">اطلاعات پرداخت ارسال شد</span>}
      {formOpen && (
        <div className="card stack" style={{ width: '100%', padding: 'var(--ds-space-3)', gap: 'var(--ds-space-2)' }}>
          {infoKind === 'cheque' ? (
            <>
              <div className="field">
                <label htmlFor={`chq-${order.id}`}>شماره چک صیادی</label>
                <input id={`chq-${order.id}`} className="input" dir="ltr" inputMode="numeric" value={fields.checkNumber ?? ''} onChange={set('checkNumber')} placeholder="شماره ۱۶ رقمی" />
              </div>
              <div className="field">
                <label htmlFor={`bank-${order.id}`}>نام بانک</label>
                <input id={`bank-${order.id}`} className="input" value={fields.checkBankName ?? ''} onChange={set('checkBankName')} placeholder="مثال: بانک ملت" />
              </div>
            </>
          ) : (
            <div className="field">
              <label htmlFor={`ref-${order.id}`}>شماره پیگیری یا توضیح واریز</label>
              <input id={`ref-${order.id}`} className="input" value={fields.receiptNote ?? ''} onChange={set('receiptNote')} placeholder="کد رهگیری، ساعت واریز یا توضیح" />
            </div>
          )}
          <div className="field">
            <label htmlFor={`img-${order.id}`}>{infoKind === 'cheque' ? 'تصویر چک (اختیاری)' : 'تصویر رسید'}</label>
            {fields.receiptImageUrl ? (
              <div className="row" style={{ gap: 'var(--ds-space-2)' }}>
                <span className="badge success">تصویر آپلود شد</span>
                <button type="button" className="btn ghost sm" onClick={() => setFields((current) => ({ ...current, receiptImageUrl: '' }))}>حذف</button>
              </div>
            ) : (
              <input
                id={`img-${order.id}`}
                className="input"
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                  event.target.value = '';
                }}
              />
            )}
          </div>
          <div className="row" style={{ gap: 'var(--ds-space-2)' }}>
            <button type="button" className="btn primary sm" disabled={busy} onClick={() => void submit()}>
              {busy ? 'در حال ثبت…' : 'ثبت اطلاعات پرداخت'}
            </button>
            <button type="button" className="btn ghost sm" disabled={busy} onClick={() => setFormOpen(false)}>انصراف</button>
          </div>
        </div>
      )}
    </>
  );
}
