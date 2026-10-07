# تماس مارکت — Fast Order

فروشگاه عمده‌فروشی لوازم جانبی موبایل، بازنویسی‌شده روی Node.js + PostgreSQL + React،
با همگام‌سازی دوطرفهٔ کامل با Google Sheets.

نسخهٔ قبلی (Google Apps Script + یک فایل `index.html`) در پوشهٔ `legacy/` نگه داشته شده است.

---

## معماری

```
tamas_fast_order/
├── apps/
│   ├── api/          سرویس Fastify — دیتابیس، احراز هویت، سفارش، آپلود، سینک
│   └── web/          اپ Vite + React 19 — فروشگاه و پنل مدیریت
├── packages/
│   └── shared/       تایپ‌ها و اسکیماهای zod مشترک بین فرانت و بک
└── legacy/           کد نسخهٔ قبلی (Apps Script، index.html، اسکریپت‌های پایتون)
```

| لایه | فناوری | چرا |
|---|---|---|
| دیتابیس | PostgreSQL 16 + Drizzle ORM | تراکنش برای سفارش، ایندکس trigram برای جستجوی فارسی، JSONB برای مشخصات فنی |
| API | Fastify 5 + Zod | سریع، تایپ‌شده، اعتبارسنجی ورودی در مرز |
| فرانت | Vite 6 + React 19 + TypeScript | پنل مدیریت به‌صورت chunk جدا — خریدار هرگز دانلودش نمی‌کند |
| فایل‌ها | دیسک محلی پشت یک آداپتور | مهاجرت بعدی به S3 فقط یک کلاس جدید است |
| سینک | Google Sheets API v4 | دوطرفه، با three-way merge |

---

## راه‌اندازی سریع

### پیش‌نیازها

- Node.js ۲۰٫۱۱ یا بالاتر
- PostgreSQL ۱۴ یا بالاتر

### مراحل

```bash
# ۱. نصب وابستگی‌ها
npm install

# ۲. ساخت دیتابیس
createdb tamas
psql -d tamas -c "CREATE USER tamas WITH PASSWORD 'یک-رمز-قوی';"
psql -d tamas -c "GRANT ALL ON DATABASE tamas TO tamas;"

# ۳. تنظیمات
cp apps/api/.env.example apps/api/.env
# فایل .env را باز کنید و حداقل این‌ها را پر کنید:
#   DATABASE_URL   آدرس اتصال به دیتابیس
#   APP_SECRET     خروجی دستور: openssl rand -hex 32
#   ADMIN_PHONES   شماره موبایل شما، تا در اولین ورود مدیر شوید

# ۴. ساخت جدول‌ها
npm run db:migrate

# ۵. انتقال داده‌های قبلی (اختیاری)
npm run import:legacy

# ۶. اجرا
npm run dev
```

- فروشگاه: <http://localhost:5173>
- پنل مدیریت: <http://localhost:5173/admin>
- API: <http://localhost:3001>

> در حالت توسعه `OTP_PROVIDER=console` است: کد تایید پیامک نمی‌شود، در لاگ سرور
> چاپ و در فرم هم پیش‌پر می‌شود. برای پیامک واقعی `OTP_PROVIDER=eldery` را بگذارید.

---

## احراز هویت

ورود با شمارهٔ موبایل و کد یک‌بارمصرف است. **تفاوت مهم با نسخهٔ قبلی:**

در نسخهٔ Apps Script، کد تایید در مرورگر بررسی می‌شد و بعد مرورگر از بک‌اند
درخواست نشست می‌کرد. یعنی هر کسی می‌توانست مستقیماً به وب‌اپ درخواست بفرستد و
با هر شماره‌ای وارد شود. حالا تایید کد **در سرور** انجام می‌شود:

| حالت `OTP_PROVIDER` | کد را چه کسی می‌سازد | کد را چه کسی تایید می‌کند |
|---|---|---|
| `console` | همین API (هش‌شده در جدول `otp_codes`) | همین API |
| `eldery` | سرویس otp.eldery.ir | همین API، با فراخوانی سرور-به-سرور |

در هر دو حالت مرورگر نمی‌تواند خودش نشست بسازد. توکن نشست فقط به‌صورت SHA-256
ذخیره می‌شود و بعد از ۳۰ روز منقضی می‌گردد.

**اولین مدیر:** شماره‌تان را در `ADMIN_PHONES` بگذارید. در اولین ورود، حساب شما
به‌صورت خودکار نقش `admin` می‌گیرد. بعد از آن می‌توانید بقیه را از خود پنل مدیر کنید.

---

## همگام‌سازی گوگل شیت

### تنظیم دسترسی

1. در [Google Cloud Console](https://console.cloud.google.com) یک پروژه بسازید و
   **Google Sheets API** را فعال کنید.
2. یک **Service Account** بسازید و کلید JSON آن را دانلود کنید.
3. فایل را کنار `apps/api` با نام `service-account.json` بگذارید
   (یا کل محتوای JSON را در `SHEETS_CREDENTIALS_JSON` قرار دهید).
4. اسپردشیت را با ایمیل همان service account (`...@....iam.gserviceaccount.com`)
   **به‌صورت Editor** به اشتراک بگذارید — بدون این کار دسترسی ندارد.
5. در `.env`:

```env
SHEETS_ENABLED=true
SHEETS_SPREADSHEET_ID=شناسه-اسپردشیت-از-داخل-URL
SHEETS_SYNC_INTERVAL_SECONDS=300
```

### چطور کار می‌کند

هر تب یک ستون `updated_at` می‌گیرد. برای هر ردیف، موتور سینک سه چیز را مقایسه می‌کند:

- **baseline** — اثر انگشت ردیف در آخرین باری که دو طرف با هم یکی بودند (ستون `sheet_hash` در دیتابیس)
- وضعیت فعلی دیتابیس
- وضعیت فعلی شیت

| دیتابیس | شیت | نتیجه |
|---|---|---|
| بدون تغییر | بدون تغییر | دست نمی‌خورد (این چیزی است که سینک را سریع نگه می‌دارد) |
| تغییر کرده | بدون تغییر | دیتابیس → شیت |
| بدون تغییر | تغییر کرده | شیت → دیتابیس |
| هر دو تغییر کرده | | `updated_at` جدیدتر برنده است، و تک‌تک ستون‌های متفاوت در جدول تضادها ثبت می‌شود |

نکتهٔ مهم: چون baseline مبنا است، **اگر سلولی را با دست در شیت عوض کنید و به
`updated_at` دست نزنید، باز هم تغییر شما دیده و اعمال می‌شود.** لازم نیست چیزی
را دستی به‌روز کنید.

### چه چیزی از شیت خوانده می‌شود

همهٔ ستون‌ها از شیت خوانده نمی‌شوند. برای جلوگیری از خرابی، بعضی ستون‌ها فقط
نوشته می‌شوند:

- **سفارش‌ها:** فقط `status` و `note` از شیت برمی‌گردند. سفارش فقط در فروشگاه ساخته می‌شود.
- **کاربران:** ستون `role` هرگز از شیت خوانده نمی‌شود — یک ویرایش اشتباه نباید به کسی دسترسی مدیریت بدهد. ستون `actived` خوانده می‌شود تا بتوانید فروشگاه‌ها را در شیت تایید کنید.
- **محصولات، دسته‌ها، برندها، رنگ‌ها، تنظیمات:** همهٔ ستون‌ها دوطرفه‌اند.

اگر نمی‌خواهید اطلاعات شخصی (کاربران و سفارش‌ها) اصلاً به شیت برود:
`SHEETS_SYNC_PRIVATE_DATA=false`.

### اجرا

- **خودکار:** هر `SHEETS_SYNC_INTERVAL_SECONDS` ثانیه (پیش‌فرض ۵ دقیقه).
- **از پنل:** بخش «گوگل شیت» — با دکمهٔ «پیش‌نمایش بدون تغییر» می‌توانید ببینید چه چیزی عوض می‌شود بدون اینکه چیزی نوشته شود.
- **از ترمینال:**

```bash
npm run sync:pull                                  # فقط شیت → دیتابیس
npm run sync:push                                  # فقط دیتابیس → شیت
npx tsx apps/api/scripts/sync-cli.ts both --dry-run
npx tsx apps/api/scripts/sync-cli.ts both --only=products,brands
```

---

## اعلان‌های تلگرام

از پنل مدیریت به بخش **تنظیمات ← ربات تلگرام** بروید. توکن BotFather را وارد کنید،
یک یا چند گروه با `Chat ID` تعریف کنید و در جدول مسیریابی مشخص کنید هر اعلان به
کدام گروه‌ها ارسال شود. برای گروه‌های Topic-enabled می‌توانید `Topic ID` را هم
وارد کنید. دکمهٔ «ذخیره و تست» اتصال هر مقصد را جداگانه بررسی می‌کند.

پروکسی‌های `socks4://`، `socks5://` و `socks5h://` پشتیبانی می‌شوند و نام کاربری
و رمز عبور را هم می‌توان داخل URL پروکسی قرار داد. ارسال اعلان ناهمگام است؛ قطعی
تلگرام یا یک گروه، ثبت سفارش و پرداخت را متوقف نمی‌کند.

اعلان‌های قابل مسیریابی شامل سفارش جدید، تغییر وضعیت سفارش، پرداخت موفق یا ناموفق،
ثبت اطلاعات پرداخت دستی، ثبت‌نام و تکمیل پروفایل و تغییر وضعیت کاربر، درخواست اعتبار
و چک و تغییر وضعیت آن‌هاست.

---

## آپلود فایل

آپلود روی دیسک سرور (`STORAGE_ROOT`، پیش‌فرض `apps/api/storage`) انجام می‌شود.
تصاویر خودکار با `sharp` به WebP تبدیل و یک نسخهٔ بندانگشتی هم ساخته می‌شود —
همین تفاوت اصلی سرعت با نسخهٔ قبلی است که JPEGهای تمام‌اندازه را مستقیم از شیت لینک می‌داد.

فایل‌ها را می‌شود از پنل (بخش «فایل‌ها») کشید و رها کرد، یا در فرم هر محصول/برند/دسته مستقیم آپلود کرد.

آدرس‌های خارجی تصاویر محصولات به‌صورت خودکار و دوره‌ای دانلود، به WebP تبدیل و داخل
`STORAGE_ROOT` ذخیره می‌شوند؛ سپس آدرس محصول به `/uploads/...` تغییر می‌کند. برای
اجرای کامل و فوری این مهاجرت روی سرور از دستور زیر استفاده کنید:

```bash
npm run images:mirror
```

**مهاجرت به S3 در آینده:** یک کلاس جدید کنار `apps/api/src/services/storage/local.ts`
بنویسید که `StorageAdapter` را پیاده کند و `STORAGE_DRIVER` را عوض کنید. هیچ
route یا کامپوننتی تغییر نمی‌کند.

**در production:** بهتر است مسیر `/uploads` را مستقیم با nginx سرو کنید:

```nginx
location /uploads/ {
    alias /var/www/tamas/storage/;
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

---

## دستورهای مفید

| دستور | کار |
|---|---|
| `npm run dev` | اجرای همزمان API و فرانت |
| `npm run build` | ساخت production هر سه پکیج |
| `npm run typecheck` | بررسی تایپ کل مونوریپو |
| `npm run jules -- sources` | بررسی ریپازیتوری‌های متصل به Jules |
| `npm run jules -- sessions` | فهرست کارهای Jules |
| `npm run db:generate` | ساخت فایل migration بعد از تغییر اسکیما |
| `npm run db:migrate` | اعمال migrationها |
| `npm run db:seed` | چند محصول نمونه |
| `npm run import:legacy` | وارد کردن `legacy/catalog_backup.json` |
| `npx tsx apps/api/scripts/test-sync.ts` | تست موتور سینک روی یک شیت درون‌حافظه‌ای |

### اتوماسیون توسعه با Jules

کلید Jules فقط در فایل محلی و git-ignored به نام `.env.local` نگهداری می‌شود؛
آن را در کد، فرانت‌اند یا فایل‌های commit‌شده قرار ندهید. نمونهٔ تنظیمات در
`.env.example` قرار دارد. CLI به‌صورت پیش‌فرض source را از remote گیت و branch را
از branch فعلی تشخیص می‌دهد.

```bash
# دیدن sourceها و sessionها
npm run jules -- sources
npm run jules -- sessions

# ساخت یک کار روی branch فعلی (بدون ساخت خودکار PR)
npm run jules -- create --title "Review checkout" --prompt "Review checkout for race conditions and propose fixes."

# ساخت خودکار PR پس از پایان کار
npm run jules -- create --branch dev --auto-pr --prompt-file ./task.md

# پیگیری و تعامل با session
npm run jules -- watch SESSION_ID
npm run jules -- activities SESSION_ID
npm run jules -- message SESSION_ID --prompt "Please add regression tests."
```

فرمان `create` فقط با `--auto-pr` اجازهٔ ساخت branch و pull request را به Jules
می‌دهد. برای workflow تأیید دستی plan، از `--require-approval` و سپس فرمان
`approve SESSION_ID` استفاده کنید. راهنمای کامل فرمان‌ها:

```bash
npm run jules -- help
```

---

## استقرار

```bash
npm ci
npm run build
npm run db:migrate

# API با systemd یا pm2:
NODE_ENV=production node apps/api/dist/src/index.js

# فرانت: محتوای apps/web/dist را با nginx سرو کنید
```

پیکربندی nginx (فرانت و API روی یک دامنه، تا کوکی و آپلود بدون CORS کار کنند):

```nginx
server {
    server_name shop.example.com;

    root /var/www/tamas/web;
    index index.html;

    # SPA: هر مسیری که فایل نیست به index.html می‌رود
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /var/www/tamas/storage/;
        expires 30d;
    }
}
```

اگر API پشت nginx است، در `.env` مقدار `TRUST_PROXY=true` را بگذارید تا محدودیت
نرخ درخواست روی IP واقعی کاربر اعمال شود، نه IP پروکسی.

---

## نکته‌ای دربارهٔ دادهٔ قدیمی

در شیت فعلی، ستون `old_price` در ۴۳۴ ردیف از ۴۳۷ ردیف مقدار یکسان
`482,000,000` دارد — ظاهراً یک fill-down اشتباهی در اکسل. اگر همان‌طور نمایش داده
شود، کل کاتالوگ «۹۹٪ تخفیف» به نظر می‌رسد. فعلاً فروشگاه قیمت قبلی را فقط وقتی
خط‌خورده نشان می‌دهد که منطقی باشد (بیشتر از قیمت فعلی ولی حداکثر سه برابر آن).
بهتر است این ستون را در شیت پاک یا اصلاح کنید.
