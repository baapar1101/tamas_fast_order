# Cloning tamasmarket (brand-anker-535220) into Figma

Three parts. Do Part 1 if you want editable layers; do Part 2 to import visuals as images; use Part 3 for the shared design tokens.

---

## Part 0 — One-click design-system generator plugin (recommended)

A ready plugin is bundled at `..\figma-plugin\`:

1. Open Figma → **Plugins → Development → New plugin… → Choose manifest.json** → pick `figma-plugin\manifest.json`.
2. Run **tamasmarket · Design System Builder** from **Plugins → Development**.

It builds the whole system in your open file in seconds: page with palette & paint styles, typography specimens, primary ramp, 17 category icon vectors, spacing/radius bars, plus a `tamasmarket` **Variables collection** with default/dark/compact modes (42 color vars × 3 themes). Vazirmatn prefers, falls back to Inter.

---

## Part 1 — Editable clone via the html.to.design plugin

The Figma REST API / Framelink MCP cannot create design files, so the cleanest full-clone path is the community **html.to.design** plugin, which parses live HTML into editable Figma layers.

1. Open Figma → **Plugins → Development → New plugin…** → (or just install *html.to.design* from Community).
2. If using the dev plugin: menu → **Plugins → html.to.design** → paste the page URL or drag-drop the file.
3. Since the artifacts are local HTML, run a tiny static server from the project folder:
   ```
   cd "C:\Users\Albert\AppData\Roaming\Open Design\namespaces\release-stable-win\data\projects\brand-anker-535220"
   npx serve .
   ```
4. Point html.to.design at these URLs, one page per Figma frame:
   - `http://localhost:3000/system/artifacts/landing.html` — storefront landing (the "clone" headline piece)
   - `http://localhost:3000/system/index.html` — brand system gallery
   - `http://localhost:3000/system/kit.html` and `kit.dark.html` — light/dark component showrooms
   - `http://localhost:3000/preview/card.html`, `colors-primary.html`, `typography-specimens.html`, `spacing-tokens.html`, `components-buttons.html`, `brand-assets.html`
   - `http://localhost:3000/ui_kits/app/index.html` — the app UI kit
5. html.to.design preserves fonts/text styles/borders. Paste **Vazirmatn FD** into the doc first: `assets/fonts/Vazirmatn_FD.html` → install the 5 woff2 weights, or add via **Text → Upload new fonts**.

**Caveat:** html.to.design renders grids/colors well but antd token-driven styles resolve at runtime; expect pixels to be finalized against `tokens/default.json` (Part 3).

---

## Part 2 — Image-screen pack (instant, non-editable)

17 full renders are in `screens/` (1440 px wide, retina-grade). Drag any PNG into a Figma frame:

| File | What it is |
|---|---|
| `system-artifacts-landing.png` | Storefront landing, single long page |
| `system-index.png` | Brand system gallery |
| `system-kit.kit.png` / `system-kit.dark.png` | Light & dark component showcase (5607 px tall) |
| `system-artifacts-deck.png` | 9-slide 16:9 deck (full stack) |
| `system-artifacts-poster/email/newsletter/form.png` | Generated artifacts |
| `preview-*.png` | Preview cards: card, card.dark, colors-primary, typography, spacing, buttons, brand-assets |
| `ui_kits-app-index.png` | App UI kit |

Tall images: in Figma, **right-click → Slice**, set grid, export pieces; or split manually at the utterance tracks.

Assets (silhouettes for quick rebuilding):
- `assets/icons/` — 17 category SVG icons (adaptor, airpod, cable, speaker…)
- `assets/logos/` + `assets/logos-borofone/` — brand marks + BOROFONE tiles
- `assets/banners/` — 18 promo banners (JPG)
- `assets/products/` — 39 real catalog product photos

---

## Part 3 — Design tokens (Tokens Studio / Figma Variables)

`tokens/` contains DTCG-format JSON — import with the **Tokens Studio for Figma** plugin:

1. Install *Tokens Studio* → create a "sync to files" token set → drop in each file.
2. Up to 78 tokens × 3 themes (`default`, `dark`, `compact`).
3. In Tokens Studio press **Add tokens to Figma** → creates Figma Variables. Or swap themes: Edit style → Values → or use the "themes" feature.

Token keys and mapping used:
- `color*` ($type `color`) — Figma color variables
- `fontSize*`, `borderRadius*`, `lineWidth*`, `size*`, `controlHeight*` ($type `dimension`, px)
- `fontFamily`, `fontFamilyCode` ($type `fontFamily`)
- `fontWeightStrong` ($type `fontWeight`)
- `lineHeight*` ($type `number`, unitless multiplier; apply to text styles as %)
- `motionDuration*` ($type `duration`), `motionEase*` ($type `cubicBezier`)
- Skipped (not Figma-variable-friendly): `algorithm`, `primaryPalette`, `presets` — keep `brand.json` `primaryPalette` for color-ramp rebuilds.

Source of truth: `system/tokens.{default,dark,compact}.json`, `system/variables.css`, `system/BRAND-SYSTEM.md`, `context/catalog-data.json`.

---

## Golden sources (never invent values)

- Palette: `#08798f` accent / `#00596b` deep / `#f5f5f7` bg / `#1d1d1f` ink (dark shell `#070b12→#0e1626`)
- Teal promo strip: `#00596b → #00768f → #008da8`
- Type: Vazirmatn FD 400–800, size 14 base, lineHeight 1.5714, heading weights 700/800
- Grid: 8 px, radius 8/18/10/980, 1 px hairline, motion 0.1s/0.2s cubic-bezier(0.2,0.8,0.2,1)