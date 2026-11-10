## 2023-11-10 - Refactor generateDiscountsForMissingCustomers N+1 Query

**Learning:** When performing batch creations/inserts that depend on configurations (e.g. bulk generating customer discount codes), avoiding a per-row `await db.insert()` inside a `for` loop dramatically improves asynchronous overhead and reduces the number of database queries from O(N) to O(1) (per chunk).

**Action:** Modified `generateDiscountsForMissingCustomers` in `apps/api/src/services/discounts.ts`. Instead of performing individual database inserts for each missing customer in a loop, it now aggregates the discount code configurations into an array and performs chunked bulk inserts (size 500) using `db.insert(...).values(...).onConflictDoNothing()`.
