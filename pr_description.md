🎯 **What:** Refactored the `Modal` component in `apps/web/src/components/Modal.tsx` to accept a single `props` parameter instead of destructing all properties inline in the function signature.

💡 **Why:** The function signature previously exceeded typical parameter count guidelines, reducing readability. Grouping them into a single `props` object and destructing them within the function body cleans up the function definition and improves code health without altering the API.

✅ **Verification:** Verified by running the TypeScript compiler across the workspaces (`npm run typecheck`) and ensuring the full test suite passes (`npm run test`). No behavioral changes were introduced.

✨ **Result:** Improved maintainability and cleaner function signature for the Modal component.
