import { describe, expect, it } from 'vitest';
import { toAsciiDigits, normalizePhone, isValidPhone } from './phone';

describe('phone module', () => {
  describe('toAsciiDigits', () => {
    it('should convert Persian digits to ASCII', () => {
      expect(toAsciiDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    });

    it('should convert Arabic digits to ASCII', () => {
      expect(toAsciiDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    });

    it('should handle mixed digits correctly', () => {
      expect(toAsciiDigits('٠١٢345۶۷۸9')).toBe('0123456789');
    });

    it('should handle non-digit characters correctly', () => {
      expect(toAsciiDigits('hello ۰۱۲')).toBe('hello 012');
    });

    it('should handle null, undefined, and numbers correctly', () => {
      expect(toAsciiDigits(null)).toBe('');
      expect(toAsciiDigits(undefined)).toBe('');
      expect(toAsciiDigits(12345)).toBe('12345');
    });
  });

  describe('normalizePhone', () => {
    it('should normalize standard format correctly', () => {
      expect(normalizePhone('09123456789')).toBe('09123456789');
    });

    it('should normalize +98 format correctly', () => {
      expect(normalizePhone('+989123456789')).toBe('09123456789');
    });

    it('should normalize 0098 format correctly', () => {
      expect(normalizePhone('00989123456789')).toBe('09123456789');
    });

    it('should normalize 98 format correctly', () => {
      expect(normalizePhone('989123456789')).toBe('09123456789');
    });

    it('should normalize without zero format correctly', () => {
      expect(normalizePhone('9123456789')).toBe('09123456789');
    });

    it('should normalize persian digits correctly', () => {
      expect(normalizePhone('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    });

    it('should normalize arabic digits correctly', () => {
      expect(normalizePhone('٠٩١٢٣٤٥٦٧٨٩')).toBe('09123456789');
    });

    it('should strip non-digits', () => {
      expect(normalizePhone('0912-345-6789')).toBe('09123456789');
    });
  });

  describe('isValidPhone', () => {
    it('should return true for valid phone numbers', () => {
      expect(isValidPhone('09123456789')).toBe(true);
      expect(isValidPhone('+989123456789')).toBe(true);
      expect(isValidPhone('9123456789')).toBe(true);
      expect(isValidPhone('۰۹۱۲۳۴۵۶۷۸۹')).toBe(true);
    });

    it('should return false for invalid phone numbers', () => {
      expect(isValidPhone('08123456789')).toBe(false);
      expect(isValidPhone('0912345678')).toBe(false);
      expect(isValidPhone('091234567890')).toBe(false);
      expect(isValidPhone('invalid')).toBe(false);
      expect(isValidPhone(null)).toBe(false);
      expect(isValidPhone(undefined)).toBe(false);
    });
  });
});
