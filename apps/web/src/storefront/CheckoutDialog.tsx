import { useState } from 'react';
import type { OrderDTO } from '@tamas/shared';
import { WAREHOUSE_LABELS, formatMoney, formatNumber } from '@tamas/shared';
import { Price } from '../components/Price';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { ApiRequestError, api } from '../lib/api';
import { useAuth } from '../store/auth';
import { cartTotal, useCart } from '../store/cart';
import { Icon } from '../components/Icon';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Opens the profile step when the server says the account is incomplete. */
  onNeedsProfile: () => void;
}

interface OrderResponse {
  order: OrderDTO;
  message: string;
}

/** Payment method definitions */
const PAYMENT_METHODS = [
  { id: 'aqayepardakht', label: 'پرداخت آنلاین (درگاه بانکی)', desc: 'تسویه از طریق درگاه امن بانکی و تایید آنی سفارش' },
  { id: 'online', label: 'کارت به کارت / واریز به حساب', desc: 'تسویه به صورت دستی و ثبت فیش در واتساپ' },
  { id: 'credit_weekly', label: 'اعتباری هفتگی', desc: 'تسویه پنجشنبه‌ها (نیاز به تأیید واحد مالی)' },
  { id: 'check_2_month', label: 'چکی دو ماهه', desc: 'با ارائه چک صیادی و ثبت قرارداد' },
  { id: 'check_4_month', label: 'چکی چهار ماهه', desc: 'مخصوص سفارشات عمده (با تأیید مالی)' },
] as const;

/** Secondary form instructions by payment method */
const SECONDARY_INFO: Record<string, { title: string; instructions: string[]; fields: Array<{ key: string; label: string; placeholder: string; type?: string }> }> = {
  online: {
    title: 'اطلاعات واریز — کارت به کارت',
    instructions: [
      'مبلغ سفارش را به شماره حساب زیر واریز کنید:',
      '💳 شماره کارت: ۶۰۳۷-۹۹۷۱-XXXX-XXXX',
      '🏦 بانک ملی — به نام تماس مارکت',
      'پس از واریز، اطلاعات فیش را در فرم زیر وارد کنید.',
    ],
    fields: [
      { key: 'depositorName', label: 'نام واریزکننده', placeholder: 'نام صاحب کارت مبدأ' },
      { key: 'refNumber', label: 'شماره پیگیری / ارجاع', placeholder: 'شماره پیگیری تراکنش بانکی' },
      { key: 'receiptNote', label: 'توضیحات (اختیاری)', placeholder: 'مثلاً: ساعت واریز، توضیح اضافی' },
    ],
  },
  credit_weekly: {
    title: 'تأیید خرید اعتباری هفتگی',
    instructions: [
      'سفارش شما با روش اعتباری هفتگی ثبت شد.',
      'تسویه حساب هر پنجشنبه انجام می‌شود.',
      'لطفاً اطلاعات تکمیلی زیر را وارد کنید:',
    ],
    fields: [
      { key: 'businessName', label: 'نام فروشگاه / کسب‌وکار', placeholder: 'نام تجاری' },
      { key: 'creditNote', label: 'توضیحات (اختیاری)', placeholder: 'توضیح اضافی' },
    ],
  },
  check_2_month: {
    title: 'ثبت اطلاعات چک — دو ماهه',
    instructions: [
      'سفارش شما با روش چکی دو ماهه ثبت شد.',
      'لطفاً اطلاعات چک صیادی را وارد کنید:',
    ],
    fields: [
      { key: 'checkNumber', label: 'شماره چک صیادی', placeholder: 'شماره ۱۶ رقمی چک' },
      { key: 'checkBankName', label: 'نام بانک', placeholder: 'مثال: بانک ملت' },
      { key: 'checkDate', label: 'تاریخ سررسید', placeholder: 'مثال: ۱۴۰۵/۰۸/۱۵', type: 'text' },
      { key: 'checkNote', label: 'توضیحات (اختیاری)', placeholder: '' },
    ],
  },
  check_4_month: {
    title: 'ثبت اطلاعات چک — چهار ماهه',
    instructions: [
      'سفارش شما با روش چکی چهار ماهه ثبت شد.',
      'لطفاً اطلاعات چک صیادی را وارد کنید:',
    ],
    fields: [
      { key: 'checkNumber', label: 'شماره چک صیادی', placeholder: 'شماره ۱۶ رقمی چک' },
      { key: 'checkBankName', label: 'نام بانک', placeholder: 'مثال: بانک ملت' },
      { key: 'checkDate', label: 'تاریخ سررسید', placeholder: 'مثال: ۱۴۰۵/۱۰/۱۵', type: 'text' },
      { key: 'checkNote', label: 'توضیحات (اختیاری)', placeholder: '' },
    ],
  },
};

export function CheckoutDialog({ open, onClose, onNeedsProfile }: Props) {
  const toast = useToast();
  const user = useAuth((s) => s.user);
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);

  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('aqayepardakht');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Secondary form state (post-order)
  const [completedOrder, setCompletedOrder] = useState<OrderDTO | null>(null);
  const [completedMethod, setCompletedMethod] = useState('');
  const [secondaryData, setSecondaryData] = useState<Record<string, string>>({});
  const [secondaryBusy, setSecondaryBusy] = useState(false);

  const total = cartTotal(lines);
  const deliveryAddress = address.trim() || user?.address || '';

  function handleClose() {
    setCompletedOrder(null);
    setCompletedMethod('');
    setSecondaryData({});
    onClose();
  }

  async function submit() {
    if (lines.length === 0) {
      setError('سبد خرید شما خالی است.');
      return;
    }
    if (!agreeTerms) {
      setError('لطفاً جهت ثبت سفارش، شرایط و مفاد فاکتور را مطالعه کرده و تیک تأیید را بزنید.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await api.post<OrderResponse>('/orders', {
        items: lines.map((l) => ({ productId: l.productId, warehouse: l.warehouse, qty: l.qty })),
        address: address.trim() || undefined,
        note: note.trim() || undefined,
        paymentMethod,
      });
      clear();
      setAddress('');
      setNote('');
      setAgreeTerms(false);
      
      if (paymentMethod === 'aqayepardakht') {
        toast.ok('سفارش ثبت شد، در حال انتقال به درگاه پرداخت...');
        const paymentRes = await api.post<{ok: boolean, url: string}>('/payment/create', {
          orderId: res.order.id,
        });
        if (paymentRes.url) {
           window.location.href = paymentRes.url;
           return;
        }
      }

      // For non-gateway methods, show secondary form
      if (SECONDARY_INFO[paymentMethod]) {
        setCompletedOrder(res.order);
        setCompletedMethod(paymentMethod);
        setSecondaryData({});
        toast.ok(res.message);
        return;
      }

      toast.ok(res.message);
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'profile_incomplete') {
        onClose();
        onNeedsProfile();
        return;
      }
      setError(err instanceof Error ? err.message : 'ثبت سفارش ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }

  async function submitSecondary() {
    if (!completedOrder) return;
    setSecondaryBusy(true);
    try {
      await api.post('/orders/payment-info', {
        orderId: completedOrder.id,
        paymentMethod: completedMethod,
        ...secondaryData,
      });
      toast.ok('اطلاعات پرداخت با موفقیت ثبت شد.');
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ثبت اطلاعات ناموفق بود.');
    } finally {
      setSecondaryBusy(false);
    }
  }

  // ── Secondary form view (post-order) ────────────────────────────
  if (completedOrder && SECONDARY_INFO[completedMethod]) {
    const info = SECONDARY_INFO[completedMethod];
    return (
      <Modal
        open={open}
        title={info.title}
        onClose={handleClose}
        busy={secondaryBusy}
        footer={
          <>
            <button type="button" className="btn primary" style={{ flex: 1 }} disabled={secondaryBusy} onClick={() => void submitSecondary()}>
              {secondaryBusy ? 'در حال ثبت…' : 'ثبت اطلاعات پرداخت'}
            </button>
            <button type="button" className="btn" onClick={handleClose} disabled={secondaryBusy}>
              بعداً تکمیل می‌کنم
            </button>
          </>
        }
      >
        <div className="stack">
          {/* Order summary */}
          <div className="card" style={{ padding: 12, background: 'var(--primary-light)', borderColor: 'var(--primary)' }}>
            <div className="stack" style={{ gap: 4, fontSize: 13 }}>
              <div className="row">
                <span className="muted">شماره سفارش</span>
                <span className="spacer" />
                <b className="ltr-inline">{completedOrder.orderCode}</b>
              </div>
              <div className="row">
                <span className="muted">مبلغ کل</span>
                <span className="spacer" />
                <b style={{ color: 'var(--primary-dark)' }}><Price amount={completedOrder.total} /></b>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {info.instructions.map((line, i) => (
                <p key={i} style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: i === 0 ? 'var(--text)' : 'var(--muted)' }}>
                  {line}
                </p>
              ))}
            </div>
          </div>

          {/* Fields */}
          {info.fields.map((f) => (
            <div key={f.key} className="field">
              <label htmlFor={`sf-${f.key}`}>{f.label}</label>
              <input
                id={`sf-${f.key}`}
                className="input"
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={secondaryData[f.key] || ''}
                onChange={(e) => setSecondaryData({ ...secondaryData, [f.key]: e.target.value })}
              />
            </div>
          ))}

          <p className="faint" style={{ margin: 0, fontSize: 12 }}>
            در صورت عدم تکمیل فرم، می‌توانید اطلاعات را بعداً از بخش «سفارش‌های من» ارسال کنید.
          </p>
        </div>
      </Modal>
    );
  }

  // ── Main checkout form ──────────────────────────────────────────
  return (
    <Modal
      open={open}
      title="تایید و ثبت سفارش"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn primary" style={{ flex: 1 }} disabled={busy || !agreeTerms} onClick={() => void submit()}>
            {busy ? 'در حال ثبت…' : <>ثبت سفارش — <Price amount={total} /></>}
          </button>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            انصراف
          </button>
        </>
      }
    >
      <div className="stack">
        {error && <div className="alert error">{error}</div>}

        {user && (
          <div className="card" style={{ padding: 12 }}>
            <div className="stack" style={{ gap: 5, fontSize: 13 }}>
              <div className="row">
                <span className="muted">خریدار</span>
                <span className="spacer" />
                <b>
                  {user.name} {user.lastName}
                  {user.storeName ? ` (${user.storeName})` : ''}
                </b>
              </div>
              <div className="row">
                <span className="muted">موبایل</span>
                <span className="spacer" />
                <b className="ltr-inline">{user.phone}</b>
              </div>
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="co-address">آدرس تحویل</label>
          <textarea
            id="co-address"
            className="textarea"
            rows={3}
            placeholder={user?.address || 'آدرس کامل تحویل سفارش'}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          {!address.trim() && user?.address && <span className="faint" style={{ fontSize: 12 }}>خالی بماند، آدرس حساب استفاده می‌شود.</span>}
          {!deliveryAddress && <span className="alert warn" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="warn" /> آدرسی ثبت نشده است.</span>}
        </div>

        <div className="field">
          <label htmlFor="co-note">توضیحات (اختیاری)</label>
          <input id="co-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="field">
          <label>روش پرداخت و تسویه حساب</label>
          <div style={{ display: 'grid', gap: '8px', marginTop: '4px' }}>
            {PAYMENT_METHODS.map(method => (
              <label key={method.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px',
                border: paymentMethod === method.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                borderRadius: '10px', cursor: 'pointer', background: paymentMethod === method.id ? 'var(--primary-light)' : 'var(--card)'
              }}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method.id}
                  checked={paymentMethod === method.id}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ marginTop: '4px', width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: paymentMethod === method.id ? 'var(--primary-dark)' : 'var(--text)' }}>
                    {method.label}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{method.desc}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>کالا</th>
                <th>انبار</th>
                <th>تعداد</th>
                <th>مبلغ</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td className="wrap">
                    {l.title}
                    {l.color ? ` — ${l.color}` : ''}
                  </td>
                  <td>{WAREHOUSE_LABELS[l.warehouse]}</td>
                  <td>{formatNumber(l.qty)}</td>
                  <td><Price amount={l.price * l.qty} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="card" style={{ padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', background: 'var(--warn-bg)', borderColor: 'var(--warn)' }}>
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            style={{ marginTop: 3, width: 18, height: 18, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 12.5, lineHeight: 1.8, color: 'var(--text)' }}>
            با تیک زدن این گزینه، اینجانب تمامی شرایط و مفاد مندرج در این فاکتور (از جمله شرایط حفظ مالکیت کالا و تعهدات بازپرداخت) را مطالعه کرده و به عنوان «امضای دیجیتال» خود تأیید می‌نمایم. من آگاه هستم که این تأییدیه در حکم قرارداد رسمی بوده و برای من لازم‌الاجراست.{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline' }}>
              (مشاهده کامل شرایط و قوانین)
            </a>
          </span>
        </label>

        <p className="faint" style={{ margin: 0, fontSize: 12 }}>
          قیمت‌ها در لحظه ثبت سفارش از سرور خوانده می‌شوند و ممکن است با نمایش فعلی تفاوت جزئی داشته باشند.
        </p>
      </div>
    </Modal>
  );
}
