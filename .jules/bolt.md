## 2024-05-14 - Resolve N+1 query in customer discounts bulk generation

**Learning:** When performing bulk generation of database records (e.g. generating discount codes for a large number of users), looping and performing individual `db.insert` statements inside the loop can create significant N+1 query performance bottlenecks.
**Action:** Always accumulate the records in an array and use a single bulk `db.insert(...).values(array)` call instead, unless transactional control or retry logic strictly requires isolated inserts.
