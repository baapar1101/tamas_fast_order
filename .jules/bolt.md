## 2024-10-24 - React.memo on mapped global arrays
**Learning:** Passing a frequently updated global state array (like Zustand's `cartLines`) directly to a mapped list of memoized child components (`ProductCard`) breaks `React.memo`'s default shallow comparison, causing widespread unnecessary re-renders across all items whenever any item changes.
**Action:** When a global array is mapped over to pass a filtered portion to child components, implement a custom `propsAreEqual` function to check only the specific subset of the array relevant to the child component.
