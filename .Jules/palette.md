## 2024-10-14 - Custom UI Switch Accessibility
**Learning:** This app extensively uses custom `.switch` classes on standard `<button>` elements for boolean toggles. By default, these lack semantic meaning for screen readers, unlike native `<input type="checkbox">`.
**Action:** When creating or modifying these custom switches, ALWAYS ensure they have `role="switch"`, an `aria-checked={boolean}` state that matches the visual state, and an appropriate `aria-label` (or `aria-labelledby`) so assistive technologies can properly announce them.
