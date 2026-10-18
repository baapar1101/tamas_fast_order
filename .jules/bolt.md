## 2024-05-18 - Bulk update taxonomy reordering to avoid N+1 queries

What: Replaced the N+1 database `UPDATE` loops in the `/admin/categories/reorder` and `/admin/brands/reorder` API endpoints with single pre-aggregated `sql` query batch updates using Postgres's `UPDATE ... FROM (VALUES ...)` syntax via `db.execute()`.

Why: Reordering taxonomies triggers a database `UPDATE` for each single ID submitted. This incurs heavy roundtrip latency and consumes database pool connections inefficiently (N+1 query problem). Consolidating the update into a single query makes the process orders of magnitude faster when many IDs are updated concurrently.

Impact: Substantial reduction in database connection usage and latency.

Measurement: Static analysis shows N discrete queries combined into 1.
