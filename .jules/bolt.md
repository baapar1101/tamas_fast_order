## 2024-11-09 - O(N^2) nested loop in retryCampaign
**Learning:** Refactoring .find() array lookups to O(1) in-memory Map lookups inside loops is crucial to solve performance bottlenecks in O(N^2) scenarios.
**Action:** When finding a .find() inside a loop, refactor it into an O(1) Map lookup.
