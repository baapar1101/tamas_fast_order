export function clientErrorResponse(status: number): { ok: false; code: string; error: string } | null {
  const messages: Record<number, [string, string]> = {
    400: ['bad_request', 'ساختار درخواست معتبر نیست. ورودی‌ها را بررسی کنید.'],
    401: ['unauthorized', 'برای ادامه وارد حساب کاربری شوید.'],
    403: ['forbidden', 'شما به این بخش دسترسی ندارید.'],
    404: ['not_found', 'این آدرس وجود ندارد.'],
    413: ['payload_too_large', 'حجم فایل یا درخواست بیشتر از حد مجاز است.'],
    415: ['unsupported_media_type', 'فرمت درخواست یا فایل پشتیبانی نمی‌شود.'],
  };
  if (status < 400 || status >= 500) return null;
  const [code, error] = messages[status] ?? ['invalid_request', 'درخواست قابل پردازش نیست. ورودی‌ها را بررسی کنید.'];
  return { ok: false, code, error };
}
