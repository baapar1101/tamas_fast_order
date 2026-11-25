import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UserDTO } from '@tamas/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../store/auth';

interface AuthResponse {
  token: string;
  user: UserDTO;
  complete: boolean;
  missing: string[];
  isNew: boolean;
}

/**
 * Username/password sign-in for the admin panel, shown only when the server
 * has ADMIN_LOGIN_USERNAME and ADMIN_LOGIN_PASSWORD set. Useful when SMS
 * codes cannot be delivered.
 */
export function AdminPasswordLogin() {
  const applyLogin = useAuth((state) => state.applyLogin);
  const enabled = useQuery({
    queryKey: ['auth', 'admin-login-enabled'],
    queryFn: () => api.get<{ enabled: boolean }>('/auth/admin/login'),
    staleTime: 60_000,
    retry: false,
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!enabled.data?.enabled) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('نام کاربری و رمز عبور را وارد کنید.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      applyLogin(await api.post<AuthResponse>('/auth/admin/login', { username, password }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ورود ناموفق بود.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="admin-password-login" aria-label="ورود مدیر با نام کاربری و رمز">
      <input
        className="a-input"
        dir="ltr"
        autoComplete="username"
        placeholder="نام کاربری"
        aria-label="نام کاربری"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />
      <input
        className="a-input"
        dir="ltr"
        type="password"
        autoComplete="current-password"
        placeholder="رمز عبور"
        aria-label="رمز عبور"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error && <div className="a-alert a-alert--error" role="alert">{error}</div>}
      <button type="submit" className="huma-btn-primary admin-entry-action" disabled={busy} aria-busy={busy || undefined}>
        {busy ? 'در حال ورود…' : 'ورود به پنل مدیریت'}
      </button>
    </form>
  );
}
