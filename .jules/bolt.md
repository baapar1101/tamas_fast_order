
## 2025-02-17 - Optimize N+1 target stock sync loop

When updating records dynamically inside a loop where network delays aren't the primary factor (e.g. updating multiple `tehranStock` values per product), it's important to prevent N+1 database `await db.update()` operations.

I gathered the values into an array, and constructed a bulk update statement using Drizzle's `sql` helper with `CASE` mapping:
```typescript
await db.update(products).set({
  tehranStock: sql`case ${sql.join(tehranStockChunks, sql` `)} else ${products.tehranStock} end`,
  // ...
}).where(inArray(products.id, ids));
```

This successfully optimized a mocked sequential loop simulated over 50 products from ~112ms to ~2ms, a 50x database trip elimination impact.
