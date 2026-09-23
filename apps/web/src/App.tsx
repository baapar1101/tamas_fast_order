import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SvgSprite } from './components/Icon';
import { useAuth } from './store/auth';
import { StorefrontPage } from './storefront/StorefrontPage';
import { ProductPage } from './storefront/ProductPage';
import { TermsPage } from './storefront/TermsPage';
import { OrdersPage } from './storefront/OrdersPage';

import { PaymentResultPage } from './storefront/PaymentResultPage';

/*
 * The admin panel is a lazy chunk. A shopper on a phone never downloads the
 * tables, editors and charts that only a manager needs.
 */
const AdminApp = lazy(() => import('./admin/AdminApp'));

function AdminLoadingSpinner() {
  // Retrieve theme for basic background styling before AdminApp mounts
  const isLight = typeof window !== 'undefined' && localStorage.getItem('tamas_admin_theme') === 'light';
  const bgColor = isLight ? '#cbd5e1' : '#030b14';
  const textColor = isLight ? '#0f172a' : '#ffffff';
  const subTextColor = isLight ? '#475569' : '#94a3b8';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', backgroundColor: bgColor, transition: 'background-color 0.3s' }}>
      <div className="glass-card-static" style={{ maxWidth: '24rem', width: '100%', padding: '2.5rem 2rem', textAlign: 'center', position: 'relative', zIndex: 10, background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '1rem', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)' }}>
        <div className="shimmer-line animate-shimmer" style={{ position: 'absolute', insetInline: 0, top: 0, height: '1px' }} />

        <div style={{
          margin: '0 auto 1.5rem',
          width: '5rem',
          height: '5rem',
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative'
        }}>
          <svg className="h-8 w-8 animate-spin" style={{ color: textColor }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div className="absolute inset-0 rounded-full animate-ping border-2 border-white/20"></div>
        </div>

        <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: textColor, marginBottom: '0.5rem' }}>
          در حال بارگذاری...
        </h2>
        <p style={{ fontSize: '0.8rem', color: subTextColor, lineHeight: '1.75' }}>
          درحال دریافت اطلاعات پنل ادمین
        </p>
      </div>
    </div>
  );
}

export function App() {
  const restore = useAuth((s) => s.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  return (
    <>
      <SvgSprite />
      <Routes>
        <Route path="/" element={<StorefrontPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/p/:productId" element={<ProductPage />} />
        <Route path="/payment/result" element={<PaymentResultPage />} />
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<AdminLoadingSpinner />}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
