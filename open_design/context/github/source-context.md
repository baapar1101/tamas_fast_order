# GitHub source evidence

Status: **No remote GitHub repositories were used as design-system sources.**

- `brand.json#sourceUrl` (`https://anker.com/`) is a brand/domain reference, not a design source.
- All design evidence comes from **local files** that were inspected directly (no GitHub dependency):
  - `D:\tamas_fast_order\catalogs` — the client's wholesale catalog bundle (XLSX price lists, PDFs, product-photo folders, banners, BOROFONE logo tiles). Extracted to `context/catalog-data.json`.
  - `source_examples/` (`AdminApp.tsx`, `CartPanel.tsx`, `ProductCard.tsx`, `global.css`) — the storefront implementation.
  - `prefetch/` (`page.html`, `styles.css`, `material.md`) — captured storefront page snapshot.
- Component roles checked against `source_examples/*.tsx` (app shell, nav/sidebar, list rail, chat area/message bubbles, input bar/composer, product card).

No GitHub repo URL is relied on for the final files; nothing in the package is gated on a remote repository being reachable.