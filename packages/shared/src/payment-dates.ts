const TEHRAN_TIME_ZONE = 'Asia/Tehran';

interface PersianParts { year: number; month: number; day: number }

function persianParts(date: Date): PersianParts {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: TEHRAN_TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function isoDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TEHRAN_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function formatPersianDueDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00+03:30`);
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: TEHRAN_TIME_ZONE, year: 'numeric', month: 'long', day: 'numeric',
  }).format(date);
}

/** First cheque is the same Jalali day plus five, after the configured month interval. */
export function chequeDueDate(orderDate: Date, installmentIndex: number, intervalMonths: number, termMonths?: number | null): string {
  const base = persianParts(orderDate);
  const regularOffset = Math.max(1, intervalMonths) * (installmentIndex + 1);
  const monthsToAdd = termMonths && termMonths > 0 ? Math.min(regularOffset, termMonths) : regularOffset;
  const absoluteMonth = (base.year * 12 + base.month - 1) + monthsToAdd;
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonth = absoluteMonth % 12 + 1;
  const maximumDay = targetMonth <= 6 ? 31 : 30;
  let targetDay = Math.min(maximumDay, base.day + 5);
  const limit = Math.max(80, monthsToAdd * 35 + 45);
  for (; targetDay >= 1; targetDay -= 1) {
    for (let offset = 1; offset <= limit; offset += 1) {
      const candidate = new Date(orderDate.getTime() + offset * 86_400_000);
      const parts = persianParts(candidate);
      if (parts.year === targetYear && parts.month === targetMonth && parts.day === targetDay) return isoDate(candidate);
    }
  }
  throw new Error('محاسبه تاریخ سررسید چک انجام نشد.');
}

/** Weekly credit always settles on the first Thursday after the order date. */
export function nextThursdayDueDate(orderDate: Date): string {
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = new Date(orderDate.getTime() + offset * 86_400_000);
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TEHRAN_TIME_ZONE, weekday: 'short' }).format(candidate);
    if (weekday === 'Thu') return isoDate(candidate);
  }
  throw new Error('محاسبه پنجشنبه سررسید انجام نشد.');
}

export function firstChequeSubmissionDeadline(orderDate: Date): Date {
  const fifthLocalDay = isoDate(new Date(orderDate.getTime() + 5 * 86_400_000));
  return new Date(`${fifthLocalDay}T23:59:59.999+03:30`);
}

/** Saturday-to-Saturday window used for the customer's aggregate weekly credit cap. */
export function tehranWeekWindow(value: Date): { start: Date; end: Date } {
  const localNoon = new Date(`${isoDate(value)}T12:00:00+03:30`);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TEHRAN_TIME_ZONE, weekday: 'short' }).format(localNoon);
  const daysSinceSaturday: Record<string, number> = { Sat: 0, Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6 };
  const startNoon = new Date(localNoon.getTime() - (daysSinceSaturday[weekday] ?? 0) * 86_400_000);
  const start = new Date(`${isoDate(startNoon)}T00:00:00+03:30`);
  return { start, end: new Date(start.getTime() + 7 * 86_400_000) };
}
