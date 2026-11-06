## 2026-11-06 - ARIA labels for Stepper Buttons
**Learning:** Found that custom $+/-$ quantity steppers relying only on visual cues or `title` tags fail to announce their purpose to screen readers.
**Action:** Consistently added explicit Persian ARIA labels (`aria-label="کاهش"` and `aria-label="افزایش"`) to icon-only stepper and add buttons to enforce screen-reader accessibility.
