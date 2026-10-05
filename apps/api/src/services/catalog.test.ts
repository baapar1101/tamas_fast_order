import { describe, it, expect } from 'vitest';
import { availableStock } from './catalog.js';

describe('availableStock', () => {
  it('should return the sum when both warehouses have stock', () => {
    const p = { kermanStock: 5, tehranStock: 10, stock: 2 };
    expect(availableStock(p)).toBe(15);
  });

  it('should return the sum when only Kerman has stock', () => {
    const p = { kermanStock: 8, tehranStock: 0, stock: 3 };
    expect(availableStock(p)).toBe(8);
  });

  it('should return the sum when only Tehran has stock', () => {
    const p = { kermanStock: 0, tehranStock: 12, stock: 4 };
    expect(availableStock(p)).toBe(12);
  });

  it('should fallback to flat stock when both warehouses are empty', () => {
    const p = { kermanStock: 0, tehranStock: 0, stock: 20 };
    expect(availableStock(p)).toBe(20);
  });

  it('should return 0 when all properties are zero', () => {
    const p = { kermanStock: 0, tehranStock: 0, stock: 0 };
    expect(availableStock(p)).toBe(0);
  });
});
