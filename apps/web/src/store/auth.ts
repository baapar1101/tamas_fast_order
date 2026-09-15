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

  /** Called once on boot; a dead token is discarded rather than surfaced. */
  async restore() {
    // TEMPORARY BYPASS FOR UI PREVIEW (Localhost only)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!readToken() || isLocalhost) {
      set({
        user: { id: 'preview-id', phone: '09123456789', role: 'admin', name: 'مدیر', lastName: 'سیستم', isActive: true } as any,
        complete: true,
        missing: [],
        isAdmin: true,
        ready: true
      });
      return;
    }
    try {
      const data = await api.get<MeResponse>('/auth/me');
      set({
        user: data.user,
        complete: data.complete,
        missing: data.missing,
        isAdmin: data.user.role === 'admin',
        ready: true,
      });
    } catch (err) {
      if (err instanceof ApiRequestError && err.isExpired) writeToken(null);
      set({ user: null, complete: false, missing: [], isAdmin: false, ready: true });
    }
  },

  applyLogin(data) {
    writeToken(data.token);
    set({
      user: data.user,
      complete: data.complete,
      missing: data.missing,
      isAdmin: data.user.role === 'admin',
      ready: true,
    });
  },

  applyProfile(data) {
    set({
      user: data.user,
      complete: data.complete,
      missing: data.missing,
      isAdmin: data.user.role === 'admin',
    });
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      /* the local session is cleared either way */
    }
    writeToken(null);
    set({ user: null, complete: false, missing: [], isAdmin: false });
  },

  clear() {
    writeToken(null);
    set({ user: null, complete: false, missing: [], isAdmin: false });
  },
}));
