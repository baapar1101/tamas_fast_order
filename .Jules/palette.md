## 2024-10-12 - Icon-only buttons lacking ARIA labels
**Learning:** Icon-only buttons, especially those using generic classes like `.btn-icon-only` or custom close icons (`×`), often rely solely on the `title` attribute. This is problematic because screen readers may not consistently read the `title` attribute if `aria-label` is absent.
**Action:** Always verify that interactive elements lacking visible text have an explicitly defined `aria-label` in Farsi to ensure proper screen reader announcement.
