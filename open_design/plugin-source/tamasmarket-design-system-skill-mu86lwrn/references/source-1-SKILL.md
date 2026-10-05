use ---
description: tamasmarket design system for Tamas Market (تماس مارکت), an Iranian wholesale mobile-accessories storefront plus dark ops admin. Use when producing any on-brand artifact — storefront pages, promo/landing pages, emails, admin UI — from this design system package.
name: tamasmarket
---

# tamasmarket — Design System Skill

Use this skill when producing branded artifacts (storefront, promo, email, admin, landing, deck, poster) for **Tamas Market**.

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
- Promo strip gradient `#00596b → #00768f → #008da8` is the brand flourish — the system's ONE decorative gradient. Dark admin shell ink surfaces with emerald/cyan accents.
- Interaction: buttons `:active { transform: scale(0.95) }`; states = default + active/pressed only (never hover-only). Focus ring 2px accent on light, 2px admin cyan on dark.
- Elevation: chrome shadows stay whisper (0.02/0.04/0.08); the heavy shadow is for product renders only.
- Motion: 0.2s `cubic-bezier(0.2, 0.8, 0.2, 1)`; 0.1s press feedback.
- Touch targets ≥ 44px; breakpoints 1440 / 1068 / 834 / 640.
- Use real art from this package (`logos/`, `imagery/`, `assets/`) — never hot-link or invent.

## Files

- **`DESIGN.md`** — full spec. **`colors_and_type.css`** — paste as the FIRST `<style>` block: fonts + all `--tamas-*` tokens.
- **`system/`** — token JSON + generated `variables*.css` (`--brand-color-*`). **`kit.html`/`kit.dark.html`/`index.html`** — generated previews.
- **`source_examples/`** — measured component code. **`ui_kits/app/`** — browser UI kit (`window.APP`).
- **`preview/`** — static cards to embed in reviews/PRs.

## Deliverable rules

1. Start every artifact with `colors_and_type.css`.
2. Bind real fonts/imagery from package folders; never guess filenames.
3. Keep RTL copy genuine Persian; do not invent wholesale prices (mark samples).
4. Ship `:active` scale + 2px focus ring on all interactive controls; never a hover-only state.
5. Elevation audit: no shadow on cards/buttons/text beyond the three whisper tokens; the product shadow belongs to product imagery.
6. After shipping a package, run a design-system audit if available and fix warnings.