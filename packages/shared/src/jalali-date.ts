import { toAsciiDigits } from './phone.js';

export interface JalaliDateParts {
  year: string;
  month: string;
  day: string;
}

export function splitJalaliDate(value: string | null | undefined): JalaliDateParts {
  const ascii = toAsciiDigits(value ?? '').trim();
  const separated = ascii.split(/[-/.]/).map((part) => part.replace(/\D/g, ''));
  if (separated.length >= 3) {
    return {
      year: separated[0]?.slice(0, 4) ?? '',
      month: separated[1]?.slice(0, 2) ?? '',
      day: separated[2]?.slice(0, 2) ?? '',
    };
  }

  const digits = ascii.replace(/\D/g, '').slice(0, 8);
  return {
    year: digits.slice(0, 4),
    month: digits.slice(4, 6),
    day: digits.slice(6, 8),
  };
}

export function joinJalaliDate(parts: JalaliDateParts): string {
  if (!parts.year && !parts.month && !parts.day) return '';
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function normalizeJalaliDate(value: string | null | undefined): string {
  const parts = splitJalaliDate(value);
  if (!parts.year && !parts.month && !parts.day) return '';
  return joinJalaliDate({
    year: parts.year,
    month: parts.month.length === 1 ? `0${parts.month}` : parts.month,
    day: parts.day.length === 1 ? `0${parts.day}` : parts.day,
  });
}

export function currentJalaliYear(date = new Date()): number {
  const yearPart = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric',
    timeZone: 'Asia/Tehran',
  }).formatToParts(date).find((part) => part.type === 'year')?.value;
  return Number(yearPart) || 1500;
}

export function isValidJalaliDate(value: string | null | undefined, maxYear = currentJalaliYear()): boolean {
  const normalized = normalizeJalaliDate(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1200 || year > maxYear || month < 1 || month > 12 || day < 1) return false;

  const maximumDay = month <= 6 ? 31 : 30;
  return day <= maximumDay;
}
