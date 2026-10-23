const VERSION_CHECK_INTERVAL_MS = 30_000;
const VERSION_CHECK_THROTTLE_MS = 5_000;
const RELOAD_RETRY_MS = 30_000;
const VERSION_QUERY_PARAM = '__tmv';
const RELOAD_STATE_KEY = 'tamas-market:forced-update';

type VersionManifest = {
  buildTime?: number;
};

type ReloadState = {
  buildTime: number;
  attemptedAt: number;
};

let lastCheckAt = 0;
let updateInProgress = false;
let availableBuild: number | null = null;
const updateListeners = new Set<(build: number) => void>();

export function subscribeAppUpdates(listener: (build: number) => void): () => void {
  updateListeners.add(listener);
  if (availableBuild !== null) listener(availableBuild);
  return () => { updateListeners.delete(listener); };
}

export function notifyAppUpdate(build = Date.now()): void {
  availableBuild = build;
  for (const listener of updateListeners) listener(build);
}

function readReloadState(): ReloadState | null {
  try {
    const value = sessionStorage.getItem(RELOAD_STATE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<ReloadState>;
    if (typeof parsed.buildTime !== 'number' || typeof parsed.attemptedAt !== 'number') return null;
    return { buildTime: parsed.buildTime, attemptedAt: parsed.attemptedAt };
  } catch {
    return null;
  }
}

function writeReloadState(buildTime: number): void {
  try {
    sessionStorage.setItem(RELOAD_STATE_KEY, JSON.stringify({ buildTime, attemptedAt: Date.now() }));
  } catch {
    // Private browsing can make sessionStorage unavailable. Reload still works.
  }
}

async function clearObsoleteBrowserCaches(): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if ('serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.filter((registration) => {
          const script = registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? registration.installing?.scriptURL;
          return script && new URL(script).origin === location.origin && new URL(script).pathname === '/sw.js';
        }).map((registration) => registration.unregister())),
      ),
    );
  }

  if ('caches' in window) {
    tasks.push(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith('tamas-') || name.startsWith('tamasmarket-')).map((name) => caches.delete(name)))));
  }

  await Promise.allSettled(tasks);
}

function buildReloadUrl(buildTime: number): string {
  const url = new URL(window.location.href);
  url.searchParams.set(VERSION_QUERY_PARAM, String(buildTime));
  return url.toString();
}

function removeCurrentVersionMarker(): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get(VERSION_QUERY_PARAM) !== String(__BUILD_TIME__)) return;

  url.searchParams.delete(VERSION_QUERY_PARAM);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  try {
    sessionStorage.removeItem(RELOAD_STATE_KEY);
  } catch {
    // Ignore unavailable sessionStorage.
  }
}

export async function forceReloadLatestApp(serverBuildTime = Date.now()): Promise<void> {
  if (updateInProgress) return;

  const previousAttempt = readReloadState();
  if (
    previousAttempt?.buildTime === serverBuildTime &&
    Date.now() - previousAttempt.attemptedAt < RELOAD_RETRY_MS
  ) {
    return;
  }

  updateInProgress = true;
  writeReloadState(serverBuildTime);
  await clearObsoleteBrowserCaches();
  window.location.replace(buildReloadUrl(serverBuildTime));
}

export async function checkForAppUpdate(): Promise<void> {
  const now = Date.now();
  if (updateInProgress || now - lastCheckAt < VERSION_CHECK_THROTTLE_MS) return;
  lastCheckAt = now;

  try {
    const response = await fetch(`/version.json?t=${now}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (!response.ok) return;

    const manifest = (await response.json()) as VersionManifest;
    if (typeof manifest.buildTime === 'number' && manifest.buildTime !== __BUILD_TIME__) {
      notifyAppUpdate(manifest.buildTime);
    }
  } catch {
    // Offline or short-lived network failures should not interrupt the app.
  }
}

export function installForcedAppUpdates(): () => void {
  removeCurrentVersionMarker();

  const checkWhenVisible = () => {
    if (document.visibilityState === 'visible') void checkForAppUpdate();
  };
  const checkNow = () => void checkForAppUpdate();

  document.addEventListener('visibilitychange', checkWhenVisible);
  window.addEventListener('focus', checkNow);
  window.addEventListener('online', checkNow);
  window.addEventListener('pageshow', checkNow);

  void checkForAppUpdate();
  const intervalId = window.setInterval(checkForAppUpdate, VERSION_CHECK_INTERVAL_MS);

  return () => {
    document.removeEventListener('visibilitychange', checkWhenVisible);
    window.removeEventListener('focus', checkNow);
    window.removeEventListener('online', checkNow);
    window.removeEventListener('pageshow', checkNow);
    window.clearInterval(intervalId);
  };
}
