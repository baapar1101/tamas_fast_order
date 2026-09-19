/**
 * One place that knows how to talk to the API: attaches the session token,
 * unwraps the `{ ok, ... }` envelope, and turns every failure into an
 * `ApiRequestError` carrying the Persian message the server already produced.
 */

const TOKEN_KEY = 'tamas_auth_token';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly payload: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }

  /** The session is gone and the user has to sign in again. */
  get isExpired(): boolean {
    return this.status === 401 || this.payload.expired === true;
  }

  /** Required profile fields the server is still waiting for. */
  get missingFields(): string[] {
    return Array.isArray(this.payload.missing) ? (this.payload.missing as string[]) : [];
  }
}

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode — the session simply will not survive a reload */
  }
}

type Query = Record<string, string | number | boolean | string[] | undefined | null>;

function toSearch(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** FormData for uploads; the browser sets its own multipart boundary. */
  form?: FormData;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, form, signal } = options;
  const headers: Record<string, string> = {};
  const token = readToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`/api${path}${toSearch(query)}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
      credentials: 'same-origin',
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiRequestError('ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.', 0, 'network_error');
  }

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }

  if (!res.ok || data.ok === false) {
    const { error, code, ...rest } = data;
    throw new ApiRequestError(
      typeof error === 'string' && error ? error : 'خطای غیرمنتظره‌ای رخ داد.',
      res.status,
      typeof code === 'string' ? code : 'error',
      rest,
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string, query?: Query) => request<T>(path, { method: 'DELETE', query }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', form }),
  /** Downloads a CSV the API generated, honouring the session token. */
  async download(path: string, query: Query, filename: string): Promise<void> {
    const token = readToken();
    const res = await fetch(`/api${path}${toSearch(query)}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiRequestError('دریافت فایل ناموفق بود.', res.status, 'download_failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
