# Tamas Market | Design System 🎨

> **Category:** Brands
> **Surface:** Web
> **Theme:** تماس مارکت | فروشگاه دیجیتال

Tamas Market is an Iranian wholesale (omdeh) webstore for mobile accessories — phone cases, chargers, cables, glass protectors, earphones — rebuilt on Node.js + PostgreSQL + React with two-way Google Sheets sync. Fast order, wholesale pricing, and a dark ops dashboard for the admin. 

This document serves as the single source of truth for the Tamas Market design system, layout rules, and responsive contracts.

---

## 🎨 Color Palette

| Role | Name | Hex | Usage |
| :--- | :--- | :--- | :--- |
| **Background** | Background | `#f5f5f7` | Page canvas (storefront shell) |
| **Surface** | Surface | `#ffffff` | Cards, modal panels, inputs |
| **Foreground** | Foreground | `#1d1d1f` | Body text / headings |
| **Muted** | Muted | `#7a7a7a` | Secondary text, faint labels |
| **Border** | Border | `#e0e0e0` | Hairlines, dividers, 1px borders |
| **Accent** | Accent | `#08798f` | Brand teal — logo mark, promo strip, primary CTA |
| **Accent Secondary** | Accent secondary | `#00596b` | Deep teal — promo CTA text, links, dark footer |
| **Dark Ops Shell** | Admin Dark | `#070b12` → `#0e1626` | Slate-ink surfaces with emerald/cyan accents |

**Signature Flourish:** The teal promo strip gradient (`#00596b` → `#00768f` → `#008da8`) across the top bar is the system's ONE decorative gradient.

---

## 🔤 Typography

- **Display:** `Vazirmatn FD` — weights `700`, `800` (Fallbacks: Vazirmatn, Tahoma, Segoe UI, sans-serif)
- **Body:** `Vazirmatn FD` — weights `400`, `700` (Fallbacks: Vazirmatn, Tahoma, Segoe UI, sans-serif)

---

## 📐 Layout & Spacing

- **Radius:** `8px` (base), `10px` (inputs), `18px` (cards and modals), `980px` (pill-shaped primary buttons, chips, search inputs).
- **Border weight:** `1px`
- **Spacing:** `8px` baseline grid
- **Header:** Compact Apple-style header (`44px`) with `12px` backdrop blur.

### Shadows
- **Whisper (Chrome):** `0 1px 3px` / `0 4px 14px` / `0 12px 32px -4px` (rgba black at 0.02 / 0.04 / 0.08)
- **Heavy (Product Renders):** `0 12px 32px -4px` (rgba black at 0.14) — *Reserved for product renders resting on a surface. Never cards, buttons, or text.*

---

## 📱 Responsive Viewports

Validate the implementation across this viewport matrix (Fluid `clamp()` type/spacing where applicable):

| Device Category | Name | Dimensions | Note |
| :--- | :--- | :--- | :--- |
| **Mobile** | Compact | 360 × 800 | Must avoid horizontal scroll |
| **Mobile** | Standard | 390 × 844 | Must avoid horizontal scroll |
| **Mobile** | Large | 430 × 932 | Must avoid horizontal scroll |
| **Tablet** | Foldable / Small | 600 × 960 | Must avoid horizontal scroll |
| **Tablet** | Portrait | 820 × 1180 | Must avoid horizontal scroll |
| **Tablet** | Landscape | 1024 × 768 | Must avoid horizontal scroll |
| **Desktop** | Laptop | 1366 × 768 | Must avoid horizontal scroll |
| **Desktop** | Standard | 1440 × 900 | Must avoid horizontal scroll |
| **Desktop** | Wide | 1920 × 1080 | Must avoid horizontal scroll |

---

## 👆 Interactions & States

- **Animation:** All transitions `0.2s cubic-bezier(0.2, 0.8, 0.2, 1)` (`0.1s` for press feedback).
- **Scale:** Buttons scale to `0.95` on `:active` (system-wide micro-interaction).
- **States:** Default + active/pressed only. **Never hover-only**.
- **Focus Ring:** `2px` solid accent teal on light surfaces and `2px` admin cyan on the dark shell.
- **Required Component States:** Default, hover, focus, active, disabled, loading, empty, error, success.

---

## 🗣️ Voice & Tone

- **Adjectives:** Wholesale, specialist, fast, trusted, transparent.
- **Tone:** Confident and dependable. Plain, direct, RTL Persian copy that leads with price, speed, and trust. No hype.
- **Messaging Pillars:**
  - تماس مارکت | فروشگاه دیجیتال
  - مرجع تخصصی فروش عمده کالای دیجیتال
  - سفارش سریع عمده لوازم جانبی موبایل
  - شفافیت، اعتماد و همکاری پایدار
- **Vocabulary:** Use: فروش عمده (wholesale), لوازم جانبی موبایل, سفارش سریع (fast order), قیمت عمده, ضمانت و تعویض.

---

## 🖼️ Imagery & Posture Rules

- **Style:** Bright, minimal, product-first. Clean product shots on near-white, signature teal gradient promo banners, dark teal footer. 
- **Subjects:** Catalog lines from BOROFONE, HIMI, YESIDO, VENDENS lines.
- **Treatment:** Full-frame product photos on white. No composite collages. Real banner artwork from the catalog bundle. Avoid busy backgrounds and washed-out cross-sells.
- **Posture Rules:**
  - Persian RTL-first. Isolate LTR spans (prices, phone numbers, order codes) with `unicode-bidi: isolate`.
  - Products, model codes, and prices in previews must come from real catalogs (e.g., BOROFONE PRICE LIST, YESIDO 222). Wholesale price columns (قیمت فروش) are real extractions, not samples.
