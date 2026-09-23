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

  const total = cartTotal(lines);
  const deliveryAddress = address.trim() || user?.address || '';

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
            {[
              { id: 'aqayepardakht', label: 'پرداخت آنلاین (درگاه بانکی)', desc: 'تسویه از طریق درگاه امن بانکی و تایید آنی سفارش' },
              { id: 'online', label: 'کارت به کارت / واریز به حساب', desc: 'تسویه به صورت دستی و ثبت فیش در واتساپ' },
              { id: 'credit_weekly', label: 'اعتباری هفتگی', desc: 'تسویه پنجشنبه‌ها (نیاز به تأیید واحد مالی)' },
              { id: 'check_2_month', label: 'چکی دو ماهه', desc: 'با ارائه چک صیادی و ثبت قرارداد' },
              { id: 'check_4_month', label: 'چکی چهار ماهه', desc: 'مخصوص سفارشات عمده (با تأیید مالی)' },
            ].map(method => (
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
