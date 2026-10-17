## 2024-05-24 - Prevent unnecessary re-renders in ProductCard
**Learning:** Avoid passing frequently updated global state arrays (like cartLines from Zustand) directly as props to memoized child components mapped in lists. This updates array references globally and breaks React.memo's default shallow comparison.
**Action:** Supply a custom propsAreEqual function to perform deep comparisons on relevant data subsets to prevent widespread unnecessary re-renders.
