import { useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { StoreFooter } from './StoreFooter';

export function PaymentResultPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const status = params.get('status');
  const orderId = params.get('orderId');
  const trackingCode = params.get('trackingCode');
  const error = params.get('error');

  const isSuccess = status === 'success';

  return (
    <div className="storefront-page" style={{ padding: '40px 20px', minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="card" style={{ maxWidth: 500, width: '100%', padding: '40px 20px', textAlign: 'center', marginTop: '20px' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: isSuccess ? 'var(--success-bg)' : 'var(--warn-bg)',
          color: isSuccess ? 'var(--success)' : 'var(--warn)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'
        }}>
          <div style={{ width: 40, height: 40, display: 'flex' }}>
            <Icon name={isSuccess ? 'check' : 'warn'} />
          </div>
        </div>
        <h2 style={{ marginBottom: 10, fontSize: 22 }}>
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

        <div style={{ display: 'flex', gap: 15, justifyContent: 'center' }}>
          <Link to="/profile/orders" className="btn primary">پیگیری سفارشات</Link>
          <Link to="/" className="btn outline">بازگشت به فروشگاه</Link>
        </div>
      </div>
    </div>
  );
}
