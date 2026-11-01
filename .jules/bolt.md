## 2024-05-18 - Initialize
**Learning:** Initializing journal for Bolt learnings.
**Action:** Use this file to record CRITICAL learnings only.

## 2024-05-18 - Replacing `Array.prototype.find` with `Map` for O(1) Lookups in Order Listing
**Learning:** In `apps/api/src/routes/admin/orders.ts`, the code maps over order rows and uses `.find()` on the `instructions` array for each order. This causes an O(N*M) nested loop, resulting in performance degradation when the number of fetched rows and instructions increases.
**Action:** Always precompute a `Map` before the loop (keyed by the relational ID) for relational data lookups when traversing an array of rows to achieve O(1) lookup complexity per row, resulting in overall O(N+M) time complexity. Ensure we preserve the original "first match" logic by constructing the Map correctly.
