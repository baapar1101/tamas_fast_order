import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import { catalogExportScopeFilter } from '../src/services/catalog-export-scope.js';

const dialect = new PgDialect();

test('all-products catalog has no campaign restriction', () => {
  assert.equal(catalogExportScopeFilter('all'), undefined);
});

test('festival singles require promotion and exclude baskets and bundles', () => {
  const filter = catalogExportScopeFilter('festival_singles');
  assert.ok(filter);
  const query = dialect.sqlToQuery(filter);
  assert.match(query.sql, /"products"\."promotion"/);
  assert.match(query.sql, /"products"\."type" <>/);
  assert.match(query.sql, /"products"\."category_id" is null/);
  assert.match(query.sql, /not \("categories"\."name"/);
  assert.deepEqual(query.params, [true, 'bundle', 'Bondle', 'سبد ها']);
});

test('basket catalog includes only the basket category, regardless of promotion', () => {
  const filter = catalogExportScopeFilter('baskets');
  assert.ok(filter);
  const query = dialect.sqlToQuery(filter);
  assert.doesNotMatch(query.sql, /promotion/);
  assert.deepEqual(query.params, ['Bondle', 'سبد ها']);
});
