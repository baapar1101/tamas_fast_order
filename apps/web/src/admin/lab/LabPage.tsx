import { useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  Bell,
  CircleAlert,
  Download,
  Headphones,
  Laptop,
  Minus,
  Moon,
  PackageCheck,
  Plus,
  Search,
  ShoppingCart,
  Smartphone,
  Sun,
  Trash2,
  Truck,
  Watch,
} from 'lucide-react';
import { Alert, AlertContent, AlertDescription, AlertIndicator, AlertTitle } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Breadcrumbs } from '../../components/ui/breadcrumbs';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { cn } from '../../components/ui/cn';
import { Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { NativeSelect } from '../../components/ui/native-select';
import OtpInput from '../../components/ui/otp-input';
import { Backdrop, OverlayWrapper } from '../../components/ui/overlay';
import { Pagination } from '../../components/ui/pagination';
import { Progress } from '../../components/ui/progress';
import { RadioInput } from '../../components/ui/radio-input';
import { Skeleton } from '../../components/ui/skeleton';
import { Spinner } from '../../components/ui/spinner';
import { TabContent, TabList, TabRoot, TabTrigger } from '../../components/ui/tabs';
import { TableBody, TableCell, TableHead, TableHeader, TableRoot, TableRow } from '../../components/ui/table';
import { TextArea } from '../../components/ui/text-area';
import { Toggle } from '../../components/ui/toggle';
// Inlined and attached only while the Lab is open: its utilities (`flex`,
// `hidden`, …) share names with legacy admin classes, so the sheet must not
// linger on other pages after navigating away.
import tailgridsCss from '../../components/ui/tailgrids.css?inline';
import labCss from './lab.css?inline';
import { useInjectedStyles } from '../../components/ui/useInjectedStyles';

const LAB_CSS = `${tailgridsCss}
${labCss}`;


type Surface = 'store' | 'admin';
type Mode = 'light' | 'dark';

const fa = (value: number) => value.toLocaleString('fa-IR');

/** Palette wrapper. Overlays render in a portal, so they repeat these classes. */
function scopeClasses(surface: Surface, mode: Mode): string {
  return surface === 'store' ? cn('tg-root tg-store', mode === 'light' && 'tg-force-light') : 'tg-root tg-admin';
}
function scopeAttrs(surface: Surface, mode: Mode) {
  return surface === 'store' && mode === 'dark' ? { 'data-theme': 'dark' } : {};
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-title-50">{title}</h2>
        {hint && <p className="text-sm text-text-100">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Storefront samples

interface SampleProduct {
  title: string;
  sku: string;
  price?: number;
  oldPrice?: number;
  stock: 'kerman' | 'tehran' | 'low' | 'out';
  icon: ReactNode;
}

const PRODUCTS: SampleProduct[] = [
  { title: 'گوشی موبایل سامسونگ Galaxy A56 ظرفیت ۲۵۶ گیگابایت', sku: '1040012345', price: 37_400_000, oldPrice: 42_500_000, stock: 'kerman', icon: <Smartphone /> },
  { title: 'هدفون بی‌سیم شیائومی Redmi Buds 6', sku: '2010300118', price: 2_190_000, stock: 'low', icon: <Headphones /> },
  { title: 'ساعت هوشمند امیزفیت GTS 4 Mini', sku: '3020044510', price: 4_850_000, stock: 'tehran', icon: <Watch /> },
  { title: 'لپ‌تاپ لنوو IdeaPad Slim 3 Core i5', sku: '5010000072', stock: 'out', icon: <Laptop /> },
];

function StockBadge({ stock }: { stock: SampleProduct['stock'] }) {
  if (stock === 'out') return <Badge color="gray">ناموجود</Badge>;
  if (stock === 'low') return <Badge color="warning">فقط {fa(2)} عدد</Badge>;
  return <Badge color={stock === 'kerman' ? 'success' : 'primary'}>موجود در {stock === 'kerman' ? 'کرمان' : 'تهران'}</Badge>;
}

function ProductSample({ product }: { product: SampleProduct }) {
  const [qty, setQty] = useState(product.stock === 'low' ? 1 : 0);
  const discount = product.oldPrice && product.price ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-base-100 bg-card-background-50 transition hover:shadow-lg">
      <div className="relative flex aspect-square items-center justify-center bg-background-soft-100 text-text-200 [&>svg]:size-16 [&>svg]:stroke-1">
        {discount > 0 && <Badge color="error" className="absolute start-3 top-3">{fa(discount)}٪ تخفیف</Badge>}
        {product.icon}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <StockBadge stock={product.stock} />
        <h3 className="line-clamp-2 text-sm font-medium leading-6 text-title-50">{product.title}</h3>
        <p className="text-xs text-text-200">کد کالا: {product.sku}</p>
        <div className="mt-auto pt-2">
          {product.price ? (
            <>
              {product.oldPrice && <del className="block text-xs text-text-200">{fa(product.oldPrice)}</del>}
              <span className="font-bold text-title-50">{fa(product.price)} <small className="font-normal text-text-100">تومان</small></span>
            </>
          ) : (
            <span className="text-sm text-text-200">قیمت به‌زودی</span>
          )}
        </div>
        {product.stock === 'out' ? (
          <Button appearance="outline" size="sm" className="w-full py-2.5"><Bell /> خبرم کن</Button>
        ) : qty === 0 ? (
          <Button size="sm" className="w-full py-2.5" onPress={() => setQty(1)}><ShoppingCart /> افزودن به سبد</Button>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-primary-500 p-1">
            <Button variant="ghost" size="sm" iconOnly aria-label="یکی بیشتر" className="text-primary-500" onPress={() => setQty((q) => q + 1)}><Plus /></Button>
            <span className="font-semibold text-title-50">{fa(qty)}</span>
            <Button variant="ghost" size="sm" iconOnly aria-label="یکی کمتر" className="text-error-500" onPress={() => setQty((q) => q - 1)}>
              {qty === 1 ? <Trash2 /> : <Minus />}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

function StoreSamples({ surface, mode }: { surface: Surface; mode: Mode }) {
  const [shipping, setShipping] = useState('post');
  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-base-100 bg-background-50 px-4 py-3">
        <div className="text-xl font-bold text-primary-500">تماس مارکت</div>
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-text-200" />
          <Input className="w-full ps-10" placeholder="جستجوی کالا، برند یا کد…" aria-label="جستجو" />
        </div>
        <Button variant="ghost" size="sm">ورود / ثبت‌نام</Button>
        <Button size="sm"><ShoppingCart /> سبد خرید <Badge size="sm" className="bg-white/20 text-white">{fa(3)}</Badge></Button>
      </div>

      <Section title="کارت محصول" hint="موجودی، تخفیف، افزودن به سبد و تغییر تعداد (روی دکمه‌ها بزنید)">
        <Breadcrumbs dividerType="chevron" items={[{ href: '#home', label: 'خانه' }, { href: '#mobile-tablet', label: 'موبایل و تبلت' }, { href: '#phones', label: 'گوشی موبایل' }]} activeHref="#phones" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {PRODUCTS.map((product) => <ProductSample key={product.sku} product={product} />)}
        </div>
      </Section>

      <Section title="در حال بارگذاری" hint="Skeleton و Spinner به‌جای چرخندهٔ فعلی">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1].map((key) => (
            <div key={key} className="flex flex-col gap-3 rounded-2xl border border-base-100 bg-card-background-50 p-4">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-4 w-4/5 rounded" />
              <Skeleton className="h-4 w-1/2 rounded" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
          <div className="col-span-2 flex items-center justify-center gap-6 rounded-2xl border border-dashed border-base-300 text-primary-500">
            <Spinner />
            <Spinner type="dotted" />
            <Spinner type="dotted-round" />
          </div>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="دکمه‌ها و برچسب‌ها">
          <Card className="md:min-w-0">
            <CardContent className="flex flex-col gap-4 pt-5">
              <div className="flex flex-wrap gap-3">
                <Button>ثبت سفارش</Button>
                <Button appearance="outline">ادامه خرید</Button>
                <Button variant="danger">حذف</Button>
                <Button variant="danger" appearance="outline">لغو سفارش</Button>
                <Button variant="success">پرداخت شد</Button>
                <Button variant="ghost">انصراف</Button>
                <Button disabled>غیرفعال</Button>
                <Button pending>در حال ارسال</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="xs">خیلی کوچک</Button>
                <Button size="sm">کوچک</Button>
                <Button size="md">متوسط</Button>
                <Button size="lg">بزرگ</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge color="warning">در انتظار پرداخت</Badge>
                <Badge color="primary">در حال آماده‌سازی</Badge>
                <Badge color="sky" prefixIcon={<Truck />}>ارسال شد</Badge>
                <Badge color="success" prefixIcon={<PackageCheck />}>تحویل شد</Badge>
                <Badge color="error">لغو شد</Badge>
                <Badge color="gray">پیش‌نویس</Badge>
              </div>
            </CardContent>
          </Card>
        </Section>

        <Section title="پیام‌ها">
          <div className="flex flex-col gap-3">
            <Alert status="success"><AlertIndicator /><AlertContent><AlertTitle>سفارش شما ثبت شد</AlertTitle><AlertDescription>شماره سفارش {fa(10423)}؛ پیامک پیگیری برایتان ارسال شد.</AlertDescription></AlertContent></Alert>
            <Alert status="warning"><AlertIndicator /><AlertContent><AlertTitle>موجودی محدود</AlertTitle><AlertDescription>از این کالا فقط {fa(2)} عدد در انبار کرمان باقی مانده است.</AlertDescription></AlertContent></Alert>
            <Alert status="error"><AlertIndicator /><AlertContent><AlertTitle>پرداخت ناموفق بود</AlertTitle><AlertDescription>مبلغی کسر نشده است؛ دوباره تلاش کنید.</AlertDescription></AlertContent></Alert>
            <Alert status="info"><AlertIndicator /><AlertContent><AlertTitle>ارسال رایگان</AlertTitle><AlertDescription>برای خریدهای بالای ۵ میلیون تومان در کرمان.</AlertDescription></AlertContent></Alert>
          </div>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="ورود با کد یک‌بارمصرف" hint="OTP Input">
          <Card className="md:min-w-0">
            <CardHeader>
              <CardTitle className="text-lg md:text-lg">کد تأیید را وارد کنید</CardTitle>
              <CardDescription className="text-sm">کد ۶ رقمی به ۰۹۱۲ *** ۴۵۶۷ پیامک شد.</CardDescription>
            </CardHeader>
            <CardContent>
              <div dir="ltr" className="flex justify-center"><OtpInput digitLength={6} hint="ارسال دوباره تا ۰۱:۴۵" /></div>
            </CardContent>
            <CardFooter><Button className="w-full">تأیید و ورود</Button></CardFooter>
          </Card>
        </Section>

        <Section title="سبد خرید" hint="Card و Progress">
          <Card className="md:min-w-0">
            <CardHeader><CardTitle className="text-lg md:text-lg">خلاصهٔ سفارش</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between"><span>جمع کالاها ({fa(3)})</span><span className="text-title-50">{fa(44_440_000)} تومان</span></div>
              <div className="flex justify-between"><span>تخفیف</span><span className="text-error-500">−{fa(5_100_000)} تومان</span></div>
              <div className="flex justify-between"><span>هزینهٔ ارسال</span><Badge color="success">رایگان</Badge></div>
              <div className="h-px bg-base-100" />
              <div className="flex justify-between text-base font-bold text-title-50"><span>مبلغ قابل پرداخت</span><span>{fa(39_340_000)} تومان</span></div>
              <div className="flex flex-col gap-1.5 rounded-lg bg-background-soft-50 p-3">
                <span className="text-xs">اعتبار خرید شما: {fa(68)}٪ استفاده شده</span>
                <Progress progress={68} />
              </div>
            </CardContent>
            <CardFooter><Button size="lg" className="w-full">ادامه و پرداخت</Button></CardFooter>
          </Card>
        </Section>
      </div>

      <Section title="فرم اطلاعات ارسال" hint="Input، NativeSelect، TextArea، Radio، Checkbox و Toggle">
        <Card className="md:min-w-0">
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-input-label-text">نام و نام خانوادگی<Input defaultValue="علی رضایی" /></label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-input-label-text">
              شماره همراه
              <Input state="error" defaultValue="۰۹۱۲۳۴" dir="ltr" />
              <span className="text-xs font-normal text-input-error">شماره همراه باید ۱۱ رقم باشد.</span>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-input-label-text">
              شهر
              <NativeSelect defaultValue="kerman"><option value="kerman">کرمان</option><option value="tehran">تهران</option></NativeSelect>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-input-label-text">کد پستی<Input placeholder="۱۰ رقم" dir="ltr" /></label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-input-label-text sm:col-span-2">نشانی<TextArea rows={2} placeholder="خیابان، کوچه، پلاک…" /></label>
            <fieldset className="flex flex-col gap-2 sm:col-span-2">
              <legend className="mb-1 text-sm font-medium text-input-label-text">روش ارسال</legend>
              {[['post', 'پست پیشتاز (۳ تا ۵ روز)'], ['courier', 'پیک کرمان (همان روز)'], ['pickup', 'تحویل حضوری از انبار']].map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-text-50">
                  <RadioInput name={`ship-${surface}-${mode}`} value={value} checked={shipping === value} onChange={() => setShipping(value!)} />
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="flex items-center gap-2 text-sm text-text-50"><Checkbox defaultChecked /> این نشانی پیش‌فرض باشد</label>
            <Toggle label="فاکتور رسمی می‌خواهم" />
          </CardContent>
        </Card>
      </Section>

      <Section title="پنجرهٔ پیام" hint="Dialog؛ روی دکمه بزنید">
        <div className="flex flex-wrap gap-3">
          <OverlayWrapper>
            <Button appearance="outline">پیام «حساب کامل نیست»</Button>
            <Backdrop className={scopeClasses(surface, mode)} {...scopeAttrs(surface, mode)}>
              <Dialog className="max-w-md text-center">
                {({ close }) => (
                  <>
                    <DialogHeader className="items-center text-center">
                      <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-500"><BadgeCheck className="size-6" /></span>
                      <DialogTitle>حساب کاربری شما کامل نیست</DialogTitle>
                      <DialogDescription>برای دیدن قیمت‌ها و ثبت سفارش، اطلاعات حساب کاربری خود را کامل کنید.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-center">
                      <Button onPress={close}>تکمیل حساب</Button>
                      <Button variant="danger" appearance="outline" onPress={close}>خروج از حساب</Button>
                    </DialogFooter>
                  </>
                )}
              </Dialog>
            </Backdrop>
          </OverlayWrapper>
        </div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin samples

const ORDERS = [
  { id: 10423, customer: 'علی رضایی', city: 'کرمان', total: 39_590_000, status: ['warning', 'در انتظار پرداخت'] },
  { id: 10422, customer: 'مریم احمدی', city: 'تهران', total: 4_850_000, status: ['primary', 'در حال آماده‌سازی'] },
  { id: 10421, customer: 'فروشگاه نوین', city: 'کرمان', total: 122_000_000, status: ['success', 'تحویل شد'] },
  { id: 10420, customer: 'حسین کریمی', city: 'رفسنجان', total: 2_190_000, status: ['sky', 'ارسال شد'] },
  { id: 10419, customer: 'زهرا موسوی', city: 'کرمان', total: 8_400_000, status: ['error', 'لغو شد'] },
] as const;

function AdminSamples({ surface, mode }: { surface: Surface; mode: Mode }) {
  const [page, setPage] = useState(1);
  const stats = [
    { label: 'فروش امروز', value: '۸۴٫۲ م تومان', badge: <Badge color="success">↑ {fa(12)}٪</Badge> },
    { label: 'سفارش‌های باز', value: fa(27), badge: <Badge color="warning">{fa(5)} منتظر تأیید</Badge> },
    { label: 'کالاهای موجود', value: fa(1052), badge: <Badge color="gray">{fa(7)} به‌روز شد</Badge> },
    { label: 'مشتریان جدید', value: fa(18), badge: <Badge color="error">↓ {fa(3)}٪</Badge> },
  ];
  return (
    <div className="flex flex-col gap-10">
      <Section title="کارت‌های خلاصه">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 rounded-2xl border border-base-100 bg-card-background-50 p-5">
              <span className="text-sm text-text-100">{stat.label}</span>
              <span className="text-2xl font-bold text-title-50">{stat.value}</span>
              <span>{stat.badge}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="جدول سفارش‌ها" hint="Tabs، Table و Pagination">
        <TabRoot defaultValue="all" className="overflow-hidden bg-card-background-50">
          <div className="flex flex-wrap items-center gap-3 border-b border-base-100 p-3">
            <TabList className="border-0 p-0">
              <TabTrigger value="all" badge={fa(27)}>همه</TabTrigger>
              <TabTrigger value="pending" badge={fa(5)}>در انتظار</TabTrigger>
              <TabTrigger value="sent">ارسال‌شده</TabTrigger>
            </TabList>
            <div className="relative ms-auto">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-text-200" />
              <Input className="w-56 py-2 ps-9 text-sm" placeholder="جستجوی سفارش…" aria-label="جستجوی سفارش" />
            </div>
            <Button appearance="outline" size="sm" className="px-3 py-2"><Download /> خروجی اکسل</Button>
          </div>
          {['all', 'pending', 'sent'].map((tab) => (
            <TabContent key={tab} value={tab} className="p-0">
              <TableRoot fullBleed data-excel-export="off">
                <TableHeader>
                  <TableRow>
                    <TableHead><Checkbox aria-label="انتخاب همه" /></TableHead>
                    <TableHead>شماره</TableHead>
                    <TableHead>مشتری</TableHead>
                    <TableHead>شهر</TableHead>
                    <TableHead>مبلغ (تومان)</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ORDERS.filter((order) => tab === 'all' || (tab === 'pending' ? order.status[0] === 'warning' : order.status[0] === 'sky')).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell><Checkbox aria-label={`انتخاب سفارش ${order.id}`} /></TableCell>
                      <TableCell className="font-medium text-title-50">{fa(order.id)}</TableCell>
                      <TableCell>{order.customer}</TableCell>
                      <TableCell>{order.city}</TableCell>
                      <TableCell>{fa(order.total)}</TableCell>
                      <TableCell><Badge color={order.status[0]}>{order.status[1]}</Badge></TableCell>
                      <TableCell className="text-end"><Button variant="ghost" size="xs" className="px-2 py-1">جزئیات</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </TableRoot>
            </TabContent>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-base-100 p-3 text-sm text-text-100">
            <span>نمایش {fa(1)} تا {fa(5)} از {fa(27)}</span>
            <Pagination currentPage={page} totalPages={6} onPageChange={setPage} />
          </div>
        </TabRoot>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="فرم ویرایش کالا">
          <Card className="md:min-w-0">
            <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-input-label-text sm:col-span-2">عنوان کالا<Input defaultValue="گوشی موبایل سامسونگ Galaxy A56" /></label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-input-label-text">کد کالا (SKU)<Input defaultValue="1040012345" dir="ltr" /></label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-input-label-text">
                دسته‌بندی
                <NativeSelect defaultValue="mobile"><option value="mobile">گوشی موبایل</option><option value="tablet">تبلت</option></NativeSelect>
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-input-label-text">قیمت (تومان)<Input defaultValue="37,400,000" dir="ltr" /></label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-input-label-text">
                موجودی کرمان
                <Input state="success" defaultValue="12" dir="ltr" />
              </label>
              <div className="flex flex-col gap-3 sm:col-span-2">
                <Toggle size="md" defaultChecked label="نمایش در فروشگاه" />
                <Toggle size="md" label="فقط برای همکاران" />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button appearance="outline" size="sm">انصراف</Button>
              <Button size="sm">ذخیره</Button>
            </CardFooter>
          </Card>
        </Section>

        <Section title="پیام‌ها و تأیید حذف">
          <div className="flex flex-col gap-3">
            <Alert status="success"><AlertIndicator /><AlertContent><AlertTitle>به‌روزرسانی موجودی انجام شد</AlertTitle><AlertDescription>{fa(7)} کالا به‌روز شد، {fa(524)} ردیف بدون تغییر بود.</AlertDescription></AlertContent></Alert>
            <Alert status="error"><AlertIndicator /><AlertContent><AlertTitle>{fa(521)} ردیف خطا داشت</AlertTitle><AlertDescription>کد کالای این ردیف‌ها در سایت پیدا نشد.</AlertDescription></AlertContent></Alert>
            <Alert><AlertIndicator><CircleAlert /></AlertIndicator><AlertContent><AlertTitle>همگام‌سازی بعدی</AlertTitle><AlertDescription>امشب ساعت ۲۳:۰۰ از گوگل‌شیت.</AlertDescription></AlertContent></Alert>
            <OverlayWrapper>
              <Button variant="danger" appearance="outline" className="self-start"><Trash2 /> حذف کالا</Button>
              <Backdrop className={scopeClasses(surface, mode)}>
                <Dialog className="max-w-md">
                  {({ close }) => (
                    <>
                      <DialogHeader>
                        <DialogTitle>این کالا حذف شود؟</DialogTitle>
                        <DialogDescription>«گوشی موبایل سامسونگ Galaxy A56» از فروشگاه برداشته می‌شود.</DialogDescription>
                      </DialogHeader>
                      <DialogBody>سفارش‌های قبلی این کالا دست نمی‌خورند.</DialogBody>
                      <DialogFooter>
                        <Button appearance="outline" size="sm" onPress={close}>انصراف</Button>
                        <Button variant="danger" size="sm" onPress={close}>بله، حذف شود</Button>
                      </DialogFooter>
                    </>
                  )}
                </Dialog>
              </Backdrop>
            </OverlayWrapper>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * Admin "Lab": Tailgrids components with the site's palettes, to review the
 * new look before any real page changes. Tailwind's CSS loads with this page only.
 */
export function LabPage() {
  const [surface, setSurface] = useState<Surface>('store');
  const [mode, setMode] = useState<Mode>('light');
  // Avoid one unstyled frame before the sheet is attached.
  if (!useInjectedStyles('lab', LAB_CSS)) return null;

  return (
    <div className="tg-root tg-admin flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-base-100 bg-card-background-50 p-4">
        <div className="me-auto">
          <h1 className="text-xl font-bold text-title-50">آزمایشگاه رابط کاربری</h1>
          <p className="text-sm text-text-100">نمونه‌های Tailgrids با رنگ و فونت تماس. فقط برای دیدن است و هیچ بخشی از سایت را تغییر نمی‌دهد.</p>
        </div>
        <div className="flex rounded-lg bg-tab-background p-1 text-sm" role="tablist" aria-label="نوع نمونه‌ها">
          {([['store', 'فروشگاه'], ['admin', 'پنل مدیریت']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={surface === value}
              onClick={() => setSurface(value)}
              className={cn('rounded-md px-4 py-1.5 font-medium transition', surface === value ? 'bg-tab-active-background text-title-50 shadow-sm' : 'text-text-100 hover:text-title-50')}
            >
              {label}
            </button>
          ))}
        </div>
        {surface === 'store' && (
          <Button appearance="outline" size="sm" className="px-3 py-2" onPress={() => setMode((m) => (m === 'light' ? 'dark' : 'light'))}>
            {mode === 'light' ? <Moon /> : <Sun />}
            {mode === 'light' ? 'حالت تیره' : 'حالت روشن'}
          </Button>
        )}
      </div>

      <div
        className={cn(scopeClasses(surface, mode), surface === 'store' && 'lab-canvas rounded-2xl p-4 sm:p-6')}
        {...scopeAttrs(surface, mode)}
      >
        {surface === 'store' ? <StoreSamples surface={surface} mode={mode} /> : <AdminSamples surface={surface} mode={mode} />}
      </div>
      {surface === 'admin' && <p className="text-xs text-text-100">نمونه‌های پنل از حالت روشن/تیرهٔ خود پنل پیروی می‌کنند (دکمهٔ تغییر تم بالای صفحه).</p>}
    </div>
  );
}
