import { ORIGIN } from "./domain";
let token: string | null = null;
let expired: (() => void) | undefined;
export const session = {
  token: () => token,
  set: (v: string | null) => {
    token = v;
  },
  onExpired: (fn: () => void) => {
    expired = fn;
  },
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
type Options = {
  method?: string;
  body?: unknown;
  form?: FormData;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};
export async function request<T>(
  path: string,
  options: Options = {},
): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://"))
    throw new Error("مسیر نامعتبر");
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(options.query || {}))
    if (v !== undefined && v !== "") params.set(k, String(v));
  const capturedToken = token;
  const abort = new AbortController();
  const timer = setTimeout(
    () => abort.abort(),
    options.form ? 120_000 : 25_000,
  );
  const cancel = () => abort.abort();
  options.signal?.addEventListener("abort", cancel);
  try {
    if (options.signal?.aborted) abort.abort();
    const res = await fetch(
      `${ORIGIN}/api${path}${params.size ? "?" + params : ""}`,
      {
        method: options.method || "GET",
        signal: abort.signal,
        credentials: "omit",
        headers: {
          Accept: "application/json",
          ...(capturedToken
            ? { Authorization: `Bearer ${capturedToken}` }
            : {}),
          ...(options.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
          ...options.headers,
        },
        body:
          options.form ??
          (options.body === undefined
            ? undefined
            : JSON.stringify(options.body)),
      },
    );
    const data = await res.json().catch(() => {
      throw new ApiError(
        "پاسخ سرور معتبر نیست.",
        res.status,
        "invalid_response",
      );
    });
    if (res.status === 401 && token === capturedToken && capturedToken)
      expired?.();
    if (!res.ok || data.ok === false)
      throw new ApiError(
        data.error || data.message || "انجام درخواست ناموفق بود.",
        res.status,
        data.code || "request_failed",
      );
    // Responses belonging to a previous account must never enter its replacement's cache.
    if (capturedToken !== token)
      throw new ApiError("حساب کاربری تغییر کرده است.", 409, "session_changed");
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (options.signal?.aborted) throw e;
    throw new ApiError(
      "ارتباط با سرور برقرار نشد؛ اینترنت را بررسی و دوباره تلاش کنید.",
      0,
      "network_error",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}
export const api = {
  get: <T>(p: string, query?: Options["query"], signal?: AbortSignal) =>
    request<T>(p, { query, signal }),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "POST", body }),
  put: <T>(p: string, body?: unknown) => request<T>(p, { method: "PUT", body }),
  del: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "DELETE", body }),
  upload: <T>(p: string, form: FormData) =>
    request<T>(p, { method: "POST", form }),
};
