## 2024-05-30 - O(N*M) nested .find() in loops
**Learning:** In the Fastify backend, mapping over a list of items and looking up related records via `.find()` from a separate array inside the callback causes an O(N*M) performance bottleneck, especially on operations scaling linearly with the number of rows.
**Action:** Pre-compute a `Map` mapping relevant keys to objects to perform O(1) loop lookups. Ensure `if (!map.has(key)) map.set(key, value)` is used when building the map to mirror the first-match behavior of `.find()`.
