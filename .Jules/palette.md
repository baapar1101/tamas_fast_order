## 2023-10-27 - Quantity Stepper Accessibility
**Learning:** Text-only visual buttons (like `+` and `-` used in quantity steppers) often lack descriptive context for screen readers in this app's components, relying purely on visual characters.
**Action:** When adding or modifying custom quantity steppers, always ensure they have descriptive `aria-label` attributes (e.g., `aria-label="افزایش تعداد"`) to provide semantic context for assistive technologies.
