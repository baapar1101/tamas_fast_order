## 2026-11-10 - Fix SQL Injection in Sheet Mapping
**Learning:** Replaced the unsafe `sql.raw` string concatenation for table and column names with `drizzle-orm`'s safer `sql.identifier()` function. This properly quotes and escapes PostgreSQL identifiers, preventing potential SQL injection vulnerabilities if inputs were to become dynamic in the future.
**Action:** Changed `sql.raw(`"${mapping.tableName}"`)` to `sql.identifier(mapping.tableName)`.
