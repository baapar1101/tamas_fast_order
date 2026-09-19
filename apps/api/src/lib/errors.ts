/** Errors that are safe to show a shopper, in Persian, with an HTTP status. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly extra: Record<string, unknown>;

  constructor(message: string, statusCode = 400, code = 'bad_request', extra: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.extra = extra;
  }
}

export const badRequest = (msg: string, extra?: Record<string, unknown>) =>
  new AppError(msg, 400, 'bad_request', extra);

export const unauthorized = (msg = 'نشست شما منقضی شده است. دوباره وارد شوید.') =>
  new AppError(msg, 401, 'unauthorized', { expired: true });

export const forbidden = (msg = 'دسترسی لازم را ندارید.') => new AppError(msg, 403, 'forbidden');

export const notFound = (msg = 'موردی پیدا نشد.') => new AppError(msg, 404, 'not_found');

export const conflict = (msg: string, extra?: Record<string, unknown>) =>
  new AppError(msg, 409, 'conflict', extra);

export const tooMany = (msg = 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد تلاش کنید.') =>
  new AppError(msg, 429, 'too_many_requests');

export const profileIncomplete = (missing: string[]) =>
  new AppError('برای ادامه، اطلاعات حساب خود را تکمیل کنید.', 422, 'profile_incomplete', {
    missing,
    complete: false,
  });
