## 2025-02-18 - [Fix N+1 Query in CRM Orders Sync]
- **What:** Replaced an N+1 query loop for fetching order items during CRM sync with a single `inArray` query.
- **Why:** Order items were being queried inside a loop iterating over 50 orders, leading to 51 queries instead of 2.
- **Impact:** Measured performance improved from ~114ms to ~2.5ms (98% reduction) for processing 50 orders.
