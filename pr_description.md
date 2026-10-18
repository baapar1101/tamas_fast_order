🎯 **What:** Removed code duplication for URL validation (specifically `isPrivateAddress` and `validatePublicTargetUrl` / `validatePublicUrl`) from `apps/api/src/routes/admin/products.ts` and `apps/api/src/services/target-tracking.ts` by consolidating them into a new shared library file `apps/api/src/lib/url.ts`.

💡 **Why:** Having duplicate pure logic validation functions scattered across different route and service files decreases maintainability. Moving them to a centralized library file improves code reusability, ensures consistency in validation logic across the API, and makes future updates to URL validation rules easier.

✅ **Verification:**
- Successfully ran `npm run typecheck` across the workspace.
- Ran tests with `npx tsx --test "apps/api/src/**/*.test.ts"` with zero failures.
- Visually inspected the git diff to ensure no business logic was changed during the refactoring process.

✨ **Result:** Improved codebase maintainability by centralizing URL validation logic and eliminating ~40 lines of duplicate code.
