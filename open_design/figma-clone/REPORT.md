# Indie brand report — tamasmarket (brand-anker-535220)

> تماس مارکت | فروشگاه دیجیتال — Iranian wholesale mobile-accessories webstore
> Source: https://anker.com/ · Context catalogs: D:\tamas_fast_order\catalogs · 336 files in package

## Identity
- Brand: `tamasmarket` — omdeh (wholesale) digital-accessories store; storefront + dark ops admin.
- Stack: Node.js + PostgreSQL + React; two-way Google Sheets sync for pricing (real SKUs from XLSX).
- Distinctive: RTL-first with `unicode-bidi: isolate` for Latin price strings; teal promo strip gradient is the ONLY decorative gradient (`#00596b → #00768f → #008da8`).

## Palette (measured, default theme)
| Role | Value |
|---|---|
| accent | `#08798f` |
| accent-deep | `#00596b` |
| background | `#f5f5f7` |
| surface | `#ffffff` |
| foreground | `#1d1d1f` |
| muted | `#7a7a7a` |
| border | `#e0e0e0` |
| dark shell | `#070b12 → #0e1626` |

Primary ramp (`primaryPalette`): `#bacfce #88c0c2 #62b0b5 #409ea8 #228c9c #08798f #015469 #003342 #00151c #000000`

## Type
- Vazirmatn FD, weights 400–800 (Regular/Medium/SemiBold/Bold/ExtraBold woff2 shipped).
- Base 14px, line-height 1.5714; headings heavy 700/800; font stack falls back to Tahoma/Segoe UI.

## Layout & motion
- 8px grid; radius 8 (XS 4, SM 6, standard 8, LG 10, pill 980); 1px hairline; control heights 24/32/40.
- Motion unit 0.1s; fast 0.1s / mid 0.2s; ease cubic-bezier(0.2,0.8,0.2,1).

## Structure (336 files)
- `system/` — seed.json (20-field antd seed), tokens.default/dark/compact.json (81 keys; 78 tokenizable each), variables.css ± dark, theme.json, BRAND-SYSTEM.md, kit.html/kit.dark.html, artifacts/ (landing, deck×9, poster, email, newsletter, form + gallery index.html)
- `preview/` — 7 validation cards (card, card.dark, colors-primary, typography-specimens, spacing-tokens, components-buttons, brand-assets)
- `ui_kits/app/` — app shell + 6 components (chat-area, composer, list-rail, message-bubble, nav-sidebar, app-shell)
- `source_examples/` — ProductCard.tsx, CartPanel.tsx, AdminApp.tsx, global.css (real code from the app)
- `context/catalog-data.json` — verbatim extraction of 5 XLSX sheets + 10 curated product sets, 18 banners, 7 logos
- `imagery/` — 17 category SVG icons, 39 catalog product photos, 18 banners
- `logos/` + `logos/borofone/` — brand marks (7) + BOROFONE tiles (7)
- `fonts/`, `build/` (logo, admin-logo, sign, toman), `plugin-source/`, `.od-skills/`, `agent-knowledge/`

## Inventory by extension
71 .html · 69 .json · 66 .jpg · 57 .svg · 34 .md · 10 .webp · 9 .css · 9 .png · 5 .woff2 · 3 .tsx · 1 .mjs · 1 .woff · 1 .ico

## Data & provenance
- `catalog-data.json` generated 2026-09-19T13:35:28 from 5 XLSX sheet exports (BOROFONE PRICE LIST, HIMI PRICE, POWERBANK BASKET, tamas, YESIDO 222), rows include real SKUs (e.g. BR29 speaker, BO headphones, BG mouse/keyboard, HIMI MOTION airpods, XOOM, PB).
- Principle from DESIGN.md: "everything measured, nothing invented" — SKUs/prices never fabricated.

## Quality
- `od lint` on artifacts: 0 p0/p1/p2 findings.
- All HTML screens render clean (validated via od export; see figma-clone/screens).