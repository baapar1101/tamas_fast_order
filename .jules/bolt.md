## 2026-11-10 - CRM Product Sync Batch Queries

**Learning:** When performing bulk updates with varying values per row using Drizzle ORM, you can construct a single update query using `db.update().set({ column: sql\`case ... end\` }).where(inArray(...))` along with Drizzle's `sql` helper to safely interpolate dynamic case conditions without manual string injection.

**Action:** Replaced the individual `db.update` and `db.insert` queries inside the `processPendingCrmProductSync` loop with array accumulators that execute batch database operations (using `inArray` and bulk inserts) after the loop finishes processing.
