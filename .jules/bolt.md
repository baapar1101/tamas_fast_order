## 2024-05-18 - [StorefrontPage ProductCard re-renders]
**Learning:** Storefront lists have massive numbers of product cards passing `lines` prop from cart state which triggers a re-render on all items every time any product quantity updates in the cart.
**Action:** Add a custom arePropsEqual to the memo wrapper for list items to check if the cart state updates pertain to the specific variants in the list item.
