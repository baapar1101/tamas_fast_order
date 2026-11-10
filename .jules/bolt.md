## 2024-05-24 - Replace N+1 queries with bulk upserts in Google Sheets sync mapping

**Learning:** When applying row-by-row changes from Google Sheets to a PostgreSQL database using Drizzle ORM, using `select` to determine if a record exists and then conditionally executing an `update` or `insert` query causes an N+1 query problem, taking two database round-trips per row.

**Action:** Replaced the `select` -> `update`/`insert` pattern with a single `db.insert(...).values(...).onConflictDoUpdate({ target: ..., set: ... })` query in `apps/api/src/services/sheets/mapping.ts`. This cut the required database round trips in half for the `categories`, `brands`, `colors`, `users`, and `settings` entities, speeding up syncs significantly. `orders` was left alone as it relies on more complex business logic handling the associated line items.
