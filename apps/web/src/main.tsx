import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import { ApiRequestError } from './lib/api';
import { forceReloadLatestApp, installForcedAppUpdates } from './lib/forceAppUpdate';
import './styles/global.css';

// Keep long-lived tabs on the currently deployed version. A mismatched build
// gets a cache-busted navigation, so a normal reload cannot restore stale HTML.
if (import.meta.env.PROD) installForcedAppUpdates();

// Missing hashed chunks are another signal that a newer deployment is live.
const handleChunkError = (errorMsg: string) => {
  if (
    errorMsg.includes('Failed to fetch dynamically imported module') ||
    errorMsg.includes('Importing a module script failed') ||
    errorMsg.includes('ChunkLoadError')
  ) {
    console.warn('New app version detected due to missing chunk. Updating...');
    void forceReloadLatestApp();
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
