## 2025-02-28 - Re-used UI Actions Can Become Misleading
**Learning:** Found a button intended for "Favorites" (title="علاقه‌مندی‌ها", Icon="heart") that actually scrolled the user to the cart. Reusing UI components or actions without updating their semantic meaning leads to accessibility failures, as screen readers would announce an action that doesn't match the behavior.
**Action:** When updating button behaviors or reusing actions, always ensure the `aria-label`, `title`, and inner `Icon` semantically match the actual action being performed.
