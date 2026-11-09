## 2024-05-15 - Replace O(n^2) map value find with O(n) id lookup
**Learning:** Found a performance bottleneck in `apps/api/src/services/orders.ts` where we are using `[...productById.values()].find((row) => row.id === productDbId)`. `productById` is a Map keyed by `productId` (string), but we are doing a linear scan using `find` based on `id` (numeric db id). This is an O(n) operation inside a loop, making it O(n^2).
**Action:** We can create a reverse index map `productByDbId` mapping `id` to the product object before the loop, making the lookup O(1).
