---
name: tamasmarket
description: tamasmarket design system for Tamas Market (تماس مارکت), an Iranian wholesale mobile-accessories storefront plus dark ops admin. Use when producing any on-brand artifact — storefront pages, promo/landing pages, emails, admin UI — from this design system package.
---

# tamasmarket — Design System Skill

Use this skill when producing branded artifacts (storefront, promo, email, admin, landing, deck, poster) for **Tamas Market**.

## What is inside

A complete design system package for the tamasmarket wholesale storefront + dark ops admin: palette + type tokens (`colors_and_type.css`), full spec (`DESIGN.md`, incl. source-backed Design Context / Components / Motion / Anti-patterns), generated token tree (`system/`), real Vazirmatn FD fonts (`fonts/`), real logo/banner/product assets (`logos/`, `imagery/`), seven focused preview cards (`preview/`), a runnable React UI kit with six reusable role components (`ui_kits/app/`), and measured `source_examples/*.tsx` code.

## Source context

Everything is measured from the real product, not invented:

- **Client catalogs** `D:\tamas_fast_order\catalogs` — BOROFONE / HIMI / YESIDO / VENDENS price lists and photos, extracted into `context/catalog-data.json` (verbatim sheets + PDF-confirmed model codes + asset manifest).
- **Storefront code** `source_examples/` — `ProductCard.tsx`, `CartPanel.tsx`, `AdminApp.tsx`, `global.css`.
- **Evidence COPIES** live in the package: `context/local-code/catalogs.md`, `context/github/source-context.md`, `prefetch/`.

## When to use

Use this skill for any on-brand artifact for Tamas Market: storefront/product pages, promo/landing/emails, the dark ops admin, decks and posters. It is the single source of truth for palette, type, motion, and product data.

## How to use

1. Load `colors_and_type.css` first (fonts + `--tamas-*` tokens).
2. Follow `DESIGN.md` posture rules; keep tokens within the locked set.
3. Only use real products/prices from `context/catalog-data.json`; bind real art from `logos/` + `imagery/`.
4. Verify against `preview/*.html` cards and the `ui_kits/app/` composition; run the package audit when available.

## Palette

- Canvas `#f5f5f7` · Surface `#ffffff` · Foreground `#1d1d1f` · Muted `#7a7a7a` · Border `#e0e0e0`
- Accent `#08798f` · Deep accent `#00596b`
- **States:** success `#34c759` · warning `#ff9500` · danger `#ff3b30`
- **Dark ops shell:** ink `#070b12/#0b111d/#0e1626/#131c2e` · emerald `#10b981` · cyan `#06b6d4`

## Typography

- Vazirmatn FD (shipped in `fonts/`), weights 400–800; display 700/800, body 400/700.
- Fallbacks: Vazirmatn, Tahoma, Segoe UI, sans-serif.
- Persian **RTL-first**; isolate LTR islands (prices/phones/order codes) with `unicode-bidi: isolate; direction: ltr`.

## Rule of thumb

- Teal accent is `#08798f` everywhere; deep teal `#00596b` for links/promo text. Never add hues outside the set above.
- Radii: 8px default, 18px cards, 10px inputs, 980px pill buttons. Pills = action (CTA, chips, search). Hairline `#e0e0e0` borders. 8px spacing grid.
- Promo strip gradient `#00596b → #00768f → #008da8` is the brand flourish — the system's ONE decorative gradient. (Same teal family as the client's real BOROFONE tile marks.) Dark admin shell ink surfaces with emerald/cyan accents.
- Interaction: buttons `:active { transform: scale(0.95) }`; states = default + active/pressed only (never hover-only). Focus ring 2px accent on light, 2px admin cyan on dark.
- Elevation: chrome shadows stay whisper (0.02/0.04/0.08); the heavy shadow is for product renders only.
- Motion: 0.2s `cubic-bezier(0.2, 0.8, 0.2, 1)`; 0.1s press feedback.
- Touch targets ≥ 44px; breakpoints 1440 / 1068 / 834 / 640.
- Use real art from this package (`logos/`, `imagery/`, `assets/`) — never hot-link or invent.
- Catalog principle: every product/SKU/price must come from `context/catalog-data.json` (real BOROFONE/HIMI/YESIDO/VENDENS sheets) — use `imagery/products/catalog/` + `imagery/banners/` real photography. Never fabricate model codes or `قیمت فروش` values.

## Files

- **`DESIGN.md`** — full spec (incl. Catalog Evidence section). **`colors_and_type.css`** — paste as the FIRST `<style>` block: fonts + all `--tamas-*` tokens.
- **`system/`** — token JSON + generated `variables*.css` (`--brand-color-*`). **`kit.html`/`kit.dark.html`/`index.html`** — generated previews.
- **`source_examples/`** — measured component code. **`ui_kits/app/`** — browser UI kit (`window.APP`).
- **`preview/`** — static cards to embed in reviews/PRs.
- **`context/catalog-data.json`** — machine-readable extraction of the real catalogs (BOROFONE/HIMI/YESIDO/VENDENS sheets, banners, photos, logos). **`imagery/products/catalog/`**, **`imagery/banners/`**, **`logos/borofone/`** — real ported catalog assets.

## Deliverable rules

1. Start every artifact with `colors_and_type.css`.
2. Bind real fonts/imagery from package folders; never guess filenames.
3. Keep RTL copy genuine Persian; use real catalog model codes and `قیمت فروش` values from `context/catalog-data.json` (mark any non-catalog value as sample).
4. Ship `:active` scale + 2px focus ring on all interactive controls; never a hover-only state.
5. Elevation audit: no shadow on cards/buttons/text beyond the three whisper tokens; the product shadow belongs to product imagery.
6. After shipping a package, run a design-system audit if available and fix warnings.

## Provenance

Formalized by OpenDesign from candidate 428d3d45-5e62-4163-a1c6-b5a7cc4a7224.
