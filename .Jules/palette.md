## 2024-10-13 - [Custom Toggles Accessibility]
**Learning:** Custom UI switches built with `<button>` elements require `role="switch"` and `aria-checked={boolean}` properties. Without these, screen readers announce them as generic buttons without state, confusing visually impaired users.
**Action:** When creating or finding custom toggle elements (like `.switch` class on buttons), ensure they always have appropriate ARIA switch roles and state definitions linked properly to their labels.
