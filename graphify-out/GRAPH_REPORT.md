# Graph Report - tamas_fast_order  (2026-09-15)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 804 nodes · 1571 edges · 49 communities (34 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `331293fe`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.ts
- sheets/sync.ts
- schemas.ts
- scripts
- compilerOptions
- web/package.json
- useToast
- api.ts
- StorefrontPage.tsx
- mapping.ts
- sync_spreadsheet.py
- schema.ts
- types.ts
- AdminApp.tsx
- compilerOptions
- dashboard.ts
- import-legacy.ts
- fallbackData.ts
- services/catalog.ts
- ProductsPage.tsx
- hooks.ts
- shared/package.json
- dependencies
- services/orders.ts
- scripts
- manifest.json
- plugins/auth.ts
- LocalStorage
- AuthDialog.tsx
- money.ts
- api/package.json
- phone.ts
- check_admins.ts
- fix-db.js
- drizzle-orm
- fastify
- @fastify/cors
- @fastify/helmet
- @fastify/multipart
- fastify-plugin
- @fastify/static
- googleapis
- pino-pretty
- sharp
- sw.js

## God Nodes (most connected - your core abstractions)
1. `useToast()` - 33 edges
2. `Db` - 26 edges
3. `api` - 23 edges
4. `badRequest()` - 21 edges
5. `notFound()` - 19 edges
6. `logAction()` - 19 edges
7. `compilerOptions` - 18 edges
8. `scripts` - 15 edges
9. `useAuth` - 15 edges
10. `offsetOf()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `shutdown()` --calls--> `closeDb()`  [EXTRACTED]
  apps/api/src/index.ts → apps/api/src/db/client.ts
- `createOrder()` --calls--> `badRequest()`  [EXTRACTED]
  apps/api/src/services/orders.ts → apps/api/src/lib/errors.ts
- `routes()` --calls--> `notFound()`  [EXTRACTED]
  apps/api/src/routes/admin/taxonomy.ts → apps/api/src/lib/errors.ts
- `routes()` --calls--> `notFound()`  [EXTRACTED]
  apps/api/src/routes/catalog.ts → apps/api/src/lib/errors.ts
- `resolveSession()` --calls--> `sha256()`  [EXTRACTED]
  apps/api/src/services/auth.ts → apps/api/src/lib/hash.ts

## Import Cycles
- None detected.

## Communities (49 total, 15 thin omitted)

### Community 0 - "app.ts"
Cohesion: 0.07
Nodes (69): buildApp(), Db, sessions, uploads, users, adminPhones, bool, corsOrigins (+61 more)

### Community 1 - "sheets/sync.ts"
Cohesion: 0.06
Nodes (46): [directionArg = 'both', ...rest], dryRun, main(), only, CATALOGUE, check(), FakeSheet, main() (+38 more)

### Community 2 - "schemas.ts"
Cohesion: 0.05
Nodes (42): BrandWrite, brandWriteSchema, CatalogQuery, catalogQuerySchema, CategoryWrite, categoryWriteSchema, ColorWrite, colorWriteSchema (+34 more)

### Community 3 - "scripts"
Cohesion: 0.05
Nodes (39): devDependencies, drizzle-kit, tsx, @types/node, typescript, typescript, drizzle-kit, npm-run-all2 (+31 more)

### Community 4 - "compilerOptions"
Cohesion: 0.05
Nodes (37): compilerOptions, composite, lib, module, moduleResolution, outDir, rootDir, types (+29 more)

### Community 5 - "web/package.json"
Cohesion: 0.06
Nodes (32): @tamas/shared, @tamas/shared, dependencies, react, react-dom, react-router-dom, @tamas/shared, @tanstack/react-query (+24 more)

### Community 6 - "useToast"
Cohesion: 0.12
Nodes (23): Attribute, AttributesPage(), ImagePicker(), Props, BrandForm, BrandsPage(), EMPTY_FORM, CategoriesPage() (+15 more)

### Community 7 - "api.ts"
Cohesion: 0.10
Nodes (21): AdminApp(), DashboardPage(), AdminApp, App(), ToastProvider(), ApiRequestError, Query, readToken() (+13 more)

### Community 8 - "StorefrontPage.tsx"
Cohesion: 0.12
Nodes (24): Icon(), IconName, IconProps, SvgSprite(), cartCount(), CartLine, CartState, cartTotal() (+16 more)

### Community 9 - "mapping.ts"
Cohesion: 0.07
Nodes (21): ApplyOutcome, BRAND_COLUMNS, brandMapping, CATEGORY_COLUMNS, categoryMapping, COLOR_COLUMNS, colorMapping, DbSideRow (+13 more)

### Community 10 - "sync_spreadsheet.py"
Cohesion: 0.12
Nodes (28): cmd_backup(), cmd_diff(), cmd_pull(), cmd_push(), cmd_watch(), fetch_csv_from_gss(), fetch_from_web_app(), load_config() (+20 more)

### Community 11 - "schema.ts"
Cohesion: 0.09
Nodes (20): attributes, auditLog, brandsRelations, categoriesRelations, categoryBrandsRelations, orderItemsRelations, ordersRelations, orderStatusEnum (+12 more)

### Community 12 - "types.ts"
Cohesion: 0.10
Nodes (21): OrderStatus, UploadKind, Warehouse, ApiError, ApiResult, AuthStateDTO, BrandDTO, CategoryDTO (+13 more)

### Community 13 - "AdminApp.tsx"
Cohesion: 0.13
Nodes (11): NAV_MAIN, NAV_TOOLS, AnalyticsPage(), MarketingPage(), MessagesPage(), SlidesPage(), ConflictItem, SyncPage() (+3 more)

### Community 14 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib, module (+11 more)

### Community 15 - "dashboard.ts"
Cohesion: 0.19
Nodes (11): catalogCache, Entry, TtlCache, routes(), recentAudit(), cache, deleteSetting(), getAllSettings() (+3 more)

### Community 16 - "import-legacy.ts"
Cohesion: 0.16
Nodes (14): argv, fileArg, LegacyCatalog, main(), num(), splitList(), main(), brands (+6 more)

### Community 17 - "fallbackData.ts"
Cohesion: 0.12
Nodes (17): allGroups, allProducts, fallbackBrands, fallbackCategories, fallbackColors, fallbackSettings, getFallbackProducts(), groupedMap (+9 more)

### Community 18 - "services/catalog.ts"
Cohesion: 0.30
Nodes (13): conflict(), routes(), syncCategoryBrands(), routes(), findProductByPublicId(), invalidateCatalog(), listBrands(), listCategories() (+5 more)

### Community 19 - "ProductsPage.tsx"
Cohesion: 0.17
Nodes (10): blank(), fromProduct(), ProductEditor(), ProductForm, Props, BulkAction, ProductsPage(), ProductsResponse (+2 more)

### Community 20 - "hooks.ts"
Cohesion: 0.18
Nodes (12): CHIP_TONE, OrdersPage(), OrdersResponse, UsersPage(), UsersResponse, getFallbackBootstrap(), ProductsResponse, useBootstrap() (+4 more)

### Community 21 - "shared/package.json"
Cohesion: 0.12
Nodes (15): dependencies, zod, exports, zod, main, name, private, scripts (+7 more)

### Community 22 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, dotenv, @fastify/cookie, @fastify/rate-limit, google-auth-library, postgres, zod, zod (+5 more)

### Community 23 - "services/orders.ts"
Cohesion: 0.27
Nodes (11): orderItems, orders, profileIncomplete(), routes(), createOrder(), listOrdersForUser(), orderCode(), OrderItemRow (+3 more)

### Community 24 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, db:generate, db:migrate, db:seed, db:studio, dev, import:legacy (+4 more)

### Community 25 - "manifest.json"
Cohesion: 0.17
Nodes (11): background_color, description, dir, display, icons, lang, name, orientation (+3 more)

### Community 26 - "plugins/auth.ts"
Cohesion: 0.31
Nodes (9): forbidden(), unauthorized(), fastify, FastifyInstance, FastifyRequest, plugin(), readToken(), resolveSession() (+1 more)

### Community 28 - "AuthDialog.tsx"
Cohesion: 0.22
Nodes (9): AuthDialog(), AuthResponse, emptyProfile(), OtpRequestResponse, PROFILE_FIELDS, ProfileForm, ProfileResponse, Props (+1 more)

### Community 30 - "api/package.json"
Cohesion: 0.33
Nodes (5): main, name, private, type, version

### Community 31 - "phone.ts"
Cohesion: 0.70
Nodes (4): isValidPhone(), normalizeLandline(), normalizePhone(), toAsciiDigits()

## Knowledge Gaps
- **336 isolated node(s):** `PageParams`, `SendResult`, `ProcessInput`, `EntityResult`, `ApiError` (+331 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `drizzle-orm`, `fastify`, `@fastify/cors`, `@fastify/helmet`, `@fastify/multipart`, `fastify-plugin`, `@fastify/static`, `googleapis`, `pino-pretty`, `sharp`, `web/package.json`, `api/package.json`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `Db` connect `app.ts` to `sheets/sync.ts`, `mapping.ts`, `schema.ts`, `dashboard.ts`, `import-legacy.ts`, `services/catalog.ts`, `services/orders.ts`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `scripts` to `api/package.json`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `PageParams`, `SendResult`, `ProcessInput` to the rest of the system?**
  _336 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06951743908265648 - nodes in this community are weakly interconnected._
- **Should `sheets/sync.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05817028027498678 - nodes in this community are weakly interconnected._
- **Should `schemas.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._