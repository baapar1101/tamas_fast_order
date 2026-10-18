## 2024-06-25 - React.memo Shallow Comparison and Map Lookups

When passing frequently updated global state arrays (like `cartLines` from Zustand) directly to memoized child components, `React.memo`'s default shallow comparison will always fail when the array identity changes. This causes widespread unnecessary re-renders.

To fix this:
1. Provide a custom `propsAreEqual` function.
2. Iterate over `Object.keys(prev)` to dynamically perform a shallow compare of other props.
3. Specifically extract and deep-compare only the required sub-state for the component.

Additionally, nested array searches (like `.find` or `.filter` within loops) result in $O(N \cdot M)$ complexity. To optimize:
1. Transform the search array into a Map (using `useMemo` keyed by the array).
2. Change inner loop `.find` calls to Map `.get` lookups, reducing time complexity to $O(N + M)$.
