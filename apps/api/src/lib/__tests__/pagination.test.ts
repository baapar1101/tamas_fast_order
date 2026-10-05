import { describe, it, expect } from 'vitest';
import { offsetOf, paged, PageParams } from '../pagination.js';

describe('Pagination Utilities', () => {
  describe('offsetOf', () => {
    it('should calculate offset for page 1 correctly', () => {
      const params: PageParams = { page: 1, perPage: 10 };
      expect(offsetOf(params)).toBe(0);
    });

    it('should calculate offset for subsequent pages correctly', () => {
      const params: PageParams = { page: 2, perPage: 10 };
      expect(offsetOf(params)).toBe(10);
    });

    it('should handle different perPage values', () => {
      const params: PageParams = { page: 3, perPage: 25 };
      expect(offsetOf(params)).toBe(50);
    });

    it('should handle page 0 (even if usually invalid) by returning negative offset', () => {
      const params: PageParams = { page: 0, perPage: 10 };
      expect(offsetOf(params)).toBe(-10);
    });
  });

  describe('paged', () => {
    it('should wrap items and total in a paginated response', () => {
      const items = ['a', 'b', 'c'];
      const total = 100;
      const params: PageParams = { page: 2, perPage: 3 };

      const result = paged(items, total, params);

      expect(result).toEqual({
        items: ['a', 'b', 'c'],
        total: 100,
        page: 2,
        perPage: 3,
      });
    });

    it('should work with empty items array', () => {
      const items: string[] = [];
      const total = 0;
      const params: PageParams = { page: 1, perPage: 10 };

      const result = paged(items, total, params);

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        perPage: 10,
      });
    });
  });
});
