Extracted the inline `onClick` handlers for editing and deleting categories and brands into separate component-level functions (`handleEditCategory`, `handleDeleteCategory`, `handleEditBrand`, `handleDeleteBrand`) with early returns.
This improves readability and maintainability by reducing nesting depth in the JSX block and cleanly separating interaction logic from component rendering.
Ran `npm run typecheck` and `npm run test` to verify no types or behavior were broken.
A cleaner, flatter JSX structure in TaxonomyPage.
