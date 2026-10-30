## 2025-01-30 - Accessible Icon-Only Quantity Steppers
**Learning:** In this design system, icon-only buttons like quantity steppers (`+`/`-`) often lack screen-reader context because they rely solely on visual cues or `title` tooltips.
**Action:** Always enforce descriptive `aria-label` attributes (e.g., in Persian for user-facing text, like `aria-label="افزایش"`) on these components, and ensure `title` attributes (if present) are also duplicated as `aria-label` for screen reader consistency.
