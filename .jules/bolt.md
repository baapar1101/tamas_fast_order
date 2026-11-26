
## 2024-10-27 - Backend Performance: Avoid O(N*M) lookups inside mappings

**Learning:** When mapping over data arrays to construct DTOs (e.g., inside Fastify route handlers), using nested `.find()` or `.filter()` calls inside the `.map()` loop creates an O(N*M) performance bottleneck, especially problematic for N+1 issues or large datasets.

**Action:** Precompute a `Map` keyed by the relevant ID before the mapping loop to achieve O(1) in-memory lookups instead of O(M) for each N. I replaced `.find` inside a `.map` loop in `apps/api/src/routes/admin/orders.ts` with a `Map` lookup for payment instructions.
