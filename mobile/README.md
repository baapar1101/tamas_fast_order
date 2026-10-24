# Tamas Market — native Android customer app

Independent React Native 0.88 / Expo SDK 58 project. All screens are native React Native views and navigation; this is not a WebView wrapper. Bank payments, messaging apps and ICS24 open externally on purpose.

The app uses `https://tamasmarket.com/api`, the existing accounts and the existing database. It never connects directly to PostgreSQL and never contains server credentials. `mobile/` is deliberately outside root npm workspaces: installing or building it does not upgrade the site's React or modify its lockfile.

## Features

- Live catalog, search, category/brand/stock/campaign filters, sorting, infinite pagination, grid and quick purchase, all product photos, model/color variants, warehouse quantities, bundles and technical specifications.
- Favorites and cart, OTP/password login, secure session restoration, profile, certificate upload, optional identity inquiry and password settings.
- Server-priced checkout, staged cash/cheque/daily selectors, configurable discounts, exact installment amounts, wallet payment and separate mobile/accessory invoices. Server-authorized account instructions and high-value-payment holds are preserved.
- Orders, bank gateway handoff, payment status refresh, receipt upload, wallet top-up and transaction pagination.
- Credit applications, ICS24 PDFs and report history, expiry warnings, credit metrics, cheque registration, installment receipts, missing-document replacement requests.
- Support conversations, Telegram/Bale linking, customer discounts, native notification preferences, light/dark themes and Persian typography.
- PDF catalog and paginated 1080×1920 glass-style image catalog with native sharing.

## Development

Requires Node compatible with Expo SDK 58 and the root shared package built once:

```powershell
npm run build -w @tamas/shared
cd mobile
npm ci
npm run typecheck
npm test
npm start
```

The app ID is `com.tamasmarket.customer`. Put its Firebase **Android client** configuration in `mobile/google-services.json` (ignored by Git). Never put a service-account key in the app or in Expo public environment variables.

## Signed APK on Windows

The checked-in scripts build locally without an Expo/EAS account. This environment uses Android Studio's Java 21, SDK platform 37.0, build-tools 37/36, NDK 27.1 and CMake 4.1.2. The newer CMake/Ninja prevents Windows long-path failures. The build is copied to `C:/tamas-build/mobile` so native intermediate files do not fill the application workspace.

```powershell
# From repository root, after SDK installation/license approval:
cd mobile
npx expo prebuild --platform android --no-install
cd ..
./mobile/scripts/build-apk.ps1
```

Output: `mobile/artifacts/tamas-market-1.0.0.apk`. ARM64 and ARMv7 are included, Android 7+ (API 24). Build tools and local credentials are in `C:/Users/Techn/.tamas-mobile-build`. The signing key and its credential file must be backed up privately and reused for every update; losing them prevents updating existing installations. Release builds without signing credentials fail rather than silently using the debug key.

`scripts/google-cdn.init.gradle` uses Google's own HTTPS download CDN when regional `dl.google.com` requests return 404. It does not disable TLS verification or use a third-party mirror. `install-android-sdk.ps1` checks official archive hashes and creates local package metadata from Google's repository manifest; it assumes the downloaded repository4.xml and SDK license approval.

## Backend and push

Migration `0029` adds only `native_push_devices`. The existing payment quote has additive `partitions` metadata; old web clients ignore it. Phone image/variant rules are framework-free shared functions; web imports remain compatible.

FCM HTTP v1 uses a dedicated Cloud Messaging account. Store its key under the API working directory at `.private/native-notifications/fcm-service-account.json`, owned by the app user, mode 600; alternatively set `FCM_SERVICE_ACCOUNT_FILE` to a protected path. It is never returned by settings/bootstrap and never packaged in the APK.

Push registration requires an authenticated customer session. Each registration is bound to that session's hash, so logout/expiry stops delivery. New account login rebinds the installation. Push payloads contain only a generic notification, never customer identities, debt amounts, bank details or attachments. Existing SMS/Telegram/Bale delivery is independent of FCM failures. Customers opt in through Settings.

Native attachments use `/native/uploads` with explicit credit/payment scope before storage; replacement-request scope is resolved from the authenticated owner's original document. The existing website upload endpoint is unchanged.

```bash
npm run db:migrate -w @tamas/api
# From apps/api, with protected FCM configuration:
npx tsx scripts/check-native-push-config.ts  # validate_only, sends no customer messages
npx tsx scripts/smoke-native-isolated.ts    # disposable QA schema; no real customer writes
```

## Security and release checks

- Token and chat credentials use Android Keystore-backed SecureStore. No password, credit PDF or receipt is kept in AsyncStorage. Private downloads carry Bearer headers to the same-origin `/api/files/:id` only; no URL tokens. Temporary private downloads are removed after sharing and on logout.
- Customer caches are cancelled/cleared on account change. Previous-account responses are rejected. The bank's URL never proves payment; app resume refreshes the server state.
- Mutations are not retried automatically. An ambiguous order-creation network failure requires reviewing Orders before retrying, to avoid duplicate orders.
- Run root typecheck/lint/tests/build, mobile typecheck/tests/Expo doctor/export, release signature inspection and native-device UI tests before distribution. Financial gateway transactions need separate end-user confirmation and are not exercised against real customer orders by automated QA.
- npm audit currently reports a transitive development-tool advisory in Expo CLI's node-forge (upstream latest 1.4.0) and its Zod dependency. Do not apply npm's proposed downgrade to Expo 44 or force-upgrade the shared backend's Zod major; assess patched upstream versions separately. These build-time libraries are not application screens or server credentials.
