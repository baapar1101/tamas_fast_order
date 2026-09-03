# Graph Report - tamas_fast_order  (2026-09-03)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 81 nodes · 156 edges · 12 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7dacd40d`
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
- Community 7
- Community 8
- Community 9
- Community 10

## God Nodes (most connected - your core abstractions)
1. `render()` - 10 edges
2. `doPost()` - 8 edges
3. `buildBrands()` - 7 edges
4. `esc()` - 7 edges
5. `main()` - 7 edges
6. `doGet()` - 6 edges
7. `getCatalog_()` - 6 edges
8. `getSheet_()` - 6 edges
9. `renderCart()` - 6 edges
10. `cmd_push()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `renderCart()` --calls--> `esc()`  [EXTRACTED]
  index.html → index.html  _Bridges community 1 → community 2_
- `renderCart()` --calls--> `money()`  [EXTRACTED]
  index.html → index.html  _Bridges community 1 → community 10_
- `render()` --calls--> `variantHTML()`  [EXTRACTED]
  index.html → index.html  _Bridges community 10 → community 6_
- `variantHTML()` --calls--> `esc()`  [EXTRACTED]
  index.html → index.html  _Bridges community 10 → community 2_
- `load()` --calls--> `buildBrands()`  [EXTRACTED]
  index.html → index.html  _Bridges community 2 → community 9_

## Import Cycles
- None detected.

## Communities (12 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.24
Nodes (19): createOrder_(), DEFAULT_HEADERS, doGet(), doPost(), exportAll_(), getCatalog_(), getSettings_(), getSheet_() (+11 more)

### Community 1 - "Community 1"
Cohesion: 0.20
Nodes (10): addToCart(), allProducts, cart, catalog, changeQty(), closeModal(), closeRegister(), renderCart() (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.70
Nodes (5): assetIcon_(), buildBrands(), buildCategories(), esc(), filterCategory()

### Community 3 - "Community 3"
Cohesion: 0.33
Nodes (6): cmd_push(), cmd_watch(), push_to_web_app(), Upload catalog data to Google Apps Script Web App., Push local Excel data to Google Sheets via Apps Script Web App., Watch local Excel file for modifications and push automatically.

### Community 4 - "Community 4"
Cohesion: 0.33
Nodes (6): cmd_diff(), fetch_from_web_app(), Fetch data from deployed Google Apps Script Web App endpoint., Compare local Excel data against remote Google Sheet data., Read local Excel workbook and return dictionary of sheets with rows., read_excel_catalog()

### Community 5 - "Community 5"
Cohesion: 0.38
Nodes (6): cmd_pull(), fetch_csv_from_gss(), Write catalog data (dict of lists) to Excel workbook., Fetch sheet content via Google Sheets CSV export URL (no API key required if…, Pull data from Google Sheets / Apps Script and update local Excel and JSON…, write_excel_catalog()

### Community 6 - "Community 6"
Cohesion: 0.40
Nodes (5): filterBrand(), getProductStock(), render(), sortPrice(), togglePromotion()

### Community 7 - "Community 7"
Cohesion: 0.40
Nodes (5): load_config(), main(), Load configuration from sync_config.json if it exists., Save current configuration to sync_config.json., save_config()

### Community 8 - "Community 8"
Cohesion: 1.00
Nodes (3): changeSlide(), goToSlide(), resetSliderTimer()

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (3): demoProducts(), jsonp(), load()

### Community 10 - "Community 10"
Cohesion: 0.40
Nodes (5): categoryBrandNames_(), getColorHex(), money(), normalizeFilterValue_(), variantHTML()

## Knowledge Gaps
- **5 isolated node(s):** `DEFAULT_HEADERS`, `SHEETS`, `allProducts`, `cart`, `catalog`
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cmd_push()` connect `Community 3` to `Community 4`, `Community 5`, `Community 7`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `cmd_pull()` connect `Community 5` to `Community 4`, `Community 7`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `cmd_diff()` connect `Community 4` to `Community 5`, `Community 7`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `DEFAULT_HEADERS`, `SHEETS`, `allProducts` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._