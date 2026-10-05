import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import { ApiRequestError } from './lib/api';
import './styles/global.css';

// 1. Automatically unregister any active Service Workers and clear browser CacheStorage
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
}

if ('caches' in window) {
  caches.keys().then((names) => {
    for (const name of names) {
      caches.delete(name);
    }
  }).catch(() => {});
}

// 2. Handle missing chunk errors gracefully after a new build/deployment
const handleChunkError = (errorMsg: string) => {
  if (
    errorMsg.includes('Failed to fetch dynamically imported module') ||
    errorMsg.includes('Importing a module script failed') ||
    errorMsg.includes('ChunkLoadError')
  ) {
    console.warn('New app version detected due to missing chunk. Reloading page...');
    window.location.reload();
  }
};

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = typeof reason === 'string' ? reason : reason?.message || '';
  handleChunkError(message);
});

window.addEventListener('error', (event) => {
  handleChunkError(event.message || '');
});

// 3. Auto-check app version on build updates
if (import.meta.env.PROD) {
  let lastCheckTime = 0;
  const checkAppVersion = async () => {
    const now = Date.now();
    if (now - lastCheckTime < 10_000) return; // Limit checks to once per 10s
    lastCheckTime = now;

    try {
      const res = await fetch(`/version.json?t=${now}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (typeof __BUILD_TIME__ !== 'undefined' && data.buildTime && data.buildTime !== __BUILD_TIME__) {
          console.log('New version detected on server. Refreshing...');
          window.location.reload();
        }
      }
    } catch (e) {
      // Ignore network errors during background check
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAppVersion();
    }
  });

  checkAppVersion();
  setInterval(checkAppVersion, 3 * 60 * 1000); // Check every 3 minutes
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // A rejected request is rejected; only flaky transport is worth retrying.
        if (error instanceof ApiRequestError && error.status !== 0) return false;
        return failureCount < 2;
      },
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
