import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { ApiRequestError } from './lib/api';
import { useAuth } from './store/auth';
import { notifyAppUpdate, installForcedAppUpdates } from './lib/forceAppUpdate';
import { AppUpdatePrompt } from './components/AppUpdatePrompt';
import './styles/design-system.css';
import './styles/global.css';
import './styles/platform-ui.css';

// Offer long-lived tabs the latest version without discarding an unfinished form.
if (import.meta.env.PROD) installForcedAppUpdates();

// Missing hashed chunks are another signal that a newer deployment is live.
const handleChunkError = (errorMsg: string) => {
  if (
    errorMsg.includes('Failed to fetch dynamically imported module') ||
    errorMsg.includes('Importing a module script failed') ||
    errorMsg.includes('ChunkLoadError')
  ) {
    console.warn('New app version detected due to missing chunk. Update offered to the user.');
    notifyAppUpdate();
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

// A shared browser may log into several accounts. Discard both cached private
// data and in-flight requests before subscribers render the new identity.
useAuth.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id || state.user?.role !== previous.user?.role) {
    void queryClient.cancelQueries();
    queryClient.clear();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <App />
          <AppUpdatePrompt />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
