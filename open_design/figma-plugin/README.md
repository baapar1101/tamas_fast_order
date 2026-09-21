# tamasmarket · Design System Builder (Figma plugin)

Two-click plugin that generates your **entire design system** inside an open Figma file —
no manual token entry, no external import needed.

## What it creates
- A page `tamasmarket Design System` containing:
  - **Cover** — brand name, Persian tagline, meta line
  - **Colors** — all 42 color tokens of the active theme as swatches (name + hex), each hooked to a reusable **Paint Style** (`colors/*`)
  - **Primary palette ramp** — the 10-step `primaryPalette`
  - **Typography** — Display / H1–H5 / Body / Small specimens at the exact token sizes & weights (Vazirmatn FD)
  - **Category icons** — all 17 brand icons rendered as vectors from the embedded SVGs
  - **Spacing & radius** — `size*`, `borderRadius*`, `lineWidth*`, `controlHeight*` token bars
- A **Variables collection `tamasmarket`** with 3 modes — `default`, `dark`, `compact` — carrying all **42 color variables × 3 themes** (126 values), directly editable as Figma Variables.

## Install (30 seconds)
1. Open Figma → **Plugins → Development → New plugin… →** (choose "local plugin" from the menu) → **Choose manifest.json** → select `manifest.json` in this folder.
2. Run it: **Plugins → Development → tamasmarket · Design System Builder**.

> Requires a design file open (works in web & desktop). Font note: it tries **Vazirmatn** first, falls back to Inter if the font isn't available to Figma — install Vazirmatn locally beforehand for exact rendering.

## Regenerate
The plugin is fully data-driven — `code.js` embeds the token JSON for all 3 themes plus the SVG assets baked at build time. Re-run it any time to rebuild the page from the current data.

## Source data
- `system/tokens.default.json`, `tokens.dark.json`, `tokens.compact.json` (78 tokens each)
- `imagery/icons/*.svg` (17 category icons)
- `build/logo.svg`, `build/toman.svg`

## Files
- `manifest.json` — Figma plugin manifest
- `code.js` — plugin script (data embedded, ~71 KB, no network)
- `code-template.js` — readable source template (data injected at build)