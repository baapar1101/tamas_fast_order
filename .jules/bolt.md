## 2025-01-06 - Memoize widely used presentation components
**Learning:** React components that render frequently and deterministically based on props, like `Icon` and `Price`, are prime targets for `React.memo`. In a large application with many lists or repetitive UI elements, re-rendering these simple components unnecessarily can contribute to performance degradation.
**Action:** Always check if widely used, pure presentation components are wrapped in `React.memo`, particularly those rendered inside lists or tables.
