import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SvgSprite } from './components/Icon';
import { TableExcelExportManager } from './components/TableExcelExportManager';
import { useAuth } from './store/auth';
import { StorefrontPage } from './storefront/StorefrontPage';
import { ProductPage } from './storefront/ProductPage';
import { TermsPage } from './storefront/TermsPage';
import { OrdersPage } from './storefront/OrdersPage';
import { WalletPage } from './storefront/WalletPage';
import { CheckoutPage } from './storefront/CheckoutPage';
import { CreditPage } from './storefront/CreditPage';
import { AccountLayout } from './storefront/AccountLayout';
import { TelegramPage } from './storefront/TelegramPage';
import { DocumentRequestsPage } from './storefront/DocumentRequestsPage';

import { PaymentResultPage } from './storefront/PaymentResultPage';
import { captureAttribution } from './lib/attribution';
import { TelegramConnectPrompt } from './storefront/TelegramConnectPrompt';
import './storefront/customer-responsive.css';

/*
 * The admin panel is a lazy chunk. A shopper on a phone never downloads the
 * tables, editors and charts that only a manager needs.
 */
const AdminApp = lazy(() => import('./admin/AdminApp'));

function LegacyAccountRedirect({ target }: { target: string }) {
  const location = useLocation();
  return <Navigate to={`${target}${location.search}${location.hash}`} state={location.state} replace />;
}

function AdminLoadingSpinner() {
  const isLight = typeof window !== 'undefined' && localStorage.getItem('tamas_admin_theme') === 'light';

  return (
    <div className={`admin-loading-screen${isLight ? ' admin-loading-screen--light' : ''}`}>
      <div className="admin-loading-card" role="status" aria-live="polite">
        <div className="admin-loading-mark" aria-hidden="true">
          <svg fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <h2>در حال بارگذاری…</h2>
        <p>در حال دریافت اطلاعات پنل مدیریت</p>
      </div>
    </div>
  );
}

export function App() {
  const restore = useAuth((s) => s.restore);

  useEffect(() => {
    void restore();
    captureAttribution();
  }, [restore]);

  return (
    <>
      <SvgSprite />
      <TableExcelExportManager />
      <TelegramConnectPrompt />
      <Routes>
        <Route path="/" element={<StorefrontPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/account" element={<AccountLayout />}>
          <Route index element={<OrdersPage />} />
          <Route path="orders" element={<Navigate to="/account" replace />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="credit" element={<CreditPage />} />
          <Route path="telegram" element={<TelegramPage />} />
          <Route path="documents" element={<DocumentRequestsPage />} />
        </Route>
        <Route path="/orders" element={<LegacyAccountRedirect target="/account" />} />
        <Route path="/profile/orders" element={<LegacyAccountRedirect target="/account" />} />
        <Route path="/wallet" element={<LegacyAccountRedirect target="/account/wallet" />} />
        <Route path="/credit" element={<LegacyAccountRedirect target="/account/credit" />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/p/:productId" element={<ProductPage />} />
        <Route path="/admin/preview/p/:productId" element={<ProductPage adminPreview />} />
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
