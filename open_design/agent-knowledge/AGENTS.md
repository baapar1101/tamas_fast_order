# Tamas Fast Order — Agent Knowledge Base

This folder is the single source of truth for any AI agent (or human) that needs the Tamas Fast Order design system, catalog data, or project context. Everything here is a copy of the canonical files at the project root; edit the root files, then refresh the copies.

## What is this product

- **System:** Tamas Fast Order (تامس فست اردر) — a wholesale mobile-accessory ordering (<فروش عمده>) web app.
- **Catalog source:** the system is built around real accessory catalogs: BOROFONE, YESIDO, VENDENS, and HIMI brands.
- **Tone:** RTL-first Persian commerce UI with per-branch promo vibrancy, anchored in teal `#08798f`.
- **Brand tile (BOROFONE) mid-stop:** `#00768f` — this is a verified brand asset stop, not a system hue.

## Quick tokens (locked)

| Token | Light | Dark |
|---|---|---|
| bg | `#f5f5f7` | `#17202a` |
| surface | `#ffffff` | `#0d1420` |
| fg | `#1d1d1f` | `#eef0f6` |
| muted | `#7a7a7a` | `#9aa4b4` |
| border | `#e0e0e0` | `#2b313c` |
| accent (primary) | `#08798f` | `#44b5c9` |
| accent-deep / secondary | `#00596b` | `#2f85a0` |
| success / warning / danger | `#34c759` / `#ff9500` / `#ff3b30` | `#10b981` / `#f59e0b` / `#fb7185` |

- **Type:** Vazirmatn FD (Latin+Persian), weights 400/500/600/700/800; files in `../fonts/`.
- **Geometry:** 8px spacing grid, 1px borders, 8px default radius, 4px focus ring.
- **Direction:** RTL-first; LTR islands via `unicode-bidi: isolate`.
- Promo gradient: `#00596b → #00768f → #008da8`.

## Files in this folder

- `DESIGN.md` — canonical design system spec (tokens, typography, branding rules, motion, anti-patterns).
- `README.md` — package overview, Product Overview, package contents, preview manifest, reuse/review workflow.
- `SKILL.md` — Claude/reusable-skill description of the system (frontmatter + What is inside / Source context / When to use / How to use / Design system highlights).
- `guide.md` — short brand guide (usage, source basis, constraints).
- `brand.json` — brand metadata as returned by `od brand get`.
- `colors_and_type.css` — concrete reusable tokens (light + dark, ink/admin variants).
- `context/source-context.md` — setup/evidence contract (how the system was collected, review contract).
- `context/catalogs.md` — local catalog evidence inventory (37 paths discovered, 25 SVG snapshots).
- `context/source-context-github.md` — GitHub evidence note.
- `system/BRAND-SYSTEM.md` — Open Design system reference.
- `system/seed.json`, `system/theme.json`, `system/tokens.default.json`, `system/tokens.dark.json`, `system/tokens.compact.json` — canonical token values (state colors hand-applied after each `brand finalize`).
- `system/variables.css`, `system/variables.dark.css` — compiled CSS variables.
- `data/catalog-data.json` — real catalog extraction (products, prices, unit notes; **price units matter, see below**).
- `verified-scorecard.md` — checked ground-truth rules (palette, typography, layout, brand assets, agent-knowledge conventions).

## Where the heavy assets live (referenced, not duplicated)

These are byte-for-byte preserved elsewhere in the project — point agents at them, do not recreate:

- **Product/banner photos:** `../imagery/` (real catalog jpgs; sizes may be unknown for some, and some banners are dual-product panels).
- **Logos:** `../logos/` (BOROFONE etc.) and `../assets/` (`logo.svg`, `admin-logo.svg`, `banner-prompt-template.md`).
- **Runtime icons:** `../build/` (preserved runtime assets).
- **Fonts:** `../fonts/` (Vazirmatn FD `.woff2`, `slick-400.woff`, `fonts.css`, `manifest.json`).
- **Preview cards:** `../preview/` (light/dark cards + colors-primary, typography-specimens, spacing-tokens, components-buttons, brand-assets).
- **Applied UI kit:** `../ui_kits/app/` (`index.html`, `components/` — app-shell, nav-sidebar, list, chat, message, composer; `README.md`).
- **Source examples:** `../source_examples/`.

## Verified rules (do not violate)

1. **Palette is locked.** Only the tokens above. New hues require brand-asset evidence. `#00768f` and `#EB5B28` (BOROFONE orange accents) are brand-asset stops, allowed only as brand accents/promo stops — never as system surface/text color.
2. **`brand finalize` normalizes state colors** — after running it, re-apply: light `#34c759/#ff9500/#ff3b30`, dark `#10b981/#f59e0b/#fb7185` in seeds, themes, tokens, and `variables.css`/`variables.dark.css`.
3. **RTL-first.** Persian first, LTR islands for product/tech-literals isolated direction.
4. **Typography** = Vazirmatn FD. No fallback fonts in `colors_and_type.css`; bind font files with `@font-face`.
5. **Price units** in catalog-data: BOROFONE/YESIDO/VENDENS `قیمت فروش` = **thousand-Toman**; HIMI = **Rial**. Format money with Persian digits + `هزار تومان` or `ریال` labels.
6. **Product photos are category-level**, not per-SKU — never caption a photo as an exact model.
7. **Admin/merchant variants** use ink shells (`#{070b12,0b111d,0e1626,131c2e}`) with `--tamas-ink-fg #eef0f6` / `--tamas-ink-muted #9aa4b4` and `--tamas-admin-emerald #10b981`.

## How to use this folder

1. Read `AGENTS.md` (this file) first for the ground truths.
2. Deep design decisions → `DESIGN.md`; package/usage docs → `README.md` + `SKILL.md`.
3. Concrete CSS tokens → `colors_and_type.css`; token values → `system/*.json`.
4. Real catalog numbers → `data/catalog-data.json`; proof/inventory → `context/*.md`.
5. Produced visual artifacts (previews, UI kits) must load `colors_and_type.css` and use only the tokens above, then pass:

```powershell
& $env:OD_NODE_BIN $env:OD_BIN tools connectors design-system-package-audit --path . --reference-package --fail-on-warnings
```

## Refresh procedure

After editing any root doc/token, re-copy with:

```powershell
Copy-Item -LiteralPath DESIGN.md,SKILL.md,README.md,guide.md,brand.json,colors_and_type.css -Destination agent-knowledge -Force
Copy-Item -LiteralPath "context\source-context.md","context\github\source-context.md","context\local-code\catalogs.md" -Destination "agent-knowledge\context" -Force
Copy-Item -LiteralPath "context\catalog-data.json" -Destination "agent-knowledge\data" -Force
Copy-Item -LiteralPath "system\BRAND-SYSTEM.md","system\seed.json","system\theme.json","system\tokens.default.json","system\tokens.dark.json","system\tokens.compact.json","system\variables.css","system\variables.dark.css" -Destination "agent-knowledge\system" -Force
```