# verified scorecard — tamasmarket (anker-535220)

## palette
- 7 core tokens locked: bg #f5f5f7 / surface #ffffff / fg #1d1d1f / muted #7a7a7a / border #e0e0e0 / accent #08798f / accent-deep #00596b.
- state: light #34c759/#ff9500/#ff3b30, dark #10b981/#f59e0b/#fb7185.
- promo gradient #00596b→#00768f→#008da8; #00768f is BOROFONE tile mid-stop (brand asset, not a system hue).
- brand stops allowed as accents only: #00768f, #EB5B28 (BOROFONE orange).

## typography
- Vazirmatn FD only (400/500/600/700/800, woff2 in fonts/); bind via @font-face, no fallbacks in colors_and_type.css.
- RTL-first; LTR islands for SKUs/prices wrapped in Unicode BiDi isolate.

## layout / product
- 8px spacing grid, 1px borders, 8px default radius, 4px focus ring; pill primary CTA + promo strip (light), slate-ink admin shell (dark).
- Price units: BOROFONE/YESIDO/VENDENS = thousand-Toman, HIMI = Rial ("هزار تومان" / "ریال" captions mandatory).
- Product photos are category-level pairing, never exact-model claims.
- catalog-data.json is the only source for SKUs/prices.

## brand assets
- build/ preserves runtime assets byte-for-byte; preview/brand-assets.html must reference real files from build/ or assets/ (never inline redraws).
- assets/ has logo.svg + admin-logo.svg; logos/borofone/ holds 7 tile marks.

## agent-knowledge/ (new, this turn)
- Root folder for all AI agents: AGENTS.md index + copies of DESIGN/README/SKILL/guide/brand.json/colors_and_type.css, context evidence, system tokens, and data/catalog-data.json.
- Canonical originals stay at root (edits → root file, then re-copy).
- State colors are manually re-applied after each `brand finalize` (finalize normalizes them) — documented in AGENTS.md and README.md.