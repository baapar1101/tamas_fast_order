
## 2024-10-19 - Prevent Unnecessary Re-renders on Global State Mapping
**Learning:** Passing frequently updated global state arrays (like `cartLines` from Zustand) directly as props to memoized child components mapped in lists breaks `React.memo`'s default shallow comparison. Every time the global state changes, *all* child components re-render, even if the change doesn't affect them.
**Action:** Supply a custom `propsAreEqual` function to deeply compare relevant data subsets. When implementing `propsAreEqual`, avoid hardcoding prop names; iterate over `Object.keys(prev)` to dynamically shallow compare standard props (including callbacks) to prevent unmaintainable code and stale closures.
