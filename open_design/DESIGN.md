---
name: "tamasmarket"
category: Brands
surface: web
colors:
  background: "#f5f5f7"
  surface: "#ffffff"
  foreground: "#1d1d1f"
  muted: "#7a7a7a"
  border: "#e0e0e0"
  accent: "#08798f"
  accent-secondary: "#00596b"
---

# tamasmarket

> Category: Brands

> Surface: web

*تماس مارکت | فروشگاه دیجیتال*

Tamas Market is an Iranian wholesale (omdeh) webstore for mobile accessories — phone cases, chargers, cables, glass protectors, earphones — rebuilt on Node.js + PostgreSQL + React with two-way Google Sheets sync. Fast order, wholesale pricing, and a dark ops dashboard for the admin. The storefront spans real appliance lines sourced from the client's catalogs (D:\tamas_fast_order\catalogs): BOROFONE (BX cables, BJ power banks, BR/BS speakers, BO headphones, BG mouse/keyboard, BH/BQ holders), HIMI (MOTION airpods, XOOM speakers, NITRO chargers, FUSION cables, VOLTA power banks), YESIDO (models YAU/GS/HM/TWS/MG/SF/CA…), and VENDENS power banks. Prices in previews come from the real BOROFONE PRICE LIST / HIMI PRICE / YESIDO 222 / POWERBANK BASKET sheets and the catalog PDFs — not invented.

## Color Palette

| Role | Name | Hex | Usage |
| --- | --- | --- | --- |
| background | Background | `#f5f5f7` | page canvas (storefront shell) |
| surface | Surface | `#ffffff` | cards, modal panels, inputs |
| foreground | Foreground | `#1d1d1f` | body text / headings |
| muted | Muted | `#7a7a7a` | secondary text, faint labels |
| border | Border | `#e0e0e0` | hairlines, dividers, 1px borders |
| accent | Accent | `#08798f` | brand teal — logo mark, promo strip, primary CTA |
| accent-secondary | Accent secondary | `#00596b` | deep teal — promo CTA text, links, dark footer |

## Typography
- **Display:** Vazirmatn FD — weights 700, 800 — fallbacks: Vazirmatn, Tahoma, Segoe UI, sans-serif
- **Body:** Vazirmatn FD — weights 400, 700 — fallbacks: Vazirmatn, Tahoma, Segoe UI, sans-serif

## Voice & Tone

- **Adjectives:** wholesale, specialist, fast, trusted, transparent
- **Tone:** Confident and dependable — plain, direct, RTL Persian copy that leads with price, speed and trust. No hype.

### Messaging pillars
- تماس مارکت | فروشگاه دیجیتال
- مرجع تخصصی فروش عمده کالای دیجیتال
- سفارش سریع عمده لوازم جانبی موبایل
- شفافیت، اعتماد و همکاری پایدار

### Vocabulary
- **Use:** فروش عمده (wholesale), لوازم جانبی موبایل, سفارش سریع (fast order), قیمت عمده, ضمانت و تعویض
- **Avoid:** (none yet)

## Imagery

- **Style:** Bright, minimal, product-first: clean product shots on near-white, signature teal gradient promo banners, dark teal footer. Product photos are the client's own catalog photography (BOROFONE/HIMI/YESIDO/VENDENS lines) downscaled into imagery/products/catalog/.
- **Subjects:** BOROFONE cables (BX19…BX114), chargers (BA/BAS), power banks (BJ25…BJ69), BOROFONE speakers (BR/BS party boxes), headphones (BO), headsets (BE/BM), mice & keyboards (BG), BOROFONE holders (BH/BQ), car chargers (BZ), smart watch (BD/SE2-ULTRA), HIMI airpods (MOTION), speakers (XOOM), chargers (NITRO), cables (FUSION), power banks (VOLTA), scales (SENSE), YESIDO electronics (YAU/GS/TWS/MG/SF/CA/C models), VENDENS power banks (PB041/PB042), wholesale price-list sheets and basket totals (qty × unit price)
- **Treatment:** Full-frame product photos on white; no composite collages; real banner artwork from the catalog bundle (BANNER-01..06, BANNER-N-01..04).
- **Avoid:** busy backgrounds, washed-out cross-sells

## Layout

- **Radius:** 8px
- **Border weight:** 1px
- **Spacing:** 8px baseline grid

### Posture rules
- Persian RTL-first; isolate LTR spans (prices, phone numbers, order codes) with unicode-bidi: isolate.
- Pill-shaped primary buttons (border-radius 980px); cards and modals use 18px, inputs 10px. Pills signal action: primary CTA, chips and search inputs all use the pill radius.
- Signature flourish: the teal promo strip gradient (#00596b → #00768f → #008da8) across the top bar — the system's ONE decorative gradient.
- Dark ops admin shell: slate-ink surfaces (#070b12 → #0e1626) with emerald/cyan accents.
- Compact Apple-style header (44px) with 12px backdrop blur.
- Shadows: 0 1px 3px / 0 4px 14px / 0 12px 32px -4px (rgba black at 0.02/0.04/0.08) — whisper-level on chrome. The heavy shadow (0 12px 32px -4px at 0.14) is reserved for product renders resting on a surface, never cards, buttons or text.
- Interaction: buttons scale to 0.95 on :active (system-wide micro-interaction). States are default + active/pressed only — never hover-only. Focus ring is 2px solid accent teal on light surfaces and 2px admin cyan on the dark shell.
- Motion: all transitions 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) (0.1s for press feedback); modal pop and promo sheen keyframes come from the storefront.
- Catalog principle: products, model codes and prices in any preview must come from the real catalogs (context/catalog-data.json + imagery/products/catalog/ + imagery/banners/) — BOROFONE/HIMI/YESIDO/VENDENS lines with their actual SKUs (BX, BJ, BR, BO, BH, BG, MOTION, XOOM, NITRO, FUSION, VOLTA, YAU, GS, PB…). Wholesale price columns (قیمت فروش) are real extractions, not samples.
