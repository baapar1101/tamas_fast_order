import { create } from 'zustand';
import type { UserDTO } from '@tamas/shared';
import { ApiRequestError, api, readToken, writeToken } from '../lib/api';

interface AuthResponse {
  token: string;
  user: UserDTO;
  complete: boolean;
  missing: string[];
  isNew: boolean;
}

interface MeResponse {
  user: UserDTO;
  complete: boolean;
  missing: string[];
}

interface AuthState {
  user: UserDTO | null;
  complete: boolean;
  missing: string[];
  /** False until the stored token has been checked against the server. */
  ready: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  hasPermission: (permission: string) => boolean;
  restore: () => Promise<void>;
  applyLogin: (data: AuthResponse) => void;
  applyProfile: (data: MeResponse) => void;
  logout: () => Promise<void>;
  clear: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  complete: false,
  missing: [],
  ready: false,
  isAdmin: false,
  isOperator: false,
  hasPermission: () => false,

  /** Called once on boot; a dead token is discarded rather than surfaced. */
  async restore() {
    if (!readToken()) {
      set({ user: null, complete: false, missing: [], isAdmin: false, isOperator: false, hasPermission: () => false, ready: true });
      return;
    }

    const apply = (data: MeResponse) => {
      set({
        user: data.user,
        complete: data.complete,
        missing: data.missing,
        isAdmin: data.user.role === 'admin',
        isOperator: data.user.role === 'operator',
        hasPermission: (p: string) =>
          data.user.role === 'admin' || (data.user.role === 'operator' && !!(data.user.permissions?.includes(p) || data.user.permissions?.includes('*'))),
        ready: true,
      });
    };
    const reject = (err: unknown) => {
      if (err instanceof ApiRequestError && err.isExpired) writeToken(null);
      set({ user: null, complete: false, missing: [], isAdmin: false, isOperator: false, hasPermission: () => false, ready: true });
    };

    // A transient backend hiccup (500 through the proxy / a dev-server
    // restart that lasts a few seconds) must not bounce a logged-in admin to
    // the gate. Retry with backoff for a patient window; only a definite 401
    // (expired/revoked token) gives up immediately.
    const started = Date.now();
    const MAX_WAIT = 30_000;
    let delay = 700;
    for (;;) {
      try {
        apply(await api.get<MeResponse>('/auth/me'));
        return;
      } catch (err) {
        const expired = err instanceof ApiRequestError && err.isExpired;
        if (expired || Date.now() - started >= MAX_WAIT) {
          reject(err);
          return;
        }
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(3000, Math.round(delay * 1.6));
      }
    }
  },

  applyLogin(data) {
    writeToken(data.token);
    set({
      user: data.user,
      complete: data.complete,
      missing: data.missing,
      isAdmin: data.user.role === 'admin',
      isOperator: data.user.role === 'operator',
      hasPermission: (p: string) => 
        data.user.role === 'admin' || (data.user.role === 'operator' && !!(data.user.permissions?.includes(p) || data.user.permissions?.includes('*'))),
      ready: true,
    });
  },

  applyProfile(data) {
    set({
      user: data.user,
      complete: data.complete,
      missing: data.missing,
      isAdmin: data.user.role === 'admin',
      isOperator: data.user.role === 'operator',
      hasPermission: (p: string) => 
        data.user.role === 'admin' || (data.user.role === 'operator' && !!(data.user.permissions?.includes(p) || data.user.permissions?.includes('*'))),
    });
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      /* the local session is cleared either way */
    }
    writeToken(null);
    set({ user: null, complete: false, missing: [], isAdmin: false, isOperator: false, hasPermission: () => false });
  },

  clear() {
    writeToken(null);
    set({ user: null, complete: false, missing: [], isAdmin: false, isOperator: false, hasPermission: () => false });
  },
}));
