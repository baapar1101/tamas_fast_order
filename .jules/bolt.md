## 2024-05-19 - N+1 query pattern finding
**Learning:** Found an O(N*M) lookup pattern in \`apps/api/src/routes/admin/orders.ts\` where \`instructions.find()\` is called inside \`rows.map()\`. This is an N+1 query issue since it is called in a loop, although here it's an array search instead of a DB query, it's still slow for large lists. The context guidelines mention mapping over data arrays avoiding nested \`.find()\` in \`.map()\` to prevent O(N*M) performance bottlenecks by precomputing a \`Map\` before mapping.
**Action:** Replace \`instructions.find()\` with a \`Map\` lookup.
