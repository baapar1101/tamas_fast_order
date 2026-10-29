## 2024-05-24 - Accessible Emoji Icon Buttons
**Learning:** Icon-only buttons using emojis need to have the emojis visually hidden from screen readers using `<span aria-hidden="true">` to prevent the screen reader from reading the emoji name (which can be confusing or not match the intent), while providing an explicit `aria-label` in Persian for the button itself.
**Action:** Always wrap emojis in action buttons with `<span aria-hidden="true">` and ensure the button has a descriptive `aria-label`.
