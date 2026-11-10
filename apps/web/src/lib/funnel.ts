import type { FunnelEventType } from '@tamas/shared';
import { readToken } from './api';

/**
 * Sales-funnel tracking: a handful of storefront steps per visit, batched and
 * sent in the background. It must never slow the shop down or throw, so every
 * storage access and request is best-effort.
 */

const VISITOR_KEY = 'tamas_visitor_id';
const ONCE_KEY = 'tamas_funnel_once';
const FLUSH_DELAY_MS = 2_500;
const MAX_BATCH = 20;

interface QueuedEvent {
  type: FunnelEventType;
  productId?: string;
  path?: string;
}

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let memoryVisitorId: string | null = null;
const memoryOnce = new Set<string>();

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function visitorId(): string {
  if (memoryVisitorId) return memoryVisitorId;
  try {
    const stored = localStorage.getItem(VISITOR_KEY);
    if (stored && /^[A-Za-z0-9-]{8,40}$/.test(stored)) {
      memoryVisitorId = stored;
      return stored;
    }
    const created = randomId();
    localStorage.setItem(VISITOR_KEY, created);
    memoryVisitorId = created;
    return created;
  } catch {
    memoryVisitorId = randomId();
    return memoryVisitorId;
  }
}

/** True the first time `key` is seen in this browser tab. */
function firstInTab(key: string): boolean {
  if (memoryOnce.has(key)) return false;
  memoryOnce.add(key);
  try {
    const seen = new Set<string>(JSON.parse(sessionStorage.getItem(ONCE_KEY) ?? '[]') as string[]);
    if (seen.has(key)) return false;
    seen.add(key);
    sessionStorage.setItem(ONCE_KEY, JSON.stringify([...seen].slice(-300)));
  } catch {
    // Without sessionStorage the in-memory set still de-duplicates this page load.
  }
  return true;
}

function isStaffPage(): boolean {
  return typeof location !== 'undefined' && (location.pathname.startsWith('/admin') || location.pathname.includes('/admin/'));
}

export function flushFunnel(useKeepalive = false): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const events = queue.splice(0, MAX_BATCH);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = readToken();
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    void fetch('/api/funnel/events', {
      method: 'POST',
      headers,
      body: JSON.stringify({ visitorId: visitorId(), events }),
      credentials: 'same-origin',
      keepalive: useKeepalive,
    }).catch(() => undefined);
  } catch {
    // Tracking is never allowed to break the page.
  }
  if (queue.length) schedule();
}

function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => flushFunnel(), FLUSH_DELAY_MS);
}

/**
 * Records one funnel step. `once` limits it to one report per tab session for
 * the same step and product, so refreshing a page doesn't inflate the numbers.
 */
export function trackFunnel(type: FunnelEventType, options: { productId?: string; once?: boolean } = {}): void {
  if (typeof window === 'undefined' || isStaffPage()) return;
  const path = location.pathname;
  if (options.once !== false && type !== 'add_to_cart') {
    const key = `${type}:${options.productId ?? (type === 'scroll' ? path : '')}`;
    if (!firstInTab(key)) return;
  }
  queue.push({ type, productId: options.productId, path });
  if (queue.length >= MAX_BATCH) flushFunnel();
  else schedule();
}

let listenersInstalled = false;

/** Sends what's queued when the tab is hidden or closed. */
export function installFunnelFlushOnHide(): void {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;
  const onHide = () => flushFunnel(true);
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });
}

export function resetFunnelForTests(): void {
  queue = [];
  if (timer) clearTimeout(timer);
  timer = null;
  memoryOnce.clear();
  memoryVisitorId = null;
}

export function pendingFunnelEvents(): readonly QueuedEvent[] {
  return queue;
}
