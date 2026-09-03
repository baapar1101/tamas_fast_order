# Graph Report - tamas_fast_order  (2026-09-03)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 46 nodes · 86 edges · 10 communities (8 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b9c38c0c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 8
- Community 9

## God Nodes (most connected - your core abstractions)
1. `index.html.js` - 30 edges
2. `Code.gs.js` - 12 edges
3. `render()` - 8 edges
4. `esc()` - 7 edges
5. `load()` - 6 edges
6. `renderCart()` - 6 edges
7. `doGet()` - 5 edges
8. `getSheet_()` - 5 edges
9. `doPost()` - 4 edges
10. `registerUser_()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `index.html.js` --indirect_call--> `render()`  [INFERRED]
  index.html → index.html  _Bridges community 4 → community 0_
- `doPost()` --calls--> `createOrder_()`  [EXTRACTED]
  Code.gs → Code.gs  _Bridges community 1 → community 8_
- `doGet()` --calls--> `output_()`  [EXTRACTED]
  Code.gs → Code.gs  _Bridges community 1 → community 5_
- `render()` --calls--> `esc()`  [EXTRACTED]
  index.html → index.html  _Bridges community 2 → community 4_
- `renderCart()` --calls--> `esc()`  [EXTRACTED]
  index.html → index.html  _Bridges community 2 → community 3_

## Import Cycles
- None detected.

## Communities (10 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.25
Nodes (6): index.html.js, allProducts, cart, catalog, closeRegister(), submitRegistration()

### Community 1 - "Community 1"
Cohesion: 0.48
Nodes (7): Code.gs.js, doPost(), headers_(), json_(), output_(), registerUser_(), SHEETS

### Community 2 - "Community 2"
Cohesion: 0.43
Nodes (7): assetIcon_(), buildBrands(), buildCategories(), demoProducts(), esc(), jsonp(), load()

### Community 3 - "Community 3"
Cohesion: 0.40
Nodes (5): addToCart(), changeQty(), closeModal(), renderCart(), submitOrder()

### Community 4 - "Community 4"
Cohesion: 0.40
Nodes (5): filterBrand(), filterCategory(), render(), sortPrice(), togglePromotion()

### Community 5 - "Community 5"
Cohesion: 0.83
Nodes (4): doGet(), getCatalog_(), getSettings_(), read_()

### Community 6 - "Community 6"
Cohesion: 1.00
Nodes (3): changeSlide(), goToSlide(), resetSliderTimer()

## Knowledge Gaps
- **4 isolated node(s):** `allProducts`, `cart`, `catalog`, `SHEETS`
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `index.html.js` connect `Community 0` to `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 9`?**
  _High betweenness centrality (0.384) - this node is a cross-community bridge._
- **Why does `Code.gs.js` connect `Community 1` to `Community 8`, `Community 5`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `render()` connect `Community 4` to `Community 0`, `Community 9`, `Community 2`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `allProducts`, `cart`, `catalog` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._