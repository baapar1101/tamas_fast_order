## 2024-05-14 - Accessible Custom Switches
**Learning:** Custom UI switches using the `.switch` class on `<button>` elements in this application frequently lack proper accessibility attributes. They don't use the `role="switch"` and `aria-checked` attributes, making their state unclear to screen readers.
**Action:** When creating or modifying custom UI switches, always ensure accessibility by including `role="switch"`, `aria-checked={boolean}`, and proper label association (`aria-labelledby` or `aria-label`).
