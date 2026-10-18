import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDropdownSearch, shouldSearchDropdown } from '../src/admin/components/dropdownSearch';

test('search appears only for dropdowns with more than five options', () => {
  assert.equal(shouldSearchDropdown(5), false);
  assert.equal(shouldSearchDropdown(6), true);
});

test('Persian and Arabic spelling, spaces and digits match in dropdown search', () => {
  assert.equal(normalizeDropdownSearch('بانك‌ ملّي ۱۲۳'), normalizeDropdownSearch('بانک ملی ١٢٣'));
  assert.equal(normalizeDropdownSearch('XIAOMI Poco'), 'xiaomipoco');
});
