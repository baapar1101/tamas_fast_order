## 2024-05-19 - N+1 query pattern finding
**Learning:** Found an O(N*M) lookup pattern in \`apps/api/src/routes/admin/orders.ts\` where \`instructions.find()\` is called inside \`rows.map()\`. This is an N+1 query issue since it is called in a loop, although here it's an array search instead of a DB query, it's still slow for large lists. The context guidelines mention mapping over data arrays avoiding nested \`.find()\` in \`.map()\` to prevent O(N*M) performance bottlenecks by precomputing a \`Map\` before mapping.
**Action:** Replace \`instructions.find()\` with a \`Map\` lookup.

## 2024-05-19 - CI Failure: Zod Vulnerability
**Learning:** Found a high severity vulnerability in zod version `<4.6.6` which exhausted memory validating oversized collections, crashing the CI pipeline (`npm audit --omit=dev --audit-level=high`). The repo requires zero high-severity audit vulnerabilities.
**Action:** Updated zod to version `4.6.7` using `npm install zod@4.6.7 -w @tamas/api -w @tamas/shared` which resolved the CI failure without introducing any runtime or testing issues as seen via tests.
