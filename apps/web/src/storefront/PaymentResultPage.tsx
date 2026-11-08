import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';

export function PaymentResultPage() {
  const [params] = useSearchParams();
  const user = useAuth((state) => state.user);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');
  const status = params.get('status');
  const orderId = params.get('orderId');
  const trackingCode = params.get('trackingCode');
  const error = params.get('error');

  const isSuccess = status === 'success';
  const numericOrderId = Number(orderId);
  const canRetry = !isSuccess && Boolean(user) && Number.isInteger(numericOrderId) && numericOrderId > 0;

  const retryPayment = async () => {
    setRetrying(true);
    setRetryError('');
    try {
      const res = await api.post<{ ok: boolean; url: string }>('/payment/create', { orderId: numericOrderId });
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      setRetryError('آدرس درگاه پرداخت دریافت نشد.');
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : 'اتصال به درگاه پرداخت ناموفق بود.');
    }
    setRetrying(false);
  };

  return (
    <div className="storefront-page customer-payment-result" style={{ padding: "var(--ds-space-10) var(--ds-space-5)", minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="card customer-payment-card" style={{ maxWidth: 500, width: '100%', padding: "var(--ds-space-10) var(--ds-space-5)", textAlign: 'center', marginTop: "var(--ds-space-5)" }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: isSuccess ? 'var(--success-bg)' : 'var(--warn-bg)',
          color: isSuccess ? 'var(--success)' : 'var(--warn)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: "0 auto var(--ds-space-5)"
        }}>
          <div style={{ width: 40, height: 40, display: 'flex' }}>
            <Icon name={isSuccess ? 'check' : 'warn'} />
          </div>
        </div>
        <h2 style={{ marginBottom: 10, fontSize: "var(--ds-text-title)" }}>
          {isSuccess ? 'پرداخت شما با موفقیت انجام شد' : 'پرداخت ناموفق بود'}
        </h2>
        
        {isSuccess ? (
          <p style={{ color: 'var(--muted)', lineHeight: 1.6, marginBottom: 30 }}>
            سفارش شما با موفقیت ثبت و پرداخت شد. در حال پردازش جهت ارسال می‌باشد.
          </p>
        ) : (
          <p style={{ color: 'var(--muted)', lineHeight: 1.6, marginBottom: 30 }}>
            عملیات پرداخت با خطا مواجه شد و یا توسط شما لغو گردید. در صورتی که مبلغی از حساب شما کسر شده باشد، تا ۷۲ ساعت آینده از طرف بانک بازگشت داده خواهد شد.
          </p>
        )}

        <div style={{ background: 'var(--bg)', padding: 15, borderRadius: 12, marginBottom: 30, textAlign: 'right' }}>
          {orderId && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="muted">شماره سفارش:</span>
              <b>{orderId}</b>
            </div>
          )}
          {trackingCode && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted">کد پیگیری درگاه:</span>
              <b className="ltr-inline">{trackingCode}</b>
            </div>
          )}
          {error && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warn)' }}>
              <span className="muted">کد خطا:</span>
              <b className="ltr-inline">{error}</b>
            </div>
          )}
        </div>

        {retryError && <div className="alert error" role="alert" style={{ marginBottom: 'var(--ds-space-4)' }}>{retryError}</div>}

        <div className="customer-payment-actions" style={{ display: 'flex', gap: 15, justifyContent: 'center', flexWrap: 'wrap' }}>
          {canRetry && (
            <button type="button" className="btn primary" disabled={retrying} onClick={() => void retryPayment()}>
              {retrying ? 'در حال اتصال به درگاه…' : 'تلاش دوباره برای پرداخت'}
            </button>
          )}
          <Link to="/account" className={canRetry ? 'btn' : 'btn primary'}>پیگیری سفارشات</Link>
          <Link to="/" className="btn outline">بازگشت به فروشگاه</Link>
        </div>
      </div>
    </div>
  );
}
