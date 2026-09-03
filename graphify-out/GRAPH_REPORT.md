# Graph Report - tamas_fast_order  (2026-09-03)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 77 nodes · 143 edges · 13 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `59b7868d`
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
- Community 11

## God Nodes (most connected - your core abstractions)
1. `doPost()` - 8 edges
2. `render()` - 8 edges
3. `main()` - 7 edges
4. `esc()` - 7 edges
5. `getSheet_()` - 6 edges
6. `load()` - 6 edges
7. `cmd_push()` - 6 edges
8. `doGet()` - 6 edges
9. `getCatalog_()` - 6 edges
10. `cmd_diff()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `submitOrder()` --calls--> `renderCart()`  [EXTRACTED]
  index.html → index.html  _Bridges community 0 → community 8_
- `doPost()` --calls--> `createOrder_()`  [EXTRACTED]
  Code.gs → Code.gs  _Bridges community 1 → community 5_
- `getSettings_()` --calls--> `getSheet_()`  [EXTRACTED]
  Code.gs → Code.gs  _Bridges community 1 → community 4_
- `main()` --calls--> `cmd_diff()`  [EXTRACTED]
  sync_spreadsheet.py → sync_spreadsheet.py  _Bridges community 10 → community 6_
- `main()` --calls--> `cmd_pull()`  [EXTRACTED]
  sync_spreadsheet.py → sync_spreadsheet.py  _Bridges community 10 → community 7_

## Import Cycles
- None detected.

## Communities (13 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.22
Nodes (7): allProducts, cart, catalog, closeModal(), closeRegister(), submitOrder(), submitRegistration()

### Community 1 - "Community 1"
Cohesion: 0.39
Nodes (7): createOrder_(), DEFAULT_HEADERS, getSheet_(), headers_(), registerUser_(), SHEETS, updateStock_()

### Community 2 - "Community 2"
Cohesion: 0.43
Nodes (7): assetIcon_(), buildBrands(), buildCategories(), demoProducts(), esc(), jsonp(), load()

### Community 3 - "Community 3"
Cohesion: 0.38
Nodes (6): cmd_push(), cmd_watch(), push_to_web_app(), Upload catalog data to Google Apps Script Web App., Push local Excel data to Google Sheets via Apps Script Web App., Watch local Excel file for modifications and push automatically.

### Community 4 - "Community 4"
Cohesion: 0.67
Nodes (6): doGet(), exportAll_(), getCatalog_(), getSettings_(), read_(), setupSheets_()

### Community 5 - "Community 5"
Cohesion: 0.40
Nodes (6): doPost(), json_(), output_(), syncCatalog_(), syncSheet_(), writeSheetObjects_()

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (6): cmd_diff(), fetch_csv_from_gss(), Fetch sheet content via Google Sheets CSV export URL (no API key required if…, Compare local Excel data against remote Google Sheet data., Read local Excel workbook and return dictionary of sheets with rows., read_excel_catalog()

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (6): cmd_pull(), fetch_from_web_app(), Write catalog data (dict of lists) to Excel workbook., Fetch data from deployed Google Apps Script Web App endpoint., Pull data from Google Sheets / Apps Script and update local Excel and JSON…, write_excel_catalog()

### Community 8 - "Community 8"
Cohesion: 0.40
Nodes (5): addToCart(), changeQty(), money(), renderCart(), variantHTML()

### Community 9 - "Community 9"
Cohesion: 0.40
Nodes (5): filterBrand(), filterCategory(), render(), sortPrice(), togglePromotion()

### Community 10 - "Community 10"
Cohesion: 0.40
Nodes (5): load_config(), main(), Load configuration from sync_config.json if it exists., Save current configuration to sync_config.json., save_config()

### Community 11 - "Community 11"
Cohesion: 1.00
Nodes (3): changeSlide(), goToSlide(), resetSliderTimer()

## Knowledge Gaps
- **5 isolated node(s):** `allProducts`, `cart`, `catalog`, `DEFAULT_HEADERS`, `SHEETS`
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cmd_push()` connect `Community 3` to `Community 10`, `Community 6`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `cmd_pull()` connect `Community 7` to `Community 10`, `Community 3`, `Community 6`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `cmd_diff()` connect `Community 6` to `Community 10`, `Community 3`, `Community 7`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `allProducts`, `cart`, `catalog` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._