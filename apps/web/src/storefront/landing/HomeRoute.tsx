import { Suspense, lazy } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { parseLandingConfig } from '@tamas/shared';
import { readToken } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { useBootstrap } from '../hooks';
import { SHOP_PATH, hasCatalogParams } from './shopLinks';

const loadLanding = () => import('./LandingPage');
const LandingPage = lazy(() => loadLanding().then((module) => ({ default: module.LandingPage })));

// Opening the site on the home address: fetch the landing alongside the app
// instead of after it, so the first paint does not wait for a second request.
if (typeof window !== 'undefined' && window.location.pathname === '/') void loadLanding();

/** Dark placeholder in the hero's colour while settings or the landing load. */
function LandingSplash() {
  return <div style={{ minHeight: '100vh', background: '#070c14' }} aria-busy="true" />;
}

/**
 * The home address. Catalog links (`/?brand=…`, `/?tab=cart`, `/#cart`) keep
 * working by moving to the catalog; approved partners can skip straight to
 * it; everyone else sees the landing page the admin configured.
 */
export function HomeRoute() {
  const location = useLocation();
  const bootstrap = useBootstrap();
  const { user, ready } = useAuth();
  const toShop = <Navigate to={`${SHOP_PATH}${location.search}${location.hash}`} state={location.state} replace />;

  if (hasCatalogParams(location.search) || location.hash === '#cart') return toShop;
  if (bootstrap.isPending) return <LandingSplash />;
  const config = parseLandingConfig(bootstrap.data?.settings.landing_page);
  if (bootstrap.isError || !config.enabled) return toShop;
  if (config.partnersSkipLanding) {
    if (!ready && readToken()) return <LandingSplash />;
    if (user?.isActive) return toShop;
  }

  return (
    <Suspense fallback={<LandingSplash />}>
      <LandingPage config={config} />
    </Suspense>
  );
}
