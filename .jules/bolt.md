## 2024-11-07 - Avoid Array Iteration over Pre-fetched Drizzle Map

**Learning:** When fetching records by ID and constructing a Map for fast lookups by `productId` (e.g., `productById` in `apps/api/src/services/orders.ts`), doing `[...productById.values()].find((row) => row.id === productDbId)` iterates over the entire Map contents again. This causes an O(N) lookup instead of O(1) inside a loop, leading to O(N^2) complexity in the worst case (where N is the number of products). It should be replaced with a fast lookup by first finding the `productId` mapping or directly looking up if `productById` maps by `id` instead. In this specific case, we can create an index by DB ID as well or fetch it directly.

**Action:** When finding a product by its Drizzle serial `id` when a Map is already indexed by `productId`, create a secondary index Map by `id` before the loop to ensure O(1) lookups.
