import { describe, expect, it } from 'vitest';
import { idSchema, sheetBool } from '../src/schemas.js';

describe('idSchema', () => {
  it('should parse valid positive integers', () => {
    expect(idSchema.parse(1)).toBe(1);
    expect(idSchema.parse(42)).toBe(42);
    expect(idSchema.parse(999999)).toBe(999999);
  });

  it('should coerce strings to numbers', () => {
    expect(idSchema.parse('1')).toBe(1);
    expect(idSchema.parse('42')).toBe(42);
  });

  it('should reject zero or negative integers', () => {
    expect(() => idSchema.parse(0)).toThrow();
    expect(() => idSchema.parse(-1)).toThrow();
    expect(() => idSchema.parse('-42')).toThrow();
  });

  it('should reject floats', () => {
    expect(() => idSchema.parse(1.5)).toThrow();
    expect(() => idSchema.parse('3.14')).toThrow();
  });
});

describe('sheetBool', () => {
  it('should parse actual booleans', () => {
    expect(sheetBool.parse(true)).toBe(true);
    expect(sheetBool.parse(false)).toBe(false);
  });

  it('should parse numbers as booleans (0 is false, others true)', () => {
    expect(sheetBool.parse(1)).toBe(true);
    expect(sheetBool.parse(42)).toBe(true);
    expect(sheetBool.parse(-1)).toBe(true);
    expect(sheetBool.parse(0)).toBe(false);
  });

  it('should parse specific string values as true', () => {
    expect(sheetBool.parse('true')).toBe(true);
    expect(sheetBool.parse('TRUE')).toBe(true);
    expect(sheetBool.parse(' true ')).toBe(true);
    expect(sheetBool.parse('1')).toBe(true);
    expect(sheetBool.parse('yes')).toBe(true);
    expect(sheetBool.parse('YES')).toBe(true);
    expect(sheetBool.parse('بله')).toBe(true);
  });

  it('should parse other string values as false', () => {
    expect(sheetBool.parse('false')).toBe(false);
    expect(sheetBool.parse('FALSE')).toBe(false);
    expect(sheetBool.parse('0')).toBe(false);
    expect(sheetBool.parse('no')).toBe(false);
    expect(sheetBool.parse('kheyr')).toBe(false);
    expect(sheetBool.parse('')).toBe(false);
    expect(sheetBool.parse(' random ')).toBe(false);
  });

  it('should parse null/undefined as false', () => {
    expect(sheetBool.parse(null)).toBe(false);
    expect(sheetBool.parse(undefined)).toBe(false);
  });
});
