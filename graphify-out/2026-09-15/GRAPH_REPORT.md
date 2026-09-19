# Graph Report - tamas_fast_order  (2026-09-15)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 824 nodes · 1617 edges · 39 communities (33 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e5798179`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.ts
- sheets/sync.ts
- services/auth.ts
- useToast
- schemas.ts
- compilerOptions
- scripts
- web/package.json
- dependencies
- mapping.ts
- sync_spreadsheet.py
- scripts
- fallbackData.ts
- ProductsPage.tsx
- StorefrontPage.tsx
- schema.ts
- types.ts
- compilerOptions
- AdminApp.tsx
- import-legacy.ts
- shared/package.json
- dashboard.ts
- api.ts
- storefront/OrdersPage.tsx
- manifest.json
- LocalStorage
- AuthDialog.tsx
- ProductCard.tsx
- TtlCache
- money.ts
- phone.ts
- check_admins.ts
- fix-db.js
- fix-perms.js
- sw.js

## God Nodes (most connected - your core abstractions)
1. `useToast()` - 33 edges
2. `Db` - 26 edges
3. `api` - 23 edges
4. `badRequest()` - 21 edges
5. `notFound()` - 19 edges
6. `logAction()` - 19 edges
7. `scripts` - 19 edges
8. `compilerOptions` - 18 edges
9. `useAuth` - 15 edges
10. `scripts` - 14 edges

## Surprising Connections (you probably didn't know these)
- `routes()` --calls--> `badRequest()`  [EXTRACTED]
  apps/api/src/routes/auth.ts → apps/api/src/lib/errors.ts
- `sendOtp()` --calls--> `badRequest()`  [EXTRACTED]
  apps/api/src/services/otp.ts → apps/api/src/lib/errors.ts
- `routes()` --calls--> `buildSearchText()`  [EXTRACTED]
  apps/api/src/routes/admin/products.ts → apps/api/src/services/catalog.ts
- `routes()` --calls--> `isSyncRunning()`  [EXTRACTED]
  apps/api/src/routes/admin/sync.ts → apps/api/src/services/sheets/sync.ts
- `routes()` --calls--> `runSync()`  [EXTRACTED]
  apps/api/src/routes/admin/sync.ts → apps/api/src/services/sheets/sync.ts

## Import Cycles
- None detected.

## Communities (39 total, 6 thin omitted)

### Community 0 - "app.ts"
Cohesion: 0.08
Nodes (65): Db, sql, here, main(), migrationsFolder, uploads, env, isProd (+57 more)

### Community 1 - "sheets/sync.ts"
Cohesion: 0.06
Nodes (43): [directionArg = 'both', ...rest], dryRun, main(), only, CATALOGUE, check(), FakeSheet, main() (+35 more)

### Community 2 - "services/auth.ts"
Cohesion: 0.10
Nodes (38): otpCodes, sessions, adminPhones, bool, corsOrigins, envSchema, parsed, forbidden() (+30 more)

### Community 3 - "useToast"
Cohesion: 0.09
Nodes (29): Attribute, AttributesPage(), ImagePicker(), Props, BrandForm, BrandsPage(), EMPTY_FORM, CategoriesPage() (+21 more)

### Community 4 - "schemas.ts"
Cohesion: 0.05
Nodes (42): BrandWrite, brandWriteSchema, CatalogQuery, catalogQuerySchema, CategoryWrite, categoryWriteSchema, ColorWrite, colorWriteSchema (+34 more)

### Community 5 - "compilerOptions"
Cohesion: 0.05
Nodes (37): compilerOptions, composite, lib, module, moduleResolution, outDir, rootDir, types (+29 more)

### Community 6 - "scripts"
Cohesion: 0.06
Nodes (34): devDependencies, drizzle-kit, tsx, @types/node, typescript, main, name, private (+26 more)

### Community 7 - "web/package.json"
Cohesion: 0.06
Nodes (34): @tamas/shared, @tamas/shared, dependencies, react, react-dom, react-router-dom, @tamas/shared, @tanstack/react-query (+26 more)

### Community 8 - "dependencies"
Cohesion: 0.06
Nodes (33): dependencies, dotenv, drizzle-orm, fastify, @fastify/cookie, @fastify/cors, @fastify/helmet, @fastify/multipart (+25 more)

### Community 9 - "mapping.ts"
Cohesion: 0.07
Nodes (21): ApplyOutcome, BRAND_COLUMNS, brandMapping, CATEGORY_COLUMNS, categoryMapping, COLOR_COLUMNS, colorMapping, DbSideRow (+13 more)

### Community 10 - "sync_spreadsheet.py"
Cohesion: 0.12
Nodes (28): cmd_backup(), cmd_diff(), cmd_pull(), cmd_push(), cmd_watch(), fetch_csv_from_gss(), fetch_from_web_app(), load_config() (+20 more)

### Community 11 - "scripts"
Cohesion: 0.07
Nodes (28): engines, node, name, private, scripts, build, db:generate, db:migrate (+20 more)

### Community 12 - "fallbackData.ts"
Cohesion: 0.10
Nodes (25): allGroups, allProducts, fallbackBrands, fallbackCategories, fallbackColors, fallbackSettings, getFallbackBootstrap(), getFallbackProducts() (+17 more)

### Community 13 - "ProductsPage.tsx"
Cohesion: 0.12
Nodes (16): blank(), fromProduct(), ProductEditor(), ProductForm, Props, CHIP_TONE, OrdersPage(), OrdersResponse (+8 more)

### Community 14 - "StorefrontPage.tsx"
Cohesion: 0.16
Nodes (17): Icon(), IconName, IconProps, SvgSprite(), cartCount(), CartLine, CartState, cartTotal() (+9 more)

### Community 15 - "schema.ts"
Cohesion: 0.10
Nodes (19): attributes, auditLog, brandsRelations, categoriesRelations, categoryBrandsRelations, orderItemsRelations, ordersRelations, orderStatusEnum (+11 more)

### Community 16 - "types.ts"
Cohesion: 0.10
Nodes (21): OrderStatus, UploadKind, Warehouse, ApiError, ApiResult, AuthStateDTO, BrandDTO, CategoryDTO (+13 more)

### Community 17 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib, module (+11 more)

### Community 18 - "AdminApp.tsx"
Cohesion: 0.17
Nodes (12): AdminApp(), NAV_MAIN, NAV_TOOLS, DashboardPage(), MarketingPage(), MessagesPage(), AdminApp, App() (+4 more)

### Community 19 - "import-legacy.ts"
Cohesion: 0.18
Nodes (14): argv, fileArg, LegacyCatalog, main(), num(), splitList(), main(), closeDb() (+6 more)

### Community 20 - "shared/package.json"
Cohesion: 0.12
Nodes (15): dependencies, zod, exports, zod, main, name, private, scripts (+7 more)

### Community 21 - "dashboard.ts"
Cohesion: 0.22
Nodes (12): orderItems, orders, settings, syncState, users, routes(), recentAudit(), cache (+4 more)

### Community 22 - "api.ts"
Cohesion: 0.18
Nodes (10): ApiRequestError, Query, readToken(), request(), RequestOptions, toSearch(), writeToken(), AuthResponse (+2 more)

### Community 23 - "storefront/OrdersPage.tsx"
Cohesion: 0.26
Nodes (7): AnalyticsDTO, AnalyticsPage(), Price(), PrintInvoiceItem, PrintInvoiceLayout(), Props, STATUS_TONE

### Community 24 - "manifest.json"
Cohesion: 0.17
Nodes (11): background_color, description, dir, display, icons, lang, name, orientation (+3 more)

### Community 26 - "AuthDialog.tsx"
Cohesion: 0.22
Nodes (9): AuthDialog(), AuthResponse, emptyProfile(), OtpRequestResponse, PROFILE_FIELDS, ProfileForm, ProfileResponse, Props (+1 more)

### Community 27 - "ProductCard.tsx"
Cohesion: 0.39
Nodes (8): stockFor(), getWarehouseButtons(), ProductCard, productTitleClass(), Props, sellTypes(), swatchColor(), WAREHOUSE_ORDER

### Community 28 - "TtlCache"
Cohesion: 0.29
Nodes (3): catalogCache, Entry, TtlCache

### Community 30 - "phone.ts"
Cohesion: 0.70
Nodes (4): isValidPhone(), normalizeLandline(), normalizePhone(), toAsciiDigits()

## Knowledge Gaps
- **346 isolated node(s):** `PageParams`, `ProcessInput`, `OrderItemRow`, `OrderRow`, `ProductRow` (+341 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `scripts`, `web/package.json`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `Db` connect `app.ts` to `sheets/sync.ts`, `services/auth.ts`, `mapping.ts`, `schema.ts`, `import-legacy.ts`, `dashboard.ts`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `scripts` to `scripts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `PageParams`, `ProcessInput`, `OrderItemRow` to the rest of the system?**
  _346 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07533197139938713 - nodes in this community are weakly interconnected._
- **Should `sheets/sync.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05902980713033314 - nodes in this community are weakly interconnected._
- **Should `services/auth.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09830866807610994 - nodes in this community are weakly interconnected._