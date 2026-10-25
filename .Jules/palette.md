## 2024-10-25 - Quantity Stepper ARIA Labels
**Learning:** Found a specific pattern where `+` and `-` quantity stepper buttons in product cards and product pages rely solely on visual text (`+`/`-`) or `title` attributes, omitting necessary `aria-label` attributes for screen readers.
**Action:** Enforce descriptive `aria-label` attributes (e.g., `aria-label="افزایش"` and `aria-label="کاهش"`) in Persian on all such visual text components.
