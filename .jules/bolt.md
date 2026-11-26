
## 2025-02-12 - Refactored O(N*M) nested `.find()` into O(N) map lookup
**Learning:** Calling `.find()` or `.filter()` on secondary data arrays inside loops over primary data arrays (e.g., inside Fastify route handlers or formatting DTOs) creates an O(N*M) performance bottleneck, especially for admin endpoints displaying many rows like orders.
**Action:** Always precompute a `Map` keyed by the relevant relational ID before iterating over the main data array to achieve O(1) lookups. When replacing `.find()` which returns the first match, use `if (!map.has(key)) map.set(key, value)` to prevent subsequent elements from overwriting the first instance.
