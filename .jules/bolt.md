## 2026-10-18 - Optimize reorder routes in taxonomy API

**What**:
Changed the `brands/reorder` and `categories/reorder` endpoints in `apps/api/src/routes/admin/taxonomy.ts` to use a single bulk `UPDATE` query instead of iterating through the `ids` array and executing a database update for each ID. Pre-aggregation was added using a Map to keep only the first valid sorting occurrence to avoid unpredictable updates from duplicate values.

**Why**:
The initial implementation executed one database query inside a loop for each item in the array, causing an N+1 query issue. This degrades performance significantly as `N` grows larger, due to network latency round-trips and database parsing overhead for each query.

**Impact**:
By modifying the loops to pre-aggregate the sorted order and leveraging the `db.execute(sql... FROM (VALUES ...))` syntax, we successfully collapsed `N` database interactions down to a single query execution. Network calls to the database drop from `N` to 1.

**Measurement**:
It is impractical to run the tests locally because the development environment does not support spinning up Docker/PostgreSQL instances (connection refused). However, theoretically, latency drastically reduces based on standard relational database communication round-trip times (O(N) -> O(1) query requests).
