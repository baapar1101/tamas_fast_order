import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SvgSprite } from './components/Icon';
import { useAuth } from './store/auth';
import { StorefrontPage } from './storefront/StorefrontPage';
import { TermsPage } from './storefront/TermsPage';
import { OrdersPage } from './storefront/OrdersPage';

/*
 * The admin panel is a lazy chunk. A shopper on a phone never downloads the
 * tables, editors and charts that only a manager needs.
 */
const AdminApp = lazy(() => import('./admin/AdminApp'));

function FullPageSpinner() {
  return (
    <div className="empty" style={{ paddingBlock: 120 }}>
      در حال بارگذاری…
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
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<FullPageSpinner />}>
              <AdminApp />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
