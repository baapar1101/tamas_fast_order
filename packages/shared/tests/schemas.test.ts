import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { idSchema, sheetBool } from '../src/schemas.js';

describe('shared schemas', () => {
  it('coerces positive integer ids and rejects invalid ids', () => {
    assert.equal(idSchema.parse('42'), 42);
    for (const value of [0, -1, 1.5, '3.14']) assert.throws(() => idSchema.parse(value));
  });

  it('normalizes spreadsheet boolean values', () => {
    for (const value of [true, 1, -1, 'TRUE', ' yes ', 'بله']) assert.equal(sheetBool.parse(value), true);
    for (const value of [false, 0, 'FALSE', 'no', '', null, undefined]) assert.equal(sheetBool.parse(value), false);
  });
});
