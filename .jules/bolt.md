## 2024-05-30 - Replace O(N*M) nested `.find()` with O(1) Map lookups in route handlers
**Learning:** Found an O(N*M) performance bottleneck in Fastify route handlers (e.g., `GET /admin/orders`) where looping over database query results (`rows.map()`) called `.find()` to search for related entities from another array on every iteration.
**Action:** Always precompute a `Map` keyed by the relevant ID before the mapping loop to achieve O(1) in-memory lookups instead of using nested `.find()` or `.filter()` inside `.map()`.
