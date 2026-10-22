# دیزاین سیستم تماس مارکت

این سند قرارداد واحد رابط فروشگاه و پنل مدیریت است. منبع اجرایی توکن‌ها فایل `apps/web/src/styles/design-system.css` است؛ در صورت اختلاف، مقدار همان فایل معتبر است.

## اصول ثابت

- طراحی RTL و فارسی است؛ شماره، SKU، کد سفارش و داده انگلیسی با `direction: ltr` و `unicode-bidi: isolate` نمایش داده می‌شوند.
- همه رنگ‌ها، فاصله‌ها، شعاع‌ها، سایه‌ها، اندازه کنترل‌ها و حرکت‌ها باید از توکن‌های `--ds-*` مصرف شوند.
- فروشگاه از accent فیروزه‌ای و پنل مدیریت از accent آبی استفاده می‌کند، ولی هر دو روی یک مقیاس، وضعیت و ساختار کامپوننتی هستند.
- تم روشن و تیره با توکن معنایی پیاده می‌شود؛ کامپوننت نباید برای تم‌ها رنگ مستقیم تعریف کند.
- حداقل ارتفاع کنترل لمسی 44px است. فقط کنترل کوچک و غیر اصلی می‌تواند 36px باشد.
- focus همیشه قابل مشاهده است. حذف عمومی `outline` ممنوع است.
- استفاده از `transition: all` در کد جدید ممنوع است؛ فقط propertyهای لازم transition می‌گیرند.

## لایه‌های توکن

### ۱. Primitive

مقادیر خام فقط در `design-system.css` تعریف می‌شوند:

- رنگ‌ها: `--ds-slate-*`, `--ds-teal-*`, `--ds-blue-*`, `--ds-green-*`, `--ds-amber-*`, `--ds-red-*`
- تایپوگرافی: `--ds-text-*`, `--ds-leading-*`, `--ds-weight-*`
- فاصله: `--ds-space-1` تا `--ds-space-16` روی شبکه 4px
- شکل: `--ds-radius-xs` تا `--ds-radius-full`
- سایه: `--ds-shadow-xs` تا `--ds-shadow-lg`
- حرکت: `--ds-duration-*`, `--ds-ease-*`
- لایه: `--ds-layer-sticky`, `--ds-layer-dropdown`, `--ds-layer-modal`, `--ds-layer-toast`

### ۲. Semantic

کامپوننت‌ها باید فقط نقش را مصرف کنند، نه نام رنگ را:

| نقش | توکن |
| --- | --- |
| بوم صفحه | `--ds-canvas` |
| سطح عادی / فرعی / برجسته | `--ds-surface`, `--ds-surface-subtle`, `--ds-surface-raised` |
| متن اصلی / ثانویه / کم‌رنگ / غیرفعال | `--ds-text`, `--ds-text-secondary`, `--ds-text-muted`, `--ds-text-disabled` |
| خط عادی / قوی | `--ds-border`, `--ds-border-strong` |
| عمل اصلی | `--ds-interactive`, `--ds-interactive-hover`, `--ds-interactive-soft` |
| وضعیت‌ها | `--ds-success`, `--ds-warning`, `--ds-danger`, `--ds-info` و نسخه `-soft` |
| focus | `--ds-focus-ring`, `--ds-danger-ring` |

پنل مدیریت معادل همین نقش‌ها را با پیشوند `--ds-admin-*` دارد. کلاس‌های قدیمی `--tamas-*` و `--a-*` فقط adapter هستند و نباید برای قابلیت جدید توکن تازه دریافت کنند.

## تایپوگرافی

- فونت کل محصول: `--ds-font-sans` (Vazirmatn FD با fallback سیستم)
- متن ریز: 11px؛ متن کمکی: 13px؛ متن عادی: 14px؛ عنوان بخش: 16px؛ عنوان صفحه: 20px تا 26px
- وزن‌های مجاز: 400 عادی، 550 متوسط، 650 نیمه‌ضخیم، 750 عنوان، 850 تاکید ویژه
- متن بدنه line-height برابر 1.7 و متن توضیحی 1.9 دارد.
- اندازه فونت برای جا شدن متن کوچک نمی‌شود؛ متن بلند wrap یا truncate هدفمند می‌شود.

## چیدمان و Responsive

- عرض فروشگاه حداکثر `--ds-content-max` و پنل `--ds-admin-content-max` است.
- gutter دسکتاپ 24px، تبلت 20px و موبایل 12px است.
- فاصله کارت‌های هم‌سطح 16px و فاصله بخش‌های صفحه 20px است.
- breakpoint محتوایی اصلی 760px است؛ breakpointهای تخصصی شبکه می‌توانند 640، 1024 و 1180 باشند.
- در عرض 360px هیچ scroll افقی صفحه مجاز نیست. جدول می‌تواند فقط داخل wrapper خودش scroll شود.
- اکشن‌های موبایل تمام‌عرض یا شبکه دو ستونه می‌شوند؛ هدف لمسی کمتر از 40px مجاز نیست.

ماتریس کنترل: 360×800، 390×844، 430×932، 600×960، 820×1180، 1024×768، 1366×768، 1440×900 و 1920×1080.

## قرارداد کامپوننت‌ها

| کامپوننت | API جدید | سازگاری موجود |
| --- | --- | --- |
| صفحه / کانتینر | `.ds-page`, `.ds-container` | `.a-page`, `.container` |
| سطح / کارت | `.ds-surface` | `.a-card`, `.product-card`, `.product-accordion` |
| دکمه | `.ds-button` با variantهای primary, danger, ghost | `.btn`, `.a-btn` |
| فیلد | `.ds-field`, `.ds-label`, `.ds-control`, `.ds-hint` | `.field`, `.input`, `.select`, `.textarea`, `.a-input`, `.a-select`, `.a-textarea` |
| badge | `.ds-badge` با وضعیت‌های معنایی | `.badge`, `.a-badge` |
| alert | `.ds-alert` با وضعیت‌های معنایی | `.alert` |
| جدول | `.ds-table-wrap`, `.ds-table` | `.a-table-wrap`, `.a-table` |
| مودال | کامپوننت React `Modal` | `.modal-*`, `.admin-modal-*` |
| اعلان | کامپوننت React `ToastProvider` | `.toast-*` |

برای قابلیت جدید از API `ds-*` استفاده شود. کلاس قدیمی فقط هنگام تغییر یک صفحه موجود مجاز است و باید از aliasهای همان سیستم تغذیه شود.

## وضعیت‌های اجباری

هر کنترل تعاملی باید این حالت‌ها را داشته باشد: default، hover، focus-visible، active، disabled و loading. فرم علاوه بر آن error و success دارد. صفحه داده‌ای باید loading، empty، error و loaded را پوشش دهد.

- primary فقط برای مهم‌ترین عمل هر ناحیه است.
- danger فقط برای عمل مخرب است و نباید ظاهر primary داشته باشد.
- ghost برای اعمال فرعی و icon-only است.
- خطای اعتبارسنجی با رنگ، متن و `aria-invalid` اعلام می‌شود؛ رنگ به تنهایی کافی نیست.
- مودال focus trap، Escape، بازگرداندن focus و عنوان قابل دسترس دارد.
- انیمیشن تحت `prefers-reduced-motion` عملاً غیرفعال می‌شود.

## قواعد توسعه

1. قبل از ساخت کامپوننت جدید، primitive موجود را بررسی کنید.
2. مقدار hex/rgb جدید در CSS صفحه یا JSX ممنوع است؛ استثنا فقط artwork کمپین، رنگ واقعی محصول و خروجی چاپی است.
3. inline style برای ظاهر ثابت ممنوع است؛ فقط مقدار واقعاً پویا مثل درصد progress یا مختصات مجاز است.
4. آیکن باید SVG مشترک و `currentColor` باشد.
5. متن icon-only باید `aria-label` داشته باشد.
6. selector فروشگاه نباید وارد `.admin-body-shell` شود و selector پنل باید به shell یا `body.admin-page-active` محدود بماند.
7. هر تغییر بصری با build، تست و بررسی حداقل یک viewport موبایل و یک viewport دسکتاپ تحویل می‌شود.

## چک‌لیست Pull Request

- فقط از توکن معنایی استفاده شده است.
- حالت روشن و تیره خوانا هستند و کنتراست متن حفظ شده است.
- focus با کیبورد دیده می‌شود و ترتیب tab منطقی است.
- RTL، متن بلند، عدد LTR و حالت loading/empty/error بررسی شده‌اند.
- موبایل 360px scroll افقی صفحه ندارد.
- کامپوننت جدید API تکراری برای button/input/card نساخته است.
- `npm run build -w @tamas/web` و `npm run test -w @tamas/web` موفق هستند.
