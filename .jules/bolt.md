## 2024-11-03 - Replace O(N^2) `.find()` in `.map()` with O(1) Map lookup
**Learning:** In `apps/api/src/routes/admin/orders.ts`, the `GET /admin/orders` endpoint maps over order rows and calls `instructions.find(item => item.orderId === r.id)` for each row. This results in an O(N*M) nested loop operation which hurts performance when fetching multiple orders.
**Action:** Always precompute a `Map` keyed by the relational ID before iterating over data in a `.map()` or loop, reducing O(N*M) to O(1) lookup.
