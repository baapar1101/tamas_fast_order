# tamasmarket — App UI Kit

Reusable React/demo surface for the **tamasmarket** design system (wholesale mobile-accessories storefront + dark ops admin).

## How to reuse

1. Load tokens first (the kit's contract entrypoint):
   - `colors_and_type.css` (project root) — all `--tamas-*` tokens (bg/surface/fg/muted/border/accent, promo gradient, admin ink/emerald/cyan), Vazirmatn FD font stack.
2. Use the real catalog data, never samples:
   - `../../context/catalog-data.json` — verbatim sheet extraction (BOROFONE / HIMI / YESIDO / POWERBANK BASKET / tamas phones). Product names, SKUs, and `قیمت فروش` values come from here.
   - `../../imagery/products/catalog/` — product photos (category-level pairing).
   - `../../imagery/banners/` + `../../logos/borofone/` — real banners and BOROFONE tile marks.
3. Run `index.html` to see the composed components; each of the six roles below is also a standalone reusable partial under `components/`.

## Component roles (six, standalone files under `components/`)

| Role | File |
| --- | --- |
| App shell (44px glass header) | `components/app-shell.html` |
| Navigation / sidebar (category chip rail) | `components/nav-sidebar.html` |
| Assistant / list rail (catalog line items) | `components/list-rail.html` |
| Chat area (RTL thread frame) | `components/chat-area.html` |
| Message bubble (order/status bubbles) | `components/message-bubble.html` |
| Input bar / composer (search + add-to-order) | `components/composer.html` |

Plus the storefront product card (not a chat role) shown in `index.html` (`Card` in the Babel script) and the dark admin table.

## Conventions enforced

- Persian RTL-first; LTR islands (prices, SKUs) wrapped in `.ltr` (`unicode-bidi: isolate`).
- Pill radius for actions (buttons, chips, search); 18px cards; 8px base tokens; 1px borders.
- Prices: thousand-Toman for BOROFONE/YESIDO/VENDENS sheets, Rial for HIMI — keep the unit label.
- No invented pricing; no cross-brand photo/SKU pairing.

## Files in this kit

- `index.html` — full composition demo (products grid, promo strip, states, dark admin panel, theme toggle, component-role map). Uses React 18.3.1 + framer-motion 11.11.13 + Babel standalone from unpkg.
- `components/*.html` — six standalone reusable role demos (see table above).