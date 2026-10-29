## 2024-10-29 - O(N*M) lookup bottleneck in mapping loops

**Learning:** When mapping over data arrays to construct DTOs (e.g., inside Fastify route handlers), using nested `.find()` or `.filter()` calls inside the `.map()` loop creates an O(N*M) performance bottleneck, which is particularly bad for API pagination responses.
**Action:** Precompute a `Map` keyed by the relevant ID before the mapping loop to achieve O(1) in-memory lookups.
