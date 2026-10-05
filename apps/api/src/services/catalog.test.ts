import test from 'node:test';
import assert from 'node:assert';
import { buildSearchText } from './catalog.js';

test('buildSearchText filters out null and undefined', () => {
  assert.strictEqual(
    buildSearchText(['apple', null, undefined, 'banana']),
    'apple banana'
  );
});

test('buildSearchText trims whitespace from components', () => {
  assert.strictEqual(
    buildSearchText(['  apple  ', ' banana ']),
    'apple banana'
  );
});

test('buildSearchText filters out empty strings and strings with only whitespace', () => {
  assert.strictEqual(
    buildSearchText(['apple', '', '  ', 'banana']),
    'apple banana'
  );
});

test('buildSearchText joins elements with spaces and lowercases them', () => {
  assert.strictEqual(
    buildSearchText(['Apple', 'BANANA', 'ChErRy']),
    'apple banana cherry'
  );
});

test('buildSearchText handles an empty array', () => {
  assert.strictEqual(
    buildSearchText([]),
    ''
  );
});

test('buildSearchText truncates output to 2000 characters', () => {
  // Create a large array of 'a' characters
  // Each 'a ' is 2 characters, so 1001 parts * 2 = 2002 characters before slice
  const parts = Array(1001).fill('a');
  const result = buildSearchText(parts);

  assert.strictEqual(result.length, 2000);
  assert.strictEqual(result.slice(0, 3), 'a a');

  // 1000th 'a' will be at index 1998 (1000 * 2 - 2).
  // Following will be a space at 1999.
  // The string is exactly 2000 chars, index 1998 is 'a', index 1999 is ' '.
  // Wait, 1000 'a ' is 2000 chars. 1000 * 2 = 2000.
  // So 'a a a ... a '
  // Let's just check the length and that it starts with 'a'.
  assert.strictEqual(result.startsWith('a'), true);
});

test('buildSearchText handles non-string values gracefully', () => {
  // @ts-expect-error Testing invalid input for robustness
  assert.strictEqual(buildSearchText(['apple', 123, true, {}]), 'apple 123 true [object object]');
});
