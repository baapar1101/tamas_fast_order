# اجرای تماس مارکت با Docker

کل سایت با یک دستور بالا می‌آید. این دستور چهار سرویس را اجرا می‌کند:

| سرویس | کار |
|---|---|
| `db` | پایگاه داده PostgreSQL 16 |
| `migrate` | ساختار پایگاه داده را به‌روز می‌کند و بعد بسته می‌شود |
| `api` | سرور برنامه (Fastify) |
| `web` | nginx: فروشگاه و پنل مدیریت را نمایش می‌دهد و `/api` و `/uploads` را به `api` می‌فرستد |

فقط `web` روی پورت سرور باز است. پایگاه داده و API از بیرون در دسترس نیستند.

## پیش‌نیاز

- Docker Engine 24 یا جدیدتر به‌همراه Docker Compose v2 (`docker compose version`)
- حداقل ۲ گیگابایت حافظه برای ساخت ایمیج‌ها
- حدود ۳ گیگابایت فضای خالی دیسک

## راه‌اندازی اول

```bash
cp docker/app.env.example docker/app.env
```

فایل `docker/app.env` را باز کنید و دست‌کم این موارد را پر کنید:

- `POSTGRES_PASSWORD`: یک رمز تصادفی. همین رمز را در `DATABASE_URL` هم به‌جای `CHANGE_ME` بگذارید.
- `APP_SECRET`: یک رشتهٔ تصادفی بلند (`openssl rand -hex 32`).
- `PUBLIC_SITE_URL` و `CORS_ORIGINS`: آدرسی که مشتری باز می‌کند.
- `ADMIN_PHONES`: شمارهٔ موبایل مدیر.
- برای پیامک واقعی: `OTP_PROVIDER` و اطلاعات سرویس پیامک.

سپس:

```bash
docker compose up -d --build
```

سایت روی `http://SERVER:8080` باز می‌شود. برای پورت دیگر:

```bash
WEB_PORT=80 docker compose up -d
```

وضعیت سرویس‌ها و لاگ‌ها:

```bash
docker compose ps
docker compose logs -f api
```

با `OTP_PROVIDER=console`، کد ورود در لاگ `api` چاپ می‌شود. این حالت فقط برای آزمایش است.

## انتقال اطلاعات از سرور فعلی

۱. روی سرور فعلی، از پایگاه داده خروجی بگیرید:

```bash
pg_dump "$DATABASE_URL" -Fc -f tamas.dump
```

۲. روی سرور جدید، فقط پایگاه داده را بالا بیاورید و خروجی را بازگردانید:

```bash
docker compose up -d db
docker compose exec -T db pg_restore -U tamas -d tamas --clean --if-exists --no-owner < tamas.dump
```

نسخهٔ PostgreSQL در `docker-compose.yml` (الان 16) نباید از نسخهٔ سرور فعلی قدیمی‌تر باشد.

۳. عکس‌ها و فایل‌های آپلودشده را کپی کنید. پوشهٔ `apps/api/storage` سرور فعلی را کنار پروژه بیاورید و اجرا کنید:

```bash
docker compose build
docker compose up --no-start
docker run --rm -v tamas_uploads:/data -v "$PWD/apps/api/storage:/src:ro" alpine sh -c "cp -a /src/. /data/ && chown -R 1000:1000 /data"
docker run --rm -v tamas_private-files:/data -v "$PWD/apps/api/private-storage:/src:ro" alpine sh -c "cp -a /src/. /data/ && chown -R 1000:1000 /data"
```

۴. همه را بالا بیاورید:

```bash
docker compose up -d --build
```

## HTTPS و دامنه

کانتینر `web` فقط HTTP می‌دهد. یکی از این راه‌ها را برای HTTPS بگذارید:

- nginx خود سرور (یا aaPanel) با گواهی SSL که به `http://127.0.0.1:8080` پروکسی کند. هدرهای `Host` و `X-Forwarded-For` و `X-Forwarded-Proto` را بفرستید.
- یا Caddy / Traefik / CDN جلوی آن.

اپلیکیشن اندروید از پوشهٔ `mobile/releases` با آدرس `/downloads/tamas-market-X.Y.Z.apk` دانلود می‌شود.

## به‌روزرسانی

```bash
git pull
docker compose up -d --build
```

سرویس `migrate` هر بار قبل از `api` اجرا می‌شود و تغییرات پایگاه داده را اعمال می‌کند.

## نسخهٔ پشتیبان

```bash
docker compose exec -T db pg_dump -U tamas -d tamas -Fc > backup-$(date +%F).dump
docker run --rm -v tamas_uploads:/data:ro -v "$PWD:/out" alpine tar czf /out/uploads-$(date +%F).tgz -C /data .
```

## نکته برای نسخهٔ آزمایشی

اگر نسخه‌ای کنار سایت اصلی برای آزمایش بالا می‌آورید، در `docker/app.env` این‌ها را بگذارید تا به سیستم‌های واقعی چیزی فرستاده نشود:

- `CRM_SYNC_ENABLED=false`
- `SHEETS_ENABLED=false`
- `TELEGRAM_ENABLED=false`
- `OTP_PROVIDER=console`

ربات تلگرام و بکاپ تلگرامی در تنظیمات پنل مدیریت هم ذخیره می‌شوند. اگر پایگاه داده را از سایت اصلی آورده‌اید، آن‌ها را هم در پنل خاموش کنید.

## دستورهای مفید

```bash
docker compose restart api
docker compose exec api node -e "console.log(process.env.PUBLIC_SITE_URL)"
docker compose down            # توقف؛ اطلاعات روی volumeها می‌ماند
```

`docker compose down -v` همهٔ اطلاعات، از جمله پایگاه داده و عکس‌ها، را پاک می‌کند.
