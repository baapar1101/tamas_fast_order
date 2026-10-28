## 2024-10-28 - Avoid O(N*M) Array Lookups in Map operations
**Learning:** Found O(N*M) lookup in `apps/api/src/routes/admin/orders.ts` inside a route returning paginated results (`rows.map((r) => toAdminOrderDTO(r, byOrder.get(r.id) ?? [], instructions.find((item) => item.orderId === r.id)))`). Using `Array.find` or `Array.filter` inside `.map` creates an O(N*M) bottleneck, which is a known pattern to avoid per codebase memory.
**Action:** Replace `Array.find` inside loops with a precomputed `Map` for O(1) lookups, matching existing pattern used for `byOrder`.
