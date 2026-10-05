import { describe, it, expect } from 'vitest';
import { hasRealDiscount } from './money';

describe('hasRealDiscount', () => {
  it('should return true for valid discounts within the ratio', () => {
    expect(hasRealDiscount(100, 150)).toBe(true);
    expect(hasRealDiscount(100, 200)).toBe(true);
    expect(hasRealDiscount(100, 299)).toBe(true);
  });

  it('should return false if oldPrice is missing', () => {
    expect(hasRealDiscount(100, null)).toBe(false);
    expect(hasRealDiscount(100, undefined)).toBe(false);
  });

  it('should return false if oldPrice is non-finite', () => {
    expect(hasRealDiscount(100, Infinity)).toBe(false);
    expect(hasRealDiscount(100, -Infinity)).toBe(false);
    expect(hasRealDiscount(100, NaN)).toBe(false);
  });

  it('should return false if price is <= 0', () => {
    expect(hasRealDiscount(0, 100)).toBe(false);
    expect(hasRealDiscount(-10, 100)).toBe(false);
  });

  it('should return false if oldPrice is <= price (no real discount)', () => {
    expect(hasRealDiscount(100, 100)).toBe(false);
    expect(hasRealDiscount(100, 50)).toBe(false);
  });

  it('should return false if oldPrice exceeds the MAX_DISCOUNT_RATIO', () => {
    // MAX_DISCOUNT_RATIO = 3
    expect(hasRealDiscount(100, 301)).toBe(false);
    expect(hasRealDiscount(100, 500)).toBe(false);
  });

  it('should return true if oldPrice is exactly price * MAX_DISCOUNT_RATIO', () => {
    expect(hasRealDiscount(100, 300)).toBe(true);
  });
});
