## 2024-03-24 - Initial

## 2024-03-24 - Accessibility for Visual Text Buttons
**Learning:** Buttons relying on purely visual text symbols like `+` or `-` for steppers often get overlooked for screen readers because they are not technically "icons", but they act essentially the same as icon-only buttons since their inner text ("+", "-") is not adequately descriptive out of context.
**Action:** Always ensure that visual text symbol buttons (like `+` and `-` quantity steppers) have explicit `aria-label` attributes to ensure they are fully accessible to screen readers, just like standard icon-only buttons.
