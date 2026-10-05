// پایه API: https://tamastore.ir
// مرحله ۱: POST /api/v1/public/crm-chat/conversations/start
// بدنه JSON باید public_key "LCO5CXBCf818GWIvsCdvuHmMqQ08EF26" و first_name و last_name و email و phone و page_url را داشته باشد.
// مرحله ۲: با visitor_token و conversation_id به POST /api/v1/public/crm-chat/messages پیام بفرستید.
// جزئیات: مستندات CRM_WEB_CHAT در مخزن MarkStreet




# راهنمای یکپارچه‌سازی چت وب CRM (MarkStreet) برای توسعه‌دهنده

این سند برای **سازندهٔ افزونه**، **توسعه‌دهندهٔ فرانت سایت**، یا هر کسی است که می‌خواهد **سایت خود را به چت تحت وب CRM MarkStreet** وصل کند.  
بک‌اند تنها **REST API** و **WebSocket** را ارائه می‌کند؛ **رابط بصری (ویجت) را خودتان** در سایت/افزونه می‌نویسید (وردپرس، نکست، لاراول، و غیره).

---

## فهرست

1. [آنچه از ابتدا لازم است](#آنچه-از-ابتدا-لازم-است)  
2. [پیکربندی در MarkStreet (کسب‌وکار)](#پیکربندی-در-MarkStreet-کسب‌وکار)  
3. [پایه آدرس و هدرها](#پایه-آدرس-و-هدرها)  
4. [جریان کلی یکپارچه‌سازی](#جریان-کلی-یکپارچه‌سازی)  
5. [APIهای عمومی (بدون ورود — بازدیدکننده)](#apiهای-عمومی-بازدیدکننده)  
6. [ارسال و دریافت فایل (بازدیدکننده)](#ارسال-و-دریافت-فایل-بازدیدکننده)  
7. [شکل پاسخ پیام‌ها (شامل فایل)](#شکل-پاسخ-پیام‌ها-شامل-فایل)  
8. [کدهای خطا (مخصوص فایل و تنظیمات)](#کدهای-خطا)  
9. [WebSocket (نسخه واقع‌زمان)](#websocket)  
10. [API مدیریت (با API Key — داخل MarkStreet یا ابزار ادمین)](#api-مدیریت-با-api-key)  
11. [اتصال سایت: پلاگین وردپرس و نمونه کد](#اتصال-سایت-و-نمونه-کد)  
12. [CORS و دامنه مجاز (Origin)](#cors-و-دامنه-مجاز)  
13. [امنیت و نکات تولید](#امنیت-و-نکات-تولید)  
14. [ورک‌فلو (اتوماسیون داخل MarkStreet)](#ورکفلو-اتوماسیون-داخل-MarkStreet)  
15. [پایگاه داده و مایگریشن (برای ادمین/استقرار سرور)](#پایگاه-داده-و-مایگریشن)  
16. [عیب‌یابی](#عیبیابی)  

---

## آنچه از ابتدا لازم است

| مورد | توضیح |
|------|--------|
| **آدرس بک‌اند API** | مثال: `https://api.example.com` (همان `API_BASE` که فراخوانی می‌زنید) |
| **`public_key` ویجت** | پس از ساخت **ویجت چت** در پنل CRM (چت وب)، از پنل کپی می‌شود. این کلید **عمومی** است (برای شروع مکالمه سمت سایت شما) |
| **HTTPS** | روی تولید، ترجیحاً هر دو طرف HTTPS باشند. |
| **CORS** | دامنهٔ سایت شما باید در `allow_origins` سرور MarkStreet برای درخواست‌های مرورگر به API مجاز باشد. |
| **پلن فضای ذخیره‌سازی** (فقط اگر **فایل** می‌خواهید) | برای آپلود فایل توسط بازدیدکننده باید روی کسب‌وکار **اشتراک/فضای ذخیره‌سازی فعال** و ظرفیت کافی وجود داشته باشد؛ بخش [ارسال فایل](#ارسال-و-دریافت-فایل-بازدیدکننده) را ببینید. |

---

## پیکربندی در MarkStreet (کسب‌وکار)

1. **ساخت ویجت**: `CRM` → `چت وب` → ساخت ویجت، در صورت تمایل **دامنه‌های مجاز** (`allowed_origins` به‌صورت hostname مثل `shop.example.com`).  
2. **تنظیمات CRM (اختیاری برای فایل)**: `تنظیمات کسب‌وکار` → **تنظیمات CRM** — گزینه **«ارسال فایل در چت وب»**  
   - اگر **خاموش** باشد، `POST` آپلود فایل سمت بازدیدکننده **رد** می‌شود (با کد `CRM_FILE_UPLOAD_DISABLED`).  
   - **روشن** بودن تضمین نمی‌کند که فایل پذیرفته شود؛ اگر **پلن/سهمیه** نباشد، بازدیدکننده خطای «فعلاً ارسال فایل ممکن نیست» می‌گیرد و **مالک کسب‌وکار** (در صورت پیکربندی نوتیفیکیشن) می‌تواند اطلاع بگیرد.

---

## پایه آدرس و هدرها

- **همه مسیرها زیر** `API_BASE`، معمولاً به شکل:  
  `https://<host>/api/v1/...`  
- **WebSocket** بدون ` /api/v1` است، مثلاً: `wss://<host>/ws/crm-chat` (پورت و مسیر مثل `ws/notifications`).

**بازدیدکننده (عمومی):** بدون `Authorization` — فقط `Content-Type: application/json` برای JSON (برای `multipart` نیاز نیست).  
**مدیریت (پنل / سرور امن):**  
`Authorization: ApiKey <YOUR_API_KEY>` (یا الگوی همان `Bearer` که در سایر مستندات Hessabix آمده) و در صورت نیاز همان الگوهای `X-Business-ID` مثل بقیه APIهای CRM.

---

## جریان کلی یکپارچه‌سازی

```text
[کاربر] → پر کردن فرم (نام، نام‌خانوادگی، ایمیل، موبایل) در سایت شما
       → POST .../conversations/start  با public_key
       → ذخیرهٔ امن visitor_token + conversation_id (مثلاً sessionStorage)
       ↓
       ارسال متن: POST .../messages
       اختیاری:  ارسال فایل: POST .../messages/file  (فرم)
       اختیاری:  WebSocket + auth بازدیدکننده برای رویداد لحظه‌ای
       ↓
       نمایش تاریخچه: GET .../messages
       اگر پیام فایل دارد: GET .../files/{file_id}/download?visitor_token=...
```

- برای **هر مکالمه** یک `visitor_token` — با تب جدید یا دوباره «شروع» مکالمه، توکن و ID جدید می‌گیرید (طبق سیاست کسب‌وکار می‌تواند یک مکالمه ادامه‌دار روی سایت شما باشد اگر دوباره `start` نزنید و همان `sessionStorage` را نگه دارید).

---

## APIهای عمومی (بازدیدکننده)

همه زیر: `https://<API_BASE>/api/v1/public/crm-chat/`

### ۱) شروع مکالمه

`POST /api/v1/public/crm-chat/conversations/start`

**بدنه (JSON):**

```json
{
  "public_key": "<public_key از پنل>",
  "first_name": "علی",
  "last_name": "رضایی",
  "email": "ali@example.com",
  "phone": "09123456789",
  "page_url": "https://shop.example.com/contact",
  "device_type": "mobile"
}
```

فیلد **`device_type`** اختیاری است: یکی از `"mobile"`، `"tablet"`، `"desktop"` (ویجت رسمی MarkStreet آن را از مرورگر می‌فرستد). سرور آدرس IP بازدیدکننده را در پایگاه ذخیره می‌کند و در پنل اپراتور با **`extra_metadata`** مکالمه برمی‌گردد.

**پاسخ موفق (در `data`):**

- `conversation_id` (عدد)  
- `visitor_token` (رشته محرمانه — **فقط** در سمت کلاینت/جلسه نگه دارید)  
- `widget_id`  

### ۲) به‌روزرسانی صفحهٔ فعلی بازدیدکننده (برای اپراتور)

`PATCH /api/v1/public/crm-chat/conversations/{conversation_id}/current-page`

پس از شروع مکالمه، هر بار که بازدیدکننده در سایت شما به صفحهٔ دیگری می‌رود، این مسیر را با **همان الویت توکن** (`X-Visitor-Token` یا `Authorization: Bearer`) صدا بزنید تا فیلد `page_url` مکالمه به‌روز شود و از طریق رویداد WebSocket `conversation.updated` نزد اپراتور هم‌زمان دیده شود.

**بدنه (JSON):**

```json
{
  "page_url": "https://shop.example.com/products/42?utm=..."
}
```

### ۳) ارسال پیام متنی

`POST /api/v1/public/crm-chat/messages`

```json
{
  "visitor_token": "<token>",
  "conversation_id": 123,
  "body": "سلام"
}
```

### ۴) لیست پیام‌ها (بازدیدکننده)

`GET /api/v1/public/crm-chat/conversations/{conversation_id}/messages?limit=100`

- **اقدام لازم:** ارسال توکن بازدیدکننده **در هدر** (روش جدید، توصیه‌شده): `X-Visitor-Token: <token>` **یا** `Authorization: Bearer <token>`.  
- **سازگاری:** همچنان می‌توان `?visitor_token=<token>` فرستاد (الویت: هدر).  
- **CORS preflight:** هدر `X-Visitor-Token` (یا `Authorization`) باید در `Access-Control-Allow-Headers` اجازه داشته باشد (بک‌اند MarkStreet `allow_headers` را باز دارد).

ساختار آیتم‌ها: بخش [شکل پاسخ پیام‌ها](#شکل-پاسخ-پیام‌ها-شامل-فایل).

---

## ارسال و دریافت فایل (بازدیدکننده)

### پیش‌شرط

1. در **تنظیمات CRM** کسب‌وکار: **ارسال فایل در چت وب = فعال**  
2. **پلن/فضای ذخیره‌سازی** فعال و ظرفیت کافی (در غیر این صورت خطای `CRM_FILE_NOT_AVAILABLE` — بخش [کدها](#کدهای-خطا))  
3. **محدودیت حجم** طبق تنظیمات سیستم (مشابه سایر آپلودها)

### ارسال فایل (multipart)

`POST /api/v1/public/crm-chat/messages/file`

- **Content-Type:** `multipart/form-data`  
- **فیلدها:**

| فیلد | نوع | اجباری | توضیح |
|------|-----|--------|--------|
| `visitor_token` | string | ✓ | همان از شروع مکالمه |
| `conversation_id` | عدد (form) | ✓ | |
| `caption` | string | | توضیح اختیاری روی فایل؛ اگر خالی باشد، متن پیام به‌صورت خودکار مثل `📎 نام-فایل` ثبت می‌شود |
| `file` | فایل | ✓ | باینری فایل |

**مثال `curl`:**

```bash
curl -X POST "$API_BASE/api/v1/public/crm-chat/messages/file" \
  -F "visitor_token=$VISITOR_TOKEN" \
  -F "conversation_id=123" \
  -F "caption=مستندات سفارش" \
  -F "file=@/path/to/doc.pdf"
```

**مثال ساختار `fetch` (مرورگر):**

```js
const form = new FormData();
form.append("visitor_token", visitorToken);
form.append("conversation_id", String(conversationId));
form.append("caption", "");
form.append("file", fileInput.files[0], fileInput.files[0].name);

const res = await fetch(`${apiBase}/api/v1/public/crm-chat/messages/file`, {
  method: "POST",
  body: form,
  // نگذارید browser Content-Type بزند اگر form را می‌دهید
});
const json = await res.json();
```

### دانلود فایل (با همان `visitor_token`)

`GET /api/v1/public/crm-chat/conversations/{conversation_id}/files/{file_id}/download`

- همان هدر `X-Visitor-Token` یا `Authorization: Bearer` ([یا قدیم] `?visitor_token=`).  
- `file_id` همان `file.id` داخل آبجکت `file` در آیتم پیام است.  
- پاسخ: باینری فایل با `Content-Disposition: attachment` (مثل دانلود معمول)؛ در `fetch` بهتر است با هدر بگیرید و `blob` را ذخیره کنید (نه `window.open` با query توکن).

---

## شکل پاسخ پیام‌ها (شامل فایل)

هر آیتم پیام (لیست JSON) فیلدهای زیر را دارد (نام‌ها ممکن است در خروجی `format` تاریخ به رشته تبدیل شوند):

| فیلد | توضیح |
|------|--------|
| `id` | شناسه پیام |
| `conversation_id` | |
| `sender_role` | `visitor` \| `agent` \| (در آینده `system` …) |
| `body` | متن (برای فایل، معمولاً نام/کپشن) |
| `user_id` | در پیام عامل اگر مرتبط باشد |
| `file_storage_id` | اگر ضمیمه دارد، شناسه فایل در storage |
| `file` | `null` **یا** آبجکت: `id`, `original_name`, `file_size`, `mime_type` |
| `created_at` | زمان |

رویدادهای **WebSocket** همان `message` غنی‌شده را در payload قرار می‌دهند (با `file` در صورت وجود).

---

## کدهای خطا

وقتی `success: false` (یا HTTP غیر 2xx) بررسی کنید. نمونه‌های رایج:

| کد (در `error.code`) | معنی برای یکپارچه‌ساز | اقدام پیشنهادی |
|----------------------|------------------------|------------------|
| `CRM_FILE_UPLOAD_DISABLED` | کسب‌وکار ارسال فایل را در تنظیمات CRM فعال نکرده | به کاربر بگویید «فعلاً ارسال فایل فعال نیست» — در UI دکمهٔ آپلود را مخفی/غیرفعال کنید اگر از API تنظیمات بخوانید |
| `CRM_FILE_NOT_AVAILABLE` | اغلب: بدون پلن فعال یا **پر شدن سهمیه** | متن کلی به کاربر؛ مالک باید پلن/فضا را ارتقا دهد (نوتیف داخلی ممکن است برای مالک ارسال شود) |
| `details.storage_error` | در برخی پاسخ‌ها: `no_plan` یا `quota` | اختیاری برای سفارشی‌سازی UI |
| `CRM_FILE_TOO_LARGE` | بیش از سقف حجم | پیام راهنما از `message` |
| `FORBIDDEN` (مثلاً مبدأ) | `Origin` دامنهٔ شما در `allowed_origins` ویجت نیست | دامنه صحیح در پنل |
| `NOT_FOUND` | `public_key` اشتباه، یا توکن/مکالمه نامعتبر | — |

**نکته:** دقیق ساختار `detail` ممکن است مثل بقیه APIهای FastAPI (شیء `error` داخل `detail`) باشد — در کلاینت همان پاسخ JSON را `console`/`log` کنید تا الگو را ببینید.

---

## WebSocket

- **URL:** `wss://<host>/ws/crm-chat` (یا `ws://` فقط توسعه محلی)  
- **اولین فریم** حتماً JSON متنی **احراز** است.

### بازدیدکننده

```json
{
  "type": "auth",
  "role": "visitor",
  "visitor_token": "<token>",
  "conversation_id": 123
}
```

پاسخ موفق: `{"type":"auth_ok","role":"visitor","conversation_id":123}`

سپس رویدادها با `type: "crm_chat.event"` و مثلاً `event: "message.created"`.

### عامل CRM (مثلاً داشبورد سفارشی شما)

```json
{
  "type": "auth",
  "role": "agent",
  "api_key": "<api_key همان پنل>",
  "business_id": 456
}
```

بعد: `{"type":"subscribe","conversation_id": 123}` برای هر مکالمه.

---

## API مدیریت (با API Key)

پایه: `https://<API_BASE>/api/v1/crm/businesses/{business_id}/chat/...`

| متد | مسیر | توضیح | مجوز تقریبی |
|-----|------|--------|-------------|
| GET | `.../widgets` | لیست ویجت‌ها (شامل `public_key`) | `crm` + view |
| POST | `.../widgets` | ساخت ویجت | `crm` + write |
| PATCH | `.../widgets/{id}` | ویرایش (نام، دامنه‌ها، `is_active`, …) | `crm` + write |
| GET | `.../crm-settings` | **تنظیمات CRM** (مثلاً `allow_web_chat_file_upload`) | `crm` + view |
| PATCH | `.../crm-settings` | بدنه: `{"allow_web_chat_file_upload": true/false}` | `crm` + write |
| GET | `.../conversations` | صندوق مکالمات | `crm` + view |
| GET | `.../conversations/{id}/messages` | لیست پیام (با `file` غنی) | `crm` + view |
| POST | `.../conversations/{id}/messages` | پاسخ عامل؛ می‌تواند `body` **و/یا** `file_storage_id` (پس از آپلود فایل در **فضای کسب‌وکار** با `module_context=crm_web_chat` و `context_id` = همان `conversation_id`) | `crm` + write |
| PATCH | `.../conversations/{id}` | وضعیت، ارجاع، `lead_id`, `person_id` | `crm` + write |

**دانلود فایل از سمت نماینده (واردشده به MarkStreet):** از API استاندارد **فایل کسب‌وکار** مثلاً:  
`GET /api/v1/business/{business_id}/storage/files/{file_id}/download` (با همان احراز و دسترسی به کسب‌وکار) — الگو در اپ MarkStreet استفاده می‌شود.

---

## اتصال سایت و نمونه کد

### وردپرس (ایدهٔ افزونه)

1. **تنظیمات ادمین (ذخیره امن):** `API_BASE`، `public_key` (فیلدهای اختیاری: متن دکمه، رنگ).  
2. **فرانت (shortcode / بلوک):**  
   - لود **سبک/اسکریپت** شما.  
   - مودال چت: فرم هویت → `start` → نگه داشتن `visitor_token` در `sessionStorage` با کلیدی وابسته به `public_key` + `page`.  
   - لیست پیام + ورودی متن.  
3. **ارسال فایل (اختیاری):**  
   - فقط اگر در تنظیمات CRM (از طریق API `crm-settings` که در ادمین با transient/cache می‌کشید) **فعال** است، `input type="file"` نشان دهید.  
4. **WebSocket (اختیاری):** `new WebSocket(wss + '/ws/crm-chat')` سپس `auth` مرحله [WebSocket](#websocket).  
5. **هرگز** یوزر/پسورد ادمین MarkStreet را در JS عمومی نگذارید — فقط `public_key` برای مسیرهای `public/...` کافی است.

### چک‌لیست توسعه

- [ ] CORS و دامنه تست روی production  
- [ ] تست `allowed_origins` با دامنه واقعی (بدون `https://` در لیست — فقط hostname)  
- [ ] تگ خطا و UX برای `CRM_FILE_*`  
- [ ] اگر WebSocket بسته شد، **polling** سبک (مثلاً هر ۱۵–۳۰ ثانیه) برای `GET .../messages`  

---

## CORS و دامنه مجاز

- هدر `Origin` درخواست باید با hostnameهای ثبت‌شده در ویجت (`allowed_origins`) سازگار باشد.  
- اگر `allowed_origins` خالی باشد، بک‌اند مبدأ را محدود **نمی‌کند** (برای توسعه)؛ در **تولید** حتماً دامنه‌ها را در پنل محدود کنید.

---

## امنیت و نکات تولید

- `visitor_token` را **شبیه session** ببینید؛ در URLهای اشتراکی/لاگ تولیدی قرارش ندهید.  
- `public_key` را **عمومی** می‌پذیرید (برای شروع مکالمه)؛ اما **مدیریت ویجت** و داده‌های حساس فقط با API Key.  
- **محدودیت نرخ** این مسیرها از **فایروال مرکزی** (جدول `firewall_rate_policies` در دیتابیس، ارزیابی در `internal_firewall_middleware`) اعمال می‌شود؛ از پنل ادمین APIهای `GET/POST/PUT/DELETE .../admin/firewall/rate-policies` قابل مدیریت است. در Nginx استقرار، برای `/api/v1/public/crm-chat/` عمداً `limit_req` حذف شده تا فقط همین لایه حاکم باشد.

---

## ورکفلو (اتوماسیون داخل MarkStreet)

تریگرها برای نود Trigger در **ورکفلو** MarkStreet:

- `crm.chat.conversation.started`  
- `crm.chat.message.received`  
- `crm.chat.message.sent`  
- `crm.chat.conversation.assigned`  
- `crm.chat.conversation.resolved`  
- `crm.chat.conversation.reopened`  

`trigger_data` معمولاً شامل `conversation_id`, `widget_id` و برای پیام `message_id`, `body`, `sender_role` است (در صورت ارسال فایل ممکن است `file_storage_id` نیز در داده مرتبط منطق ثبت شود — نسخه بک‌اند را در صورت نیاز راستی‌آزمایی کنید).

---

## پایگاه داده و مایگریشن (برای ادمین/استقرار)

```bash
cd MarkStreetAPI
alembic upgrade head
```

- جداول/فیلدهای اولیه: `migrations/versions/20260505_000001_crm_chat_embed.py`  
- **فایل + تنظیمات CRM کسب‌وکار:** `migrations/versions/20260525_000001_crm_chat_files_settings.py` (جدول `business_crm_settings` و ستون `file_storage_id` روی `crm_chat_messages`).

`import` مدل در `migrations/env.py` برای Alembic لازم است (در مخزن فعلی اضافه شده است).

---

## عیب‌یابی

| پدیده | بررسی |
|--------|--------|
| 403 روی public | CORS؟ `Origin` و `allowed_origins`؟ |
| 404 روی `start` | `public_key`؟ ویجت `is_active`؟ |
| ارسال فایل 403 `CRM_FILE_UPLOAD_DISABLED` | **تنظیمات CRM** در MarkStreet |
| ارسال فایل 400 `CRM_FILE_NOT_AVAILABLE` | **پلن/فضای ذخیره‌سازی** — از پنل کسب‌وکار بررسی شود |
| WebSocket بسته می‌شود | پروکسی/timeout؛ **fallback به polling** |
| فایل در لیست «نیست» | نسخه بک‌اند/مایگریشن جدید نصب شده؟ `GET messages` باید `file` برگرداند |

---

*آخرین به‌روزرسانی سند: هم‌راستا با پشتیبانی ارسال فایل، تنظیمات `crm-settings` و دانلود عمومی فایل ضمیمه.*
