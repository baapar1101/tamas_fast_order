# Graph Report - tamas_fast_order  (2026-09-04)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 75 nodes · 135 edges · 15 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `01929d54`
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
- Community 12

## God Nodes (most connected - your core abstractions)
1. `doPost()` - 8 edges
2. `main()` - 7 edges
3. `buildBrands()` - 7 edges
4. `cmd_pull()` - 6 edges
5. `cmd_push()` - 6 edges
6. `cmd_diff()` - 6 edges
7. `getSheet_()` - 6 edges
8. `doGet()` - 6 edges
9. `getCatalog_()` - 6 edges
10. `esc()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `cmd_push()` --calls--> `read_excel_catalog()`  [EXTRACTED]
  sync_spreadsheet.py → sync_spreadsheet.py  _Bridges community 5 → community 2_
- `cmd_pull()` --calls--> `fetch_csv_from_gss()`  [EXTRACTED]
  sync_spreadsheet.py → sync_spreadsheet.py  _Bridges community 5 → community 6_
- `main()` --calls--> `cmd_pull()`  [EXTRACTED]
  sync_spreadsheet.py → sync_spreadsheet.py  _Bridges community 6 → community 8_
- `main()` --calls--> `cmd_push()`  [EXTRACTED]
  sync_spreadsheet.py → sync_spreadsheet.py  _Bridges community 2 → community 8_
- `main()` --calls--> `cmd_diff()`  [EXTRACTED]
  sync_spreadsheet.py → sync_spreadsheet.py  _Bridges community 5 → community 8_

## Import Cycles
- None detected.

## Communities (15 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.22
Nodes (6): allProducts, cart, catalog, closeRegister(), selectedBrands, submitRegistration()

### Community 1 - "Community 1"
Cohesion: 0.39
Nodes (7): createOrder_(), DEFAULT_HEADERS, getSheet_(), headers_(), registerUser_(), SHEETS, updateStock_()

### Community 2 - "Community 2"
Cohesion: 0.38
Nodes (6): cmd_push(), cmd_watch(), push_to_web_app(), Upload catalog data to Google Apps Script Web App., Push local Excel data to Google Sheets via Apps Script Web App., Watch local Excel file for modifications and push automatically.

### Community 3 - "Community 3"
Cohesion: 0.67
Nodes (6): doGet(), exportAll_(), getCatalog_(), getSettings_(), read_(), setupSheets_()

### Community 4 - "Community 4"
Cohesion: 0.40
Nodes (6): doPost(), json_(), output_(), syncCatalog_(), syncSheet_(), writeSheetObjects_()

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (6): cmd_diff(), fetch_csv_from_gss(), Fetch sheet content via Google Sheets CSV export URL (no API key required if…, Compare local Excel data against remote Google Sheet data., Read local Excel workbook and return dictionary of sheets with rows., read_excel_catalog()

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (6): cmd_pull(), fetch_from_web_app(), Write catalog data (dict of lists) to Excel workbook., Fetch data from deployed Google Apps Script Web App endpoint., Pull data from Google Sheets / Apps Script and update local Excel and JSON…, write_excel_catalog()

### Community 7 - "Community 7"
Cohesion: 0.40
Nodes (5): changeQty(), closeModal(), money(), renderCart(), submitOrder()

### Community 8 - "Community 8"
Cohesion: 0.40
Nodes (5): load_config(), main(), Load configuration from sync_config.json if it exists., Save current configuration to sync_config.json., save_config()

### Community 9 - "Community 9"
Cohesion: 0.83
Nodes (4): buildBrands(), categoryBrandNames_(), filterBrand(), normalizeFilterValue_()

### Community 10 - "Community 10"
Cohesion: 1.00
Nodes (3): assetIcon_(), buildCategories(), esc()

### Community 11 - "Community 11"
Cohesion: 1.00
Nodes (3): changeSlide(), goToSlide(), resetSliderTimer()

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (3): demoProducts(), jsonp(), load()

## Knowledge Gaps
- **6 isolated node(s):** `allProducts`, `cart`, `catalog`, `selectedBrands`, `DEFAULT_HEADERS` (+1 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cmd_push()` connect `Community 2` to `Community 8`, `Community 5`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `cmd_pull()` connect `Community 6` to `Community 8`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `cmd_diff()` connect `Community 5` to `Community 8`, `Community 2`, `Community 6`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `allProducts`, `cart`, `catalog` to the rest of the system?**
  _6 weakly-connected nodes found - possible documentation gaps or missing edges._