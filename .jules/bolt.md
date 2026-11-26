## 2024-10-18 - Bulk Update Drizzle Tracking Sites
- Changed sequential `.update().where()` in `syncProduct` loop to bulk `.insert().values(updates).onConflictDoUpdate()`
- This avoids the N+1 query problem by pushing all individual tracking site snapshot results to Postgres in a single query payload.
- Due to the nature of network connections, executing N queries serially over Postgres can add significant latency, particularly depending on proximity between app server and Postgres. This changes it to a single query payload with no observable impact to consistency.
