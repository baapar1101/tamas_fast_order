import { describe, it, expect } from 'vitest';
import { formatMoney, formatNumber, toToman, hasRealDiscount } from './money.js';

describe('money.ts', () => {
  describe('formatMoney', () => {
    it('formats a regular number correctly', () => {
      expect(formatMoney(10000)).toBe('۱۰٬۰۰۰ تومان');
    });

    it('handles zero correctly', () => {
      expect(formatMoney(0)).toBe('۰ تومان');
    });

    it('handles negative numbers', () => {
      // Intentionally not failing it yet, just seeing how it formats.
      expect(formatMoney(-500)).toBe('‎−۵۰۰ تومان');
    });

    it('handles string numbers correctly', () => {
      expect(formatMoney('25000')).toBe('۲۵٬۰۰۰ تومان');
    });

    it('handles null/undefined correctly', () => {
      expect(formatMoney(null)).toBe('۰ تومان');
      expect(formatMoney(undefined)).toBe('۰ تومان');
    });
  });

  describe('formatNumber', () => {
    it('formats a regular number correctly', () => {
      expect(formatNumber(10000)).toBe('۱۰٬۰۰۰');
    });

    it('handles string numbers correctly', () => {
      expect(formatNumber('25000')).toBe('۲۵٬۰۰۰');
    });

    it('handles null/undefined correctly', () => {
      expect(formatNumber(null)).toBe('۰');
      expect(formatNumber(undefined)).toBe('۰');
    });
  });

  describe('toToman', () => {
    it('parses typical price strings', () => {
      expect(toToman('12345')).toBe(12345);
      expect(toToman(12345)).toBe(12345);
    });

    it('strips non-numeric characters', () => {
      expect(toToman('۱۲,۳۴۵ تومان')).toBe(12345);
    });

    it('rounds numbers and ensures minimum 0', () => {
      expect(toToman(12.6)).toBe(13);
      expect(toToman(-5)).toBe(0);
    });

    it('handles invalid inputs', () => {
      expect(toToman('abc')).toBe(0);
      expect(toToman(null)).toBe(0);
      expect(toToman(undefined)).toBe(0);
    });
  });

  describe('hasRealDiscount', () => {
    it('returns true for a valid discount', () => {
      // new price 100, old price 150
      expect(hasRealDiscount(100, 150)).toBe(true);
    });

    it('returns false when oldPrice is missing or invalid', () => {
      expect(hasRealDiscount(100, null)).toBe(false);
      expect(hasRealDiscount(100, undefined)).toBe(false);
      expect(hasRealDiscount(100, NaN)).toBe(false);
    });

    it('returns false when price is 0 or negative', () => {
      expect(hasRealDiscount(0, 150)).toBe(false);
      expect(hasRealDiscount(-10, 150)).toBe(false);
    });

    it('returns false when oldPrice is not greater than price', () => {
      expect(hasRealDiscount(100, 100)).toBe(false);
      expect(hasRealDiscount(100, 90)).toBe(false);
    });

    it('returns false when oldPrice is unrealistically high (MAX_DISCOUNT_RATIO)', () => {
      // MAX_DISCOUNT_RATIO is 3
      expect(hasRealDiscount(100, 301)).toBe(false);
      expect(hasRealDiscount(100, 482000000)).toBe(false); // test case from comment
    });

    it('returns true for exactly MAX_DISCOUNT_RATIO', () => {
      expect(hasRealDiscount(100, 300)).toBe(true);
    });
  });
});
