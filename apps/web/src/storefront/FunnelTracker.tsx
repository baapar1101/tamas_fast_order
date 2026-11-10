import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { SavedCartLineDTO } from '@tamas/shared';
import { api } from '../lib/api';
import { installFunnelFlushOnHide, trackFunnel } from '../lib/funnel';
import { useAuth } from '../store/auth';
import { useCart, type CartLine } from '../store/cart';

const CART_SYNC_DELAY_MS = 1_500;

function isShopPath(pathname: string): boolean {
  return !pathname.startsWith('/admin') && !pathname.startsWith('/payment/');
}

function isBrowsePath(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/p/');
}

function toSaved(line: CartLine): SavedCartLineDTO {
  return {
    key: line.key,
    productId: line.productId,
    title: line.title.slice(0, 400),
    color: line.color,
    colorCode: line.colorCode,
    imageUrl: line.imageUrl,
    price: Math.max(0, Math.round(line.price)),
    qty: line.qty,
    warehouse: line.warehouse,
    maxStock: Math.max(0, Math.round(line.maxStock)),
  };
}

/**
 * Invisible helper mounted once in the app shell: reports funnel steps that
 * don't belong to a single page (visit, scrolling) and keeps the logged-in
 * customer's cart on the server, so it follows them across devices and an
 * abandoned cart can be followed up.
 */
export function FunnelTracker() {
  const { pathname } = useLocation();
  const userId = useAuth((state) => state.user?.id ?? null);
  const isCustomer = useAuth((state) => state.user?.role === 'customer');
  const syncReady = useRef(false);

  useEffect(() => installFunnelFlushOnHide(), []);

  useEffect(() => {
    if (isShopPath(pathname)) trackFunnel('visit');
  }, [pathname]);

  // Scrolling past about one screen of products counts as browsing the catalog.
  useEffect(() => {
    if (!isBrowsePath(pathname)) return undefined;
    const onScroll = (event: Event) => {
      const target = event.target;
      const scroller = target === document || target === document.body || target === document.documentElement
        ? Math.max(document.documentElement.scrollTop, document.body.scrollTop, window.scrollY)
        : null;
      if (scroller != null && scroller > window.innerHeight * 1.2) {
        trackFunnel('scroll');
        document.removeEventListener('scroll', onScroll, true);
      }
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', onScroll, true);
  }, [pathname]);

  // On login: bring back a cart saved from another device when this one is empty.
  useEffect(() => {
    syncReady.current = false;
    if (!userId || !isCustomer) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        if (useCart.getState().lines.length === 0) {
          const { items } = await api.get<{ items: SavedCartLineDTO[] }>('/funnel/cart');
          if (!cancelled && items.length && useCart.getState().lines.length === 0) {
            useCart.setState({ lines: items.map((item) => ({ ...item })) });
          }
        }
      } catch {
        // A missing saved cart is not an error worth showing.
      }
      if (cancelled) return;
      syncReady.current = true;
      void api.put('/funnel/cart', { items: useCart.getState().lines.map(toSaved) }).catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isCustomer]);

  // Mirror every cart change to the server (debounced).
  useEffect(() => {
    if (!userId || !isCustomer) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useCart.subscribe((state, previous) => {
      if (state.lines === previous.lines || !syncReady.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void api.put('/funnel/cart', { items: useCart.getState().lines.map(toSaved) }).catch(() => undefined);
      }, CART_SYNC_DELAY_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [userId, isCustomer]);

  return null;
}
