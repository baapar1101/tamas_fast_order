## 2026-10-24 - O(N*M) Lookup Bottleneck in Fastify Routes

**Learning:** I found a performance bottleneck where `.find()` was being used inside a `.map()` loop in a Fastify route (`admin/orders`), causing an O(N*M) lookup. This could degrade performance for large queries returning many items.
**Action:** When mapping over items that need to fetch related data from another list, precompute a `Map` keyed by the necessary identifier to change the complexity from O(N*M) to O(N + M). Use `Object.hasOwn()` or `.get()` for O(1) retrieval.
