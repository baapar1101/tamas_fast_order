import { describe, it, expect } from 'vitest';
import { normalizePhone, toAsciiDigits, isValidPhone, normalizeLandline } from '../src/phone';

describe('phone utilities', () => {
  describe('toAsciiDigits', () => {
    it('should convert Persian digits to ASCII', () => {
      expect(toAsciiDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    });

    it('should convert Arabic digits to ASCII', () => {
      expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    });

    it('should leave ASCII digits unchanged', () => {
      expect(toAsciiDigits('0123456789')).toBe('0123456789');
    });

    it('should handle mixed strings', () => {
      expect(toAsciiDigits('09۱۲3٤5')).toBe('0912345');
    });

    it('should handle non-string/null/undefined inputs safely', () => {
      expect(toAsciiDigits(null)).toBe('');
      expect(toAsciiDigits(undefined)).toBe('');
      expect(toAsciiDigits(123)).toBe('123');
    });
  });

  describe('normalizePhone', () => {
    it('should replace non-digit characters', () => {
      expect(normalizePhone('0912 345 6789')).toBe('09123456789');
      // '+98-912-345-6789' becomes '989123456789' before slice, which is 12 long and starts with 98.
      // Then slice(2) becomes '9123456789'.
      // Then length 10 starting with '9' becomes '09123456789'.
      expect(normalizePhone('+98-912-345-6789')).toBe('09123456789');
    });

    it('should strip 0098 prefix', () => {
      expect(normalizePhone('00989123456789')).toBe('09123456789');
    });

    it('should strip 98 prefix if length is 12', () => {
      expect(normalizePhone('989123456789')).toBe('09123456789');
    });

    it('should add 0 prefix if length is 10 and starts with 9', () => {
      expect(normalizePhone('9123456789')).toBe('09123456789');
    });

    it('should normalize standard format correctly', () => {
      expect(normalizePhone('09123456789')).toBe('09123456789');
    });

    it('should normalize Persian/Arabic digits correctly', () => {
      expect(normalizePhone('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
      expect(normalizePhone('٠٩١٢٣٤٥٦٧٨٩')).toBe('09123456789');
      expect(normalizePhone('+۹۸۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
      expect(normalizePhone('۰۰۹۸۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    });

    it('should handle invalid/too short strings by just removing non-digits', () => {
       expect(normalizePhone('123')).toBe('123');
    });
  });

  describe('isValidPhone', () => {
    it('should return true for valid formats', () => {
      expect(isValidPhone('09123456789')).toBe(true);
      expect(isValidPhone('9123456789')).toBe(true);
      expect(isValidPhone('+989123456789')).toBe(true);
      expect(isValidPhone('00989123456789')).toBe(true);
      expect(isValidPhone('۰۹۱۲۳۴۵۶۷۸۹')).toBe(true);
    });

    it('should return false for invalid formats', () => {
      expect(isValidPhone('08123456789')).toBe(false); // Does not start with 09
      expect(isValidPhone('0912345678')).toBe(false); // Too short
      expect(isValidPhone('091234567890')).toBe(false); // Too long
      expect(isValidPhone('abc')).toBe(false);
      expect(isValidPhone(null)).toBe(false);
    });
  });

  describe('normalizeLandline', () => {
    it('should remove non-digit characters', () => {
      expect(normalizeLandline('021-12345678')).toBe('02112345678');
    });

    it('should convert Persian/Arabic digits to ASCII', () => {
      expect(normalizeLandline('۰۲۱۱۲۳۴۵۶۷۸')).toBe('02112345678');
      expect(normalizeLandline('٠٢١١٢٣٤٥٦٧٨')).toBe('02112345678');
    });
  });
});
