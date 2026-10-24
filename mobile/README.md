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

`scripts/install-emulator.ps1` installs official checksum-verified emulator/API 36 images after SDK license approval. Release APK testing uses the real public catalog; do not create customer orders or financial transactions without separate authorization.

## Signed APK on Windows

The checked-in scripts build locally without an Expo/EAS account. This environment uses Android Studio's Java 21, SDK platform 37.0, build-tools 37/36, NDK 27.1 and CMake 4.1.2. The newer CMake/Ninja prevents Windows long-path failures. The build is copied to `C:/tamas-build/mobile` so native intermediate files do not fill the application workspace.

```powershell
# From repository root, after SDK installation/license approval:
cd mobile
npx expo prebuild --platform android --no-install
cd ..
./mobile/scripts/build-apk.ps1
```

Output: `mobile/artifacts/tamas-market-1.0.1.apk`. ARM64, ARMv7 and x86_64 are included, Android 7+ (API 24). Build tools and local credentials are in `C:/Users/Techn/.tamas-mobile-build`. The signing key and its credential file must be backed up privately and reused for every update; losing them prevents updating existing installations. Release builds without signing credentials fail rather than silently using the debug key.

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

### Verified 2026-10-24

The signed release APK was installed and run on an API 36 x86_64 emulator, without Metro or Expo Go. Verified live catalog data, native filter dialogs, product images/details, warehouse quantity changes and cart persistence, OTP/password form rendering, scrolling, a 320dp-wide display with 150% font scaling, Jalali dates, glass-image generation and Android sharing, PDF generation and Android sharing. Root tests: 154 passed; mobile tests: 9 passed; Expo doctor: 20/20; release signature verified and `debuggable=false`. No real customer orders, payments, SMS or messages were created by UI QA.

The initial backend smoke used temporary PostgreSQL tables and FCM `validate_only`. See the expanded release-APK verification below for authenticated native screens, synthetic bank settlement and actual FCM receipt. Physical ARM-device testing remains separate from emulator QA.

### Authenticated release QA — 1.0.1

The standalone, signed QA APK was tested on API 36 x86_64 without Metro or Expo Go. Its loopback API used a **separate empty database and database role**, the production table structure, synthetic users/products, separate storage and the real authentication/order/stock/wallet services. No customer records or live settings were copied. SMS, bots, CRM, Sheets and schedulers were disabled; only the bank transport was simulated. FCM used the real dedicated sender against the synthetic account's emulator token.

- Native OTP login, password login, session restoration after process death, logout and switching between two accounts passed. Each account showed its own wallet and orders.
- Native wallet top-up through the simulated external bank returned to the app and refreshed the balance/ledger. A native wallet purchase charged exactly 100,000, left 400,000 and reduced only the synthetic Kerman stock from 20 to 19.
- 21 additional API checks covered invalid credentials, OTP replay, anonymous/cross-account access, limits, insufficient/frozen wallets, failed settlement, duplicate successful callbacks, cash discount, forged client prices, concurrent purchases and revoked sessions.
- Actual FCM notifications were received in foreground and background. Tapping opened Orders, Wallet and the installment/credit area. A notification opened the correct page after killing the app process. Disabling notifications stopped sends; revoking the Android permission removed registration on resume; logout stopped sends for the old session.

Fixed background notification taps (Expo-compatible intent data and FCM `proxy: DENY`), event-specific navigation, token-rotation registration, permission reconciliation without unsolicited prompts, foreground data refresh and the Persian labels for server `new`/`preparing` order statuses. Gradle now includes the QA flag as a bundle input and resets Metro's transform cache; a QA-to-production build was verified to load the real public catalog over HTTPS with the QA backend stopped. Notification text continues to exclude financial and identity data. Relevant transport references: [Expo custom FCM](https://docs.expo.dev/push-notifications/sending-notifications-custom/) and [Firebase notification delegation](https://firebase.google.com/docs/cloud-messaging/android-message-priority#notification_delegation_with_google_play_services).

Final validation: 159 root tests and 10 mobile tests passed, typecheck/lint/build passed, APK signature matches 1.0.0, versionCode is 2, `debuggable=false` and cleartext traffic is disabled. The final Expo Doctor run passed 19 checks; its online config-schema check could not reach Expo's API (TLS connection closed), including one retry. No APK or application failure resulted from that unavailable external check. QA database/role were dropped, QA server/tunnel stopped and emulator test credentials cleared before the final public-catalog smoke.

To repeat isolated native testing, provision an **empty** PostgreSQL database and role with the same name `tamas_native_qa_YYYYMMDD`, restore structure only (including `pg_trgm`), and create a private mode-600 JSON file with `DATABASE_URL`, `QA_DATABASE`, a fresh `APP_SECRET` and `QA_PASSWORD`. From `apps/api`, run `npx tsx scripts/native-qa-server.ts /absolute/private/qa.json`. The harness fails closed on an ordinary database URL, listens only on loopback 3103 and never starts the scheduler. Forward that port over SSH and ADB, then build `mobile/scripts/build-apk.ps1 -Qa`. The explicitly named `tamas-market-qa.apk` is marked as synthetic and must never be published. The normal build script forces the production origin and disables cleartext HTTP. Clear emulator app data before installing the production APK. Stop the harness and remove the exact QA database/role when done; keep signing/FCM keys untouched.
