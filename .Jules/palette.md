## 2024-10-16 - Ensure custom switches have ARIA attributes
**Learning:** Custom switch UI elements (like `<button className="switch">`) lack native accessibility features, meaning screen readers cannot announce their state correctly to users.
**Action:** Always add `role="switch"`, `aria-checked={boolean}`, and proper label association (either `aria-label` or `aria-labelledby`) to custom switch implementations to ensure they are accessible.
