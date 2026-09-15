# Graph Report - tamas_fast_order  (2026-09-15)

## Corpus Check
- 382 files · ~1,669,280 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 7606 nodes · 34680 edges · 156 communities (131 shown, 25 thin omitted)
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 5741 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `66d30e2a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- schema.ts
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
- index-DAFRp7mg.js
- types.ts
- compilerOptions
- AdminApp.tsx
- services/catalog.ts
- shared/package.json
- settings.ts
- api.ts
- index-D2rJ0L9F.js
- manifest.json
- app.ts
- AuthDialog.tsx
- prettier-ClokAeez.js
- v_
- money.ts
- phone.ts
- check_admins.ts
- fix-db.js
- fix-perms.js
- sw.js
- r
- resolve
- n
- index-CtuxncAn.js
- s
- index-CVt7hQvY.js
- .eq
- index-BKeqeYSc.js
- t
- yN
- o
- h
- N
- dN
- Yc
- vi
- es
- n
- c
- .child
- O
- advancedKit-DzKqOAyc.js
- useGlobalSensors-D5slMzU9.js
- S
- j1
- Bf
- .create
- _endToken
- get
- .forEach
- .forEach
- $
- X
- ar
- join
- Nd
- ae
- Ko
- hs
- zs
- oO
- jr
- st
- z
- _
- index-gu55o8D3.js
- new_admin/package.json
- a
- fn
- W9
- z_
- Wf
- index-CGF-BIse.js
- index-C4acQ81a.js
- Yi
- index-7lgfhmsr.js
- index-BVWe-P33.js
- Qo
- services/orders.ts
- compilerOptions
- q5
- Re
- Rn
- index-DKpG8yYa.js
- تماس مارکت — Fast Order
- api/package.json
- test-sync.ts
- H
- k4
- wD
- jalaliday.esm-bAHlMJp5.js
- qn
- errors.ts
- da
- API Endpoints
- it
- ne
- ree
- ne
- qt
- Jn
- ut
- validateHtml-DWrOc9Bx.js
- shared/tsconfig.json
- _
- nO
- o
- ue
- H
- _
- _
- ol
- q1
- sD
- _
- _
- fetch-test-otp.cjs
- or
- gn
- Pe
- lt
- r
- fix-duplicate.cjs
- modify-storefront.cjs
- @fastify/cors
- @fastify/helmet
- @fastify/multipart
- fastify-plugin
- googleapis
- postgres
- sharp
- @tamas/shared
- zod
- check.cjs
- check-scroll.cjs
- fetch-test.cjs
- r

## God Nodes (most connected - your core abstractions)
1. `dN()` - 306 edges
2. `v_()` - 284 edges
3. `r()` - 263 edges
4. `j()` - 241 edges
5. `c()` - 218 edges
6. `X()` - 199 edges
7. `j_()` - 183 edges
8. `n()` - 177 edges
9. `$` - 168 edges
10. `r()` - 168 edges

## Surprising Connections (you probably didn't know these)
- `An()` --indirect_call--> `At()`  [INFERRED]
  new_admin/admin/assets/index-B23QwUsF.js → new_admin/admin/assets/TileLayer-CJsCL3H4.js
- `wr()` --indirect_call--> `wt()`  [INFERRED]
  new_admin/admin/assets/index-B23QwUsF.js → new_admin/admin/assets/TileLayer-CJsCL3H4.js
- `wr()` --indirect_call--> `Qt()`  [INFERRED]
  new_admin/admin/assets/index-B23QwUsF.js → new_admin/admin/assets/TileLayer-CJsCL3H4.js
- `mr()` --indirect_call--> `Nt()`  [INFERRED]
  new_admin/admin/assets/index-B23QwUsF.js → new_admin/admin/assets/TileLayer-CJsCL3H4.js
- `x()` --indirect_call--> `a()`  [INFERRED]
  new_admin/admin/assets/index-8dFGBD8G.js → new_admin/admin/assets/index-D2rJ0L9F.js

## Import Cycles
- None detected.

## Communities (156 total, 25 thin omitted)

### Community 0 - "schema.ts"
Cohesion: 0.08
Nodes (48): Db, attributes, auditLog, brandsRelations, categoriesRelations, categoryBrandsRelations, orderItems, orderItemsRelations (+40 more)

### Community 1 - "sheets/sync.ts"
Cohesion: 0.09
Nodes (31): [directionArg = 'both', ...rest], dryRun, main(), only, rowHash(), offsetOf(), PageParams, conflictQuery (+23 more)

### Community 2 - "services/auth.ts"
Cohesion: 0.19
Nodes (23): otpCodes, tooMany(), randomDigits(), randomToken(), safeEqualHex(), sha256(), routes(), createSession() (+15 more)

### Community 3 - "useToast"
Cohesion: 0.09
Nodes (29): Attribute, AttributesPage(), ImagePicker(), Props, BrandForm, BrandsPage(), EMPTY_FORM, CategoriesPage() (+21 more)

### Community 4 - "schemas.ts"
Cohesion: 0.05
Nodes (42): BrandWrite, brandWriteSchema, CatalogQuery, catalogQuerySchema, CategoryWrite, categoryWriteSchema, ColorWrite, colorWriteSchema (+34 more)

### Community 5 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, composite, lib, module, moduleResolution, outDir, rootDir, types (+8 more)

### Community 6 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, db:generate, db:migrate, db:seed, db:studio, dev, import:legacy (+6 more)

### Community 7 - "web/package.json"
Cohesion: 0.06
Nodes (35): dependencies, react, react-dom, react-router-dom, @tamas/shared, @tanstack/react-query, zustand, devDependencies (+27 more)

### Community 8 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, dotenv, drizzle-orm, fastify, @fastify/cookie, @fastify/rate-limit, @fastify/static, google-auth-library (+9 more)

### Community 9 - "mapping.ts"
Cohesion: 0.07
Nodes (23): ApplyOutcome, BRAND_COLUMNS, brandMapping, CATEGORY_COLUMNS, categoryMapping, chunk(), COLOR_COLUMNS, colorMapping (+15 more)

### Community 10 - "sync_spreadsheet.py"
Cohesion: 0.12
Nodes (28): cmd_backup(), cmd_diff(), cmd_pull(), cmd_push(), cmd_watch(), fetch_csv_from_gss(), fetch_from_web_app(), load_config() (+20 more)

### Community 11 - "scripts"
Cohesion: 0.06
Nodes (35): npm-run-all2, devDependencies, npm-run-all2, @types/node, typescript, engines, node, @types/node (+27 more)

### Community 12 - "fallbackData.ts"
Cohesion: 0.10
Nodes (25): allGroups, allProducts, fallbackBrands, fallbackCategories, fallbackColors, fallbackSettings, getFallbackBootstrap(), getFallbackProducts() (+17 more)

### Community 13 - "ProductsPage.tsx"
Cohesion: 0.12
Nodes (16): blank(), fromProduct(), ProductEditor(), ProductForm, Props, CHIP_TONE, OrdersPage(), OrdersResponse (+8 more)

### Community 14 - "StorefrontPage.tsx"
Cohesion: 0.12
Nodes (24): Icon(), IconName, IconProps, cartCount(), CartLine, CartState, cartTotal(), stockFor() (+16 more)

### Community 15 - "index-DAFRp7mg.js"
Cohesion: 0.01
Nodes (362): ED(), px(), y8, Og(), wu(), $3, $4, #a() (+354 more)

### Community 16 - "types.ts"
Cohesion: 0.10
Nodes (21): OrderStatus, UploadKind, Warehouse, ApiError, ApiResult, AuthStateDTO, BrandDTO, CategoryDTO (+13 more)

### Community 17 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, declaration, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib, module (+11 more)

### Community 18 - "AdminApp.tsx"
Cohesion: 0.13
Nodes (17): AdminApp(), NAV_MAIN, NAV_TOOLS, AnalyticsDTO, AnalyticsPage(), DashboardPage(), MarketingPage(), MessagesPage() (+9 more)

### Community 19 - "services/catalog.ts"
Cohesion: 0.12
Nodes (32): argv, fileArg, LegacyCatalog, main(), num(), splitList(), main(), brands (+24 more)

### Community 20 - "shared/package.json"
Cohesion: 0.12
Nodes (15): dependencies, zod, exports, zod, main, name, private, scripts (+7 more)

### Community 21 - "settings.ts"
Cohesion: 0.19
Nodes (9): catalogCache, Entry, TtlCache, routes(), cache, deleteSetting(), getAllSettings(), invalidateSettings() (+1 more)

### Community 22 - "api.ts"
Cohesion: 0.14
Nodes (13): App(), ToastProvider(), ApiRequestError, Query, readToken(), request(), RequestOptions, toSearch() (+5 more)

### Community 23 - "index-D2rJ0L9F.js"
Cohesion: 0.01
Nodes (309): _1(), $3(), addObserver(), aee, ane(), b(), bee(), Bne() (+301 more)

### Community 24 - "manifest.json"
Cohesion: 0.17
Nodes (11): background_color, description, dir, display, icons, lang, name, orientation (+3 more)

### Community 25 - "app.ts"
Cohesion: 0.09
Nodes (20): buildApp(), closeDb(), adminPhones, bool, corsOrigins, env, envSchema, isProd (+12 more)

### Community 26 - "AuthDialog.tsx"
Cohesion: 0.22
Nodes (9): AuthDialog(), AuthResponse, emptyProfile(), OtpRequestResponse, PROFILE_FIELDS, ProfileForm, ProfileResponse, Props (+1 more)

### Community 27 - "prettier-ClokAeez.js"
Cohesion: 0.01
Nodes (302): ./editorCodeContent-DwJkRBhp.js, Cc(), we(), Wi(), jD, np(), p3(), p() (+294 more)

### Community 28 - "v_"
Cohesion: 0.02
Nodes (240): Ol(), B8, oe(), dI(), dM(), X(), pt(), Gt() (+232 more)

### Community 30 - "phone.ts"
Cohesion: 0.70
Nodes (4): isValidPhone(), normalizeLandline(), normalizePhone(), toAsciiDigits()

### Community 39 - "r"
Cohesion: 0.01
Nodes (129): i, C, L(), n, p, x(), c, i (+121 more)

### Community 40 - "resolve"
Cohesion: 0.03
Nodes (107): Jp(), J9(), a1(), Ad(), after(), al(), ap(), au() (+99 more)

### Community 41 - "n"
Cohesion: 0.03
Nodes (208): C0(), Co(), Fr(), ic(), Ki(), ni(), po(), sn() (+200 more)

### Community 42 - "index-CtuxncAn.js"
Cohesion: 0.06
Nodes (153): n, c(), g, m, n, B(), C, o() (+145 more)

### Community 43 - "s"
Cohesion: 0.04
Nodes (173): nd(), xl, _8(), aM(), aT(), ne(), bj(), Bm() (+165 more)

### Community 44 - "index-CVt7hQvY.js"
Cohesion: 0.03
Nodes (129): e(), ie, L, ne, a(), a(), c(), o() (+121 more)

### Community 45 - ".eq"
Cohesion: 0.02
Nodes (68): Cm(), Rd(), ZE(), aC(), Bd(), CC(), cm(), Cy() (+60 more)

### Community 46 - "index-BKeqeYSc.js"
Cohesion: 0.11
Nodes (105): i, i, c, r(), c(), d, f(), x() (+97 more)

### Community 47 - "t"
Cohesion: 0.02
Nodes (154): Bg(), A5(), c(), l(), aA, aI(), O(), aN() (+146 more)

### Community 48 - "yN"
Cohesion: 0.04
Nodes (151): Ae(), Ee(), Oe(), Pe(), q(), Qe(), Ve(), Ye() (+143 more)

### Community 49 - "o"
Cohesion: 0.03
Nodes (141): _7(), m(), accessor(), i(), ate(), build(), C(), E() (+133 more)

### Community 50 - "h"
Cohesion: 0.04
Nodes (147): X(), ir(), nr(), Gs(), ls(), Ps(), Rs(), Us() (+139 more)

### Community 51 - "N"
Cohesion: 0.05
Nodes (128): a(), l(), i(), ar(), ce, hr(), hs(), ir() (+120 more)

### Community 52 - "dN"
Cohesion: 0.02
Nodes (100): dN(), Ai(), Aj(), aO(), b(), B2(), bh(), bO() (+92 more)

### Community 53 - "Yc"
Cohesion: 0.03
Nodes (24): Pm(), addKeyboardShortcuts(), addToSet(), allowedMarks(), allowsMarkType(), bp, check(), de (+16 more)

### Community 54 - "vi"
Cohesion: 0.04
Nodes (112): Ce(), Ds(), ks(), Ls(), xe, As(), Bs(), O (+104 more)

### Community 55 - "es"
Cohesion: 0.06
Nodes (106): Se(), $e, Ue(), We(), i(), ue(), aa(), Zr() (+98 more)

### Community 56 - "n"
Cohesion: 0.02
Nodes (99): _6(), bindMethods(), c3(), Q(), cN(), he(), o(), r() (+91 more)

### Community 57 - "c"
Cohesion: 0.04
Nodes (78): a(), c(), L, r(), a(), d(), o(), r() (+70 more)

### Community 58 - ".child"
Cohesion: 0.04
Nodes (86): cD(), cx(), dp(), eu(), fp(), H1(), hi(), j7() (+78 more)

### Community 59 - "O"
Cohesion: 0.06
Nodes (96): fe(), Se(), ye(), a, g, c(), l(), V() (+88 more)

### Community 60 - "advancedKit-DzKqOAyc.js"
Cohesion: 0.04
Nodes (73): Ai(), B, bi(), ci(), di, e(), ee(), en() (+65 more)

### Community 61 - "useGlobalSensors-D5slMzU9.js"
Cohesion: 0.04
Nodes (83): Je(), Ze(), Er(), vn(), Mt(), qs(), Ao(), ar (+75 more)

### Community 62 - "S"
Cohesion: 0.03
Nodes (28): cE(), ch(), cp(), CT(), dk(), dp(), Eg(), fe() (+20 more)

### Community 63 - "j1"
Cohesion: 0.03
Nodes (18): Rc(), am(), componentWillUnmount(), deselectNode(), fl(), handleSelectionUpdate(), j1(), kn (+10 more)

### Community 64 - "Bf"
Cohesion: 0.05
Nodes (78): _6(), Bf(), A(), ae(), Be(), de(), $e(), fe() (+70 more)

### Community 65 - ".create"
Cohesion: 0.04
Nodes (51): ei, on, iy(), pc(), m3(), _addToParent(), ae, build() (+43 more)

### Community 66 - "_endToken"
Cohesion: 0.08
Nodes (77): Mi(), el(), advance(), _advanceIf(), advanceState(), _attemptCharCode(), _attemptCharCodeCaseInsensitive(), _attemptCharCodeUntilFn() (+69 more)

### Community 67 - "get"
Cohesion: 0.04
Nodes (55): add(), S(), x(), ae(), he(), I(), te(), ve() (+47 more)

### Community 68 - ".forEach"
Cohesion: 0.05
Nodes (57): Pv(), a6(), accessor(), a(), add(), B6(), delete(), a() (+49 more)

### Community 69 - ".forEach"
Cohesion: 0.05
Nodes (53): clear(), k(), e6(), Ec(), findAll(), fU(), getAll(), isFocused() (+45 more)

### Community 70 - "$"
Cohesion: 0.04
Nodes (34): $, an, ao, dn, Do, en(), Eo, fo (+26 more)

### Community 71 - "X"
Cohesion: 0.06
Nodes (54): Ot, Es(), ks(), vs(), w, ws(), J(), K() (+46 more)

### Community 72 - "ar"
Cohesion: 0.06
Nodes (13): ar, Bn, bS(), Ci, fh(), from(), getBookmark(), gS() (+5 more)

### Community 73 - "join"
Cohesion: 0.06
Nodes (29): iD, B3(), by(), cb(), dedentString(), dy, ey, fp() (+21 more)

### Community 74 - "Nd"
Cohesion: 0.05
Nodes (28): U(), ae(), W(), concat(), hw(), iee(), kN(), mx() (+20 more)

### Community 75 - "ae"
Cohesion: 0.09
Nodes (43): Ar(), Fs(), Ke(), le, Ls(), Ms(), Os(), Ps() (+35 more)

### Community 76 - "Ko"
Cohesion: 0.09
Nodes (42): Ig(), $1(), aE(), b3(), cE(), d3(), d8(), du() (+34 more)

### Community 77 - "hs"
Cohesion: 0.06
Nodes (14): hs(), Ai(), At(), de(), Fe(), Gi(), go(), m() (+6 more)

### Community 78 - "zs"
Cohesion: 0.10
Nodes (35): p(), Bs, fr(), tn(), ws(), ys, gi(), Ni() (+27 more)

### Community 79 - "oO"
Cohesion: 0.16
Nodes (32): qr(), _4(), d4(), dm(), f4(), gn(), hn(), Hr() (+24 more)

### Community 80 - "jr"
Cohesion: 0.10
Nodes (30): cancel(), cancelQueries(), cb(), defaultMutationOptions(), defaultQueryOptions(), ensureInfiniteQueryData(), ensureQueryData(), ew() (+22 more)

### Community 81 - "st"
Cohesion: 0.11
Nodes (13): an(), cn(), Gn, t(), hr(), mr(), pt(), rn() (+5 more)

### Community 82 - "z"
Cohesion: 0.15
Nodes (25): a(), pn(), br(), Ct(), Dt, _e(), Fe(), gr() (+17 more)

### Community 83 - "_"
Cohesion: 0.14
Nodes (28): ./index-06bH-XcF.js, ./index-3msCx76_.js, ./index-B_VbNVA9.js, ./index-BsEe0BN_.js, ./index-BUJ-Yu9R.js, ./index-C50ZFqkx.js, ./index-CswrMtF1.js, _ (+20 more)

### Community 84 - "index-gu55o8D3.js"
Cohesion: 0.14
Nodes (27): ./index-4Jpncmw-.js, ./index-8nbSopGq.js, _, d(), __vite__mapDeps(), x, ./index-Ci9VJ9kv.js, ./index-DudbMzRp.js (+19 more)

### Community 85 - "new_admin/package.json"
Cohesion: 0.08
Nodes (25): cors, express, author, dependencies, cors, express, description, keywords (+17 more)

### Community 86 - "a"
Cohesion: 0.15
Nodes (22): ./index-Aa4QHfgZ.js, _, o, __vite__mapDeps(), j, m, __vite__mapDeps(), x (+14 more)

### Community 87 - "fn"
Cohesion: 0.26
Nodes (25): cn(), de(), ee(), Fe(), Ge(), hn(), Ie(), Ke() (+17 more)

### Community 88 - "W9"
Cohesion: 0.09
Nodes (24): b3(), A(), eB(), Ei(), gV(), gx(), I1(), ku() (+16 more)

### Community 89 - "z_"
Cohesion: 0.09
Nodes (16): d7(), eJ, g7, iF(), l7, RF(), setState(), TF() (+8 more)

### Community 90 - "Wf"
Cohesion: 0.09
Nodes (23): eT(), fk(), gf(), hk(), k9(), kx(), Nx(), Ox() (+15 more)

### Community 91 - "index-CGF-BIse.js"
Cohesion: 0.14
Nodes (18): _, o, __vite__mapDeps(), x(), ./index-BAyxlMNR.js, a, __vite__mapDeps(), ./index-CgAdYTys.js (+10 more)

### Community 92 - "index-C4acQ81a.js"
Cohesion: 0.15
Nodes (19): d, l, m, n, p, u(), __vite__mapDeps(), x (+11 more)

### Community 94 - "index-7lgfhmsr.js"
Cohesion: 0.21
Nodes (16): ./index-2BOYKt_5.js, a, i, l, m, n, p, r (+8 more)

### Community 95 - "index-BVWe-P33.js"
Cohesion: 0.21
Nodes (17): A, E(), G, I(), k, M(), n(), O() (+9 more)

### Community 96 - "Qo"
Cohesion: 0.13
Nodes (18): du(), eg(), b(), S(), g(), m(), v(), lx() (+10 more)

### Community 97 - "services/orders.ts"
Cohesion: 0.20
Nodes (14): sql, here, main(), migrationsFolder, profileIncomplete(), routes(), routes(), createOrder() (+6 more)

### Community 98 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, declaration, jsx, lib, noEmit, types, extends (+8 more)

### Community 99 - "q5"
Cohesion: 0.17
Nodes (17): Nj(), bl(), ci(), el(), eu(), F5(), G5(), H5() (+9 more)

### Community 100 - "Re"
Cohesion: 0.27
Nodes (17): pt(), Re(), b(), C(), f(), I(), j(), k() (+9 more)

### Community 101 - "Rn"
Cohesion: 0.12
Nodes (3): Rn, vi(), Vs

### Community 102 - "index-DKpG8yYa.js"
Cohesion: 0.23
Nodes (15): ./index-1poIl4h2.js, ./index-2VAufpMu.js, ./index-BAZp15GE.js, ./index-C-0XonmN.js, i, j, l, n (+7 more)

### Community 103 - "تماس مارکت — Fast Order"
Cohesion: 0.12
Nodes (15): آپلود فایل, اجرا, احراز هویت, استقرار, تماس مارکت — Fast Order, تنظیم دسترسی, دستورهای مفید, راه‌اندازی سریع (+7 more)

### Community 104 - "api/package.json"
Cohesion: 0.13
Nodes (14): devDependencies, drizzle-kit, tsx, @types/node, typescript, @types/node, typescript, main (+6 more)

### Community 105 - "test-sync.ts"
Cohesion: 0.21
Nodes (8): CATALOGUE, check(), FakeSheet, main(), priceOf(), titleOf(), products, syncConflicts

### Community 106 - "H"
Cohesion: 0.30
Nodes (13): w(), F(), H(), C(), D(), E(), K(), W() (+5 more)

### Community 107 - "k4"
Cohesion: 0.19
Nodes (12): am(), dO(), Eh(), fO(), k4(), lm(), wd(), ui() (+4 more)

### Community 108 - "wD"
Cohesion: 0.14
Nodes (8): fN(), Mv(), e(), sx(), wD(), b(), p(), u()

### Community 109 - "jalaliday.esm-bAHlMJp5.js"
Cohesion: 0.25
Nodes (12): dt(), F(), ft(), H(), ht(), it(), k(), lt() (+4 more)

### Community 110 - "qn"
Cohesion: 0.25
Nodes (6): ba(), ed(), getHTML(), ku(), qn, Zi()

### Community 111 - "errors.ts"
Cohesion: 0.24
Nodes (10): AppError, forbidden(), unauthorized(), fastify, FastifyInstance, FastifyRequest, plugin(), readToken() (+2 more)

### Community 112 - "da"
Cohesion: 0.20
Nodes (11): da(), Fb(), gN(), n(), t(), N1(), Sw(), vw() (+3 more)

### Community 113 - "API Endpoints"
Cohesion: 0.17
Nodes (11): API Endpoints, Channels, Data, Frontend, Gateways, NISEDA Backend API, Orders, Payments (+3 more)

### Community 114 - "it"
Cohesion: 0.31
Nodes (10): it(), b(), be(), Cn(), q(), R(), Ui(), v() (+2 more)

### Community 115 - "ne"
Cohesion: 0.29
Nodes (10): bt(), C(), F(), H(), I(), $n(), ne(), Pt() (+2 more)

### Community 116 - "ree"
Cohesion: 0.25
Nodes (9): e5(), Eee(), fee(), l5(), nee(), ree(), toAbortSignal(), unsubscribe() (+1 more)

### Community 117 - "ne"
Cohesion: 0.33
Nodes (9): hs, Er(), ge, ls(), ne(), ns(), Rs(), $s() (+1 more)

### Community 118 - "qt"
Cohesion: 0.25
Nodes (9): qt(), Ge(), Ii(), io(), ji(), k(), Kn(), po() (+1 more)

### Community 119 - "Jn"
Cohesion: 0.25
Nodes (8): Ei(), je(), Jn(), qn(), Ue(), Ve(), Xn(), Yn()

### Community 120 - "ut"
Cohesion: 0.29
Nodes (8): et(), He(), Ie(), jt(), se(), ut(), w(), X()

### Community 121 - "validateHtml-DWrOc9Bx.js"
Cohesion: 0.39
Nodes (7): c, d(), f(), g(), o(), u, w()

### Community 122 - "shared/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, extends, include, src, ../../tsconfig.base.json

### Community 123 - "_"
Cohesion: 0.48
Nodes (6): _, r, __vite__mapDeps(), x, ./index-BFksShuI.js, ./index-DSlPe-1Y.js

### Community 124 - "nO"
Cohesion: 0.52
Nodes (7): bd(), Gh(), ld(), nO(), p4(), qh(), Yi()

### Community 125 - "o"
Cohesion: 0.29
Nodes (7): Bi(), eo(), o(), Mt(), qi(), Wi(), xt()

### Community 126 - "ue"
Cohesion: 0.38
Nodes (5): ue(), d(), L(), P(), w()

### Community 127 - "H"
Cohesion: 0.33
Nodes (6): Be, H(), He, nn, sn, T

### Community 128 - "_"
Cohesion: 0.60
Nodes (6): ./index-B9NZomG2.js, _, i, n(), o, __vite__mapDeps()

### Community 129 - "_"
Cohesion: 0.60
Nodes (6): _, i, o, __vite__mapDeps(), x(), ./index-Cy4c3_Yt.js

### Community 133 - "_"
Cohesion: 0.70
Nodes (4): _, o, __vite__mapDeps(), ./index-C_Ji-iZ_.js

### Community 134 - "_"
Cohesion: 0.60
Nodes (4): _, o, __vite__mapDeps(), ./index-L2K8wdKD.js

### Community 135 - "fetch-test-otp.cjs"
Cohesion: 0.50
Nodes (3): data, http, req

### Community 136 - "or"
Cohesion: 0.67
Nodes (4): or(), next(), prev(), Gl

### Community 137 - "gn"
Cohesion: 0.50
Nodes (4): gn(), j(), S(), Vo()

### Community 138 - "Pe"
Cohesion: 0.67
Nodes (3): Pe(), Ho(), ko()

### Community 139 - "lt"
Cohesion: 0.67
Nodes (3): xn(), FS, lt()

## Knowledge Gaps
- **767 isolated node(s):** `p`, `name`, `version`, `private`, `type` (+762 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ar` connect `ar` to `schema.ts`, `resolve`, `prettier-ClokAeez.js`, `advancedKit-DzKqOAyc.js`, `S`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `v_()` connect `v_` to `Bf`, `.create`, `.forEach`, `n`, `join`, `s`, `index-DAFRp7mg.js`, `t`, `o`, `h`, `z`, `dN`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `dN()` connect `dN` to `or`, `index-DAFRp7mg.js`, `index-D2rJ0L9F.js`, `prettier-ClokAeez.js`, `v_`, `resolve`, `n`, `index-CtuxncAn.js`, `s`, `.eq`, `index-BKeqeYSc.js`, `yN`, `o`, `h`, `N`, `es`, `n`, `c`, `O`, `useGlobalSensors-D5slMzU9.js`, `.create`, `_endToken`, `get`, `.forEach`, `join`, `Nd`, `oO`, `z`, `a`, `Wf`, `q5`, `k4`, `wD`, `it`, `nO`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Are the 33 inferred relationships involving `dN()` (e.g. with `C()` and `E()`) actually correct?**
  _`dN()` has 33 INFERRED edges - model-reasoned connections that need verification._
- **Are the 30 inferred relationships involving `v_()` (e.g. with `cy()` and `Lu()`) actually correct?**
  _`v_()` has 30 INFERRED edges - model-reasoned connections that need verification._
- **Are the 71 inferred relationships involving `r()` (e.g. with `_7()` and `_A()`) actually correct?**
  _`r()` has 71 INFERRED edges - model-reasoned connections that need verification._
- **Are the 30 inferred relationships involving `j()` (e.g. with `n0()` and `Bs()`) actually correct?**
  _`j()` has 30 INFERRED edges - model-reasoned connections that need verification._