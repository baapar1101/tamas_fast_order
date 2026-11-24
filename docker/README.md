# راه‌اندازی تماس مارکت با Docker

سایت سه بخش دارد:

| بخش | فایل | کار |
|---|---|---|
| پایگاه داده | PostgreSQL 16 | همهٔ اطلاعات فروشگاه |
| API | `docker/api.Dockerfile` | سرور برنامه. موقع شروع، ساختار پایگاه داده را خودش به‌روز می‌کند. عکس‌ها و فایل‌ها را در `/data` نگه می‌دارد. |
| وب | `docker/web.Dockerfile` | nginx: فروشگاه و پنل را نمایش می‌دهد و `/api` و `/uploads` را به API می‌فرستد. |

- [الف) همروش (دارکوب)](#الف-همروش-دارکوب)
- [ب) هر سروری که Docker دارد](#ب-هر-سروری-که-docker-دارد)
- [بازگرداندن اطلاعات از بکاپ تلگرام](#بازگرداندن-اطلاعات-از-بکاپ-تلگرام)

---

## الف) همروش (دارکوب)

دارکوب هر بخش را یک «اپ» جدا می‌کند. دو راه دارید. **راه ۱ ساده‌تر است** و نیازی به رجیستری ندارد.

### راه ۱ (پیشنهادی): ساخت مستقیم از GitHub

همهٔ اپ‌ها را در **یک namespace** بسازید.

**۱. پایگاه داده**

- در کنسول: ساخت اپ ← دیتابیس ← PostgreSQL.
- نام: `tamas-db`. پلن: دست‌کم ۱ گیگابایت حافظه.
- «دسترسی از طریق اینترنت» را فعلاً خاموش بگذارید.
- از تب «اطلاعات عمومی»، **آدرس داخلی** و **رمز کاربر postgres** را بردارید.
- آدرس اتصال این شکل می‌شود:
  ```
  postgres://postgres:PASSWORD@INTERNAL_ADDRESS:5432/postgres
  ```

**۲. اپ API**

- ساخت اپ ← از گیت‌هاب ← مخزن `baapar1101/tamas_fast_order`، شاخهٔ `dev`.
- آدرس داکرفایل: `./docker/api.Dockerfile`. Build Context: `.`
- نام اپ: `tamas-api`.
- پورت: `3001`، با نام `http`. به این اپ دامنه ندهید.
- Readiness Probe: مسیر `/health`.
- دیسک: «افزودن دیسک»، دست‌کم ۱۰ گیگابایت، مسیر `/data`. Replica باید ۱ بماند.
- متغیرهای محیطی: از روی [`docker/app.env.example`](app.env.example) پر کنید. دست‌کم این‌ها لازم‌اند:
  - `DATABASE_URL`: آدرس مرحلهٔ ۱
  - `APP_SECRET`: رشتهٔ تصادفی بلند (`openssl rand -hex 32`)
  - `PUBLIC_SITE_URL` و `CORS_ORIGINS`: آدرس دامنهٔ سایت، مثلاً `https://tamasmarket.com`
  - `TRUST_PROXY=true`
  - `ADMIN_PHONES`: شمارهٔ موبایل مدیر
  - تنظیمات پیامک، CRM، زحل و درگاه پرداخت
- بعد از ساخت، در صفحهٔ اپ **آدرس داخلی** آن را ببینید. مرحلهٔ بعد به آن نیاز دارد.

**۳. اپ وب**

- همان مخزن و شاخه.
- آدرس داکرفایل: `./docker/web.Dockerfile`. Build Context: `.`
- نام اپ: `tamas-web`.
- پورت: `80`، با نام `http`.
- متغیر محیطی:
  ```
  API_UPSTREAM=<آدرس داخلی tamas-api>:3001
  ```
  اگر دو اپ در یک namespace باشند، `tamas-api:3001` هم کار می‌کند.
- دامنه: در تب «آدرس دامنه» دامنهٔ خودتان را اضافه کنید و رکورد CNAME را در DNS بسازید. SSL را با روش HTTP فعال کنید و HTTPS Redirect را روشن کنید. اگر Cloudflare یا ابر آروان دارید، پراکسی یا CDN آن رکورد را خاموش کنید.

«دیپلوی خودکار بعد از push» را برای هر دو اپ روشن کنید تا هر تغییر کد خودکار منتشر شود.

### راه ۲: ایمپورت Docker Compose

ایمپورت compose در دارکوب ایمیج نمی‌سازد و ایمیج آماده می‌خواهد.

۱. در GitHub به Actions ← «Docker images» ← Run workflow بروید. ایمیج‌های `ghcr.io/baapar1101/tamas-api:dev` و `tamas-web:dev` ساخته می‌شوند.

۲. در GitHub، در Packages هر دو بستهٔ `tamas-api` و `tamas-web` را **Public** کنید تا همروش بتواند آن‌ها را بگیرد.

۳. فایل [`docker-compose.hamravesh.yml`](../docker-compose.hamravesh.yml) را کپی کنید و همهٔ `CHANGE_ME`ها را پر کنید. نسخهٔ پرشده را در گیت commit نکنید، چون مخزن عمومی است.

۴. در کنسول: ساخت اپ ← Docker Compose، و متن را بچسبانید.

۵. به `tamas-web` دامنه و HTTPS بدهید، همان‌طور که در راه ۱ گفته شد.

در این راه پایگاه داده یک کانتینر معمولی است. پشتیبان‌گیری خودکارِ دیتابیس مدیریت‌شدهٔ همروش را ندارد.

---

## ب) هر سروری که Docker دارد

```bash
cp docker/app.env.example docker/app.env
```

`docker/app.env` را پر کنید: رمز پایگاه داده (در هر دو خط)، `APP_SECRET`، آدرس سایت و شمارهٔ مدیر. سپس:

```bash
docker compose up -d --build
```

سایت روی پورت 8080 بالا می‌آید. برای پورت ۸۰:

```bash
WEB_PORT=80 docker compose up -d
```

HTTPS را با nginx خود سرور، Caddy یا CDN جلوی آن بگذارید.

دستورهای مفید:

```bash
docker compose logs -f api
docker compose exec -T db pg_dump -U tamas -d tamas -Fc > backup.dump
git pull && docker compose up -d --build
```

`docker compose down -v` همهٔ اطلاعات را پاک می‌کند.

---

## نگهداری عکس‌ها و فایل‌ها در آبجکت استورج

به‌جای دیسک `/data`، عکس‌ها و مدارک می‌توانند در یک باکت S3 (مثل آبجکت استورج همروش) نگهداری شوند.

- آدرس عکس‌ها همان `/uploads/...` می‌ماند و API آن‌ها را از باکت می‌خواند. پس باکت باید **خصوصی** بماند و «دسترسی عمومی» آن خاموش باشد.
- مدارک خصوصی (اعتباری و پرداخت) در همان باکت زیر پوشهٔ `private/` نگهداری می‌شوند و فقط از مسیر محافظت‌شدهٔ `/api/files/...` باز می‌شوند.
- فایل‌هایی که هنوز روی دیسک هستند، با هر بار بالا آمدن API در پس‌زمینه به باکت کپی می‌شوند و تا آن موقع از دیسک خوانده می‌شوند. چیزی از دیسک پاک نمی‌شود.

متغیرهای `tamas-api`:

```
STORAGE_DRIVER=s3
S3_ENDPOINT=<آدرس اندپوینت باکت>
S3_BUCKET=<نام باکت>
S3_ACCESS_KEY_ID=<کلید دسترسی>        # در متغیرهای امن
S3_SECRET_ACCESS_KEY=<کلید مخفی>      # در متغیرهای امن
```

نتیجهٔ کپی در لاگ API با `[storage] bucket sync done` دیده می‌شود.

---

## بازگرداندن اطلاعات از بکاپ تلگرام

سایت هر شب از کل پایگاه داده یک فایل `tamas-database-YYYY-MM-DD-HHMMSS.json.gz` می‌سازد و در گروه بکاپ تلگرام می‌فرستد.

**مهم:** عکس‌ها و فایل‌های آپلودشده در این بکاپ **نیستند**. آن‌ها روی دیسک سرور قبلی بودند (`apps/api/storage`). اگر دیتاسنتر دیسک را برگرداند، آن پوشه را در `/data/storage` اپ API کپی کنید.

۱. جدیدترین فایل بکاپ را از گروه تلگرام دانلود کنید.

۲. API را یک بار اجرا کنید تا جدول‌ها ساخته شوند. یعنی اپ `tamas-api` یک بار بالا آمده باشد.

۳. بکاپ را بازگردانید.

**در همروش:**
- «دسترسی از طریق اینترنت» دیتابیس را موقتاً روشن کنید.
- روی کامپیوتری که Node.js 22 یا جدیدتر و این مخزن را دارد، اجرا کنید:

```bash
npm ci
npm run build -w @tamas/shared
npm run build -w @tamas/api
cd apps/api
DATABASE_URL="postgres://postgres:PASSWORD@EXTERNAL_ADDRESS:PORT/postgres" APP_SECRET=restore-only-0000000000 node dist/src/db/restore-backup.js /path/to/tamas-database-....json.gz
```

- بعد دسترسی اینترنتی دیتابیس را خاموش کنید و اپ `tamas-api` را ری‌استارت کنید.

**در Docker Compose:**

```bash
docker compose cp tamas-database-....json.gz api:/tmp/backup.json.gz
docker compose exec api node dist/src/db/restore-backup.js /tmp/backup.json.gz
docker compose restart api
```

ابزار بازگردانی:
- اگر پایگاه داده از قبل کاربر یا سفارش داشته باشد، کاری نمی‌کند. برای جایگزین‌کردن، `--replace` را اضافه کنید.
- همه چیز در یک تراکنش انجام می‌شود. اگر خطا بدهد، چیزی نیمه‌کاره نمی‌ماند.

**برای نسخهٔ آزمایشی** این‌ها را بگذارید تا به CRM، گوگل‌شیت و پیامک واقعی چیزی فرستاده نشود:
- `CRM_SYNC_ENABLED=false`
- `SHEETS_ENABLED=false`
- `OTP_PROVIDER=console`

ربات و بکاپ تلگرام در تنظیمات پنل ذخیره می‌شوند. اگر پایگاه داده را از سایت اصلی آورده‌اید، آن‌ها را هم در پنل خاموش کنید.
