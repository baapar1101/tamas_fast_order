import { Link } from 'react-router-dom';
import { useBootstrap } from './hooks';
import './storefront.css';

/**
 * Content carried over verbatim from the old `terms.html`, rebuilt on the
 * shared design tokens instead of its own standalone stylesheet.
 */

const HIGHLIGHTS = [
  { value: '۷', title: '۷ روز مهلت اعلام', note: 'برای اعلام مغایرت سفارش' },
  { value: '۳', title: 'حداکثر ۳ روز کاری', note: 'برای بازگشت وجه بانکی' },
  { value: '✓', title: 'هماهنگی پیش از مرجوعی', note: 'با واحد پشتیبانی تماس مارکت' },
];

const SECTIONS = [
  {
    n: '۱',
    title: 'محدوده مسئولیت‌ها و خدمات',
    items: [
      {
        lead: 'مسئولیت ارسال و حمل‌ونقل:',
        body: 'تعهد ما صرفاً تا لحظه «تحویل صحیح و کامل بسته به شرکت حمل‌ونقل» شامل باربری، تیپاکس، پست یا پیک است. از لحظه تحویل به شرکت حمل، مسئولیت سلامت فیزیکی محموله و زمان رسیدن آن بر عهده شرکت حمل‌کننده خواهد بود.',
      },
      {
        lead: 'گارانتی و خدمات فنی:',
        body: 'تمامی محصولات دارای ضمانت‌نامه، مشمول قوانین خدمات پس از فروش «شرکت گارانتی‌کننده» هستند. مجموعه ما هیچ‌گونه دخل‌وتصرفی در فرآیند تعمیر یا تأیید شرایط گارانتی کالا ندارد.',
      },
      {
        lead: 'خطای مجموعه:',
        body: 'تنها در صورتی که کالا به دلیل خطای انسانی ما، مانند ارسال مدل یا تعداد اشتباه، دچار مغایرت باشد، مسئولیت اصلاح و جبران بر عهده تماس مارکت خواهد بود.',
      },
    ],
  },
  {
    n: '۲',
    title: 'قوانین و الزامات مرجوعی کالا',
    items: [
      {
        lead: 'حفظ سلامت بسته‌بندی:',
        body: 'کالا باید در بسته‌بندی اولیه و پلمپ اصلی باشد. هرگونه تغییر در بسته‌بندی یا استفاده از محصول، امکان بازگشت را از بین می‌برد.',
      },
      {
        lead: 'اثبات نقص:',
        body: 'ارسال تصویر یا ویدیو از ایراد کالا یا مغایرت به پشتیبانی از طریق واتس‌اپ یا تلگرام الزامی است.',
      },
      {
        lead: 'هماهنگی قبلی:',
        body: 'پیش از ارسال هرگونه کالا برای مرجوعی، حتماً باید هماهنگی تلفنی یا پیامکی با واحد پشتیبانی صورت گیرد.',
      },
    ],
  },
  {
    n: '۳',
    title: 'روش‌های جبران و بازگشت وجه',
    items: [
      {
        lead: 'اعتبار به کیف پول — سریع‌ترین روش:',
        body: 'مبلغ کالا بلافاصله به کیف پول حساب کاربری شما در پنل اضافه می‌شود تا در سفارش‌های بعدی بدون معطلی از آن استفاده کنید.',
      },
      {
        lead: 'بازگشت به حساب بانکی:',
        body: 'در صورت تمایل، مبلغ نهایی پس از تأیید کارشناس و هماهنگی با واحد مالی، حداکثر ظرف ۳ روز کاری به شماره شبای ثبت‌شده در پنل شما واریز خواهد شد.',
      },
    ],
  },
  {
    n: '۴',
    title: 'نکات بسیار مهم',
    items: [
      {
        lead: 'مهلت اعلام مغایرت:',
        body: 'سفارش‌های ثبت‌شده پس از گذشت ۷ روز، از نظر قانونی «تأییدشده توسط همکار» تلقی شده و مشمول قانون مرجوعی، به‌جز موارد دارای گارانتی، نخواهند بود.',
      },
      {
        lead: 'پیگیری حمل:',
        body: 'در صورت بروز آسیب در حین جابه‌جایی، همکار گرامی موظف است با ارائه رسید تحویل به باربری، از طریق شرکت حمل‌کننده پیگیری خسارت نماید.',
      },
    ],
  },
  {
    n: '۵',
    title: 'شرایط و تعهدات فروش',
    items: [
      {
        lead: 'حفظ مالکیت:',
        body: 'کالاهای موضوع این فاکتور تا زمان تسویه کامل وجه و پاس شدن چک‌ها/اسناد پرداخت، نزد خریدار به صورت «امانت» محسوب می‌گردد و مالکیت قانونی آن‌ها کماکان متعلق به «تماس مارکت» است.',
      },
      {
        lead: 'انتقال مالکیت:',
        body: 'انتقال قطعی و نهایی مالکیت کالاها به خریدار، صرفاً پس از وصول کامل وجه فاکتور امکان‌پذیر خواهد بود.',
      },
      {
        lead: 'حق استرداد:',
        body: 'در صورت عدم پرداخت به‌موقع اقساط یا برگشت خوردن چک‌های بدهی، خریدار به «تماس مارکت» اختیار تام می‌دهد تا بدون نیاز به اخذ مجوزهای قضاییِ اولیه (با استناد به این توافقنامه)، نسبت به شناسایی و استرداد کالاهای مذکور اقدام نماید. در این صورت، خریدار حق هرگونه ادعا یا شکایت بعدی را در این خصوص از خود سلب و ساقط می‌نماید.',
      },
      {
        lead: 'تأییدیه الکترونیک:',
        body: 'با تیک زدن چکباکسِ «تأیید شرایط» و ثبت نهایی سفارش، خریدار اقرار می‌نماید که این فاکتور در حکم سند رسمی بدهی بوده و تمامی مفاد فوق به منزله‌ی امضای قانونی خریدار و پذیرشِ بی‌قید و شرطِ این شرایط می‌باشد.',
      },
    ],
  },
];

export function TermsPage() {
  const { data } = useBootstrap();
  const settings = data?.settings ?? {};
  const phone = settings.support_phone || '09135006644';
  const address = settings.store_address || 'کرمان، خیابان شهید نامجو، بعد از کوچه ۹، پلاک ۱۰۹';

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="logo">
            <img src="/logo.png" alt="تماس مارکت" />
            <span className="logo-tagline">مرجع تخصصی فروش عمده کالای دیجیتال</span>
          </Link>
          <span className="spacer" />
          <Link to="/" className="top-btn">
            بازگشت به فروشگاه
          </Link>
        </div>
      </header>

      <main className="container" style={{ maxWidth: 900 }}>
        <div className="card" style={{ padding: '26px 24px', marginBottom: 18 }}>
          <span className="badge brand">شفافیت، اعتماد و همکاری پایدار</span>
          <h1 style={{ fontSize: 21, margin: '12px 0 10px', lineHeight: 1.7 }}>
            شرایط و قوانین همکاری: مرزهای مسئولیت و خدمات پس از فروش
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            ما در تماس مارکت بر پایه شفافیت و اعتماد، مسیر همکاری با شما را هموار کرده‌ایم. جهت حفظ نظم در فرآیند خرید و
            فروش، رعایت قوانین زیر الزامی است.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            marginBottom: 18,
          }}
        >
          {HIGHLIGHTS.map((h) => (
            <div className="card" key={h.title} style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--brand)' }}>{h.value}</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{h.title}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {h.note}
              </div>
            </div>
          ))}
        </div>

        <div className="stack">
          {SECTIONS.map((section) => (
            <section className="card" key={section.n} style={{ padding: 20 }}>
              <div className="row" style={{ marginBottom: 12 }}>
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: 'var(--brand)',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {section.n}
                </span>
                <h2 style={{ fontSize: 16, margin: 0 }}>{section.title}</h2>
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {section.items.map((item) => (
                  <p key={item.lead} style={{ margin: 0, lineHeight: 1.9 }}>
                    <b style={{ color: 'var(--brand-600)' }}>{item.lead}</b> {item.body}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="card" style={{ padding: 20, marginTop: 18 }}>
          <h2 style={{ fontSize: 16, marginTop: 0 }}>تماس با ما</h2>
          <p style={{ margin: '0 0 6px' }}>
            پیش از ارسال کالای مرجوعی با واحد پشتیبانی هماهنگ کنید.
          </p>
          <p style={{ margin: '0 0 4px' }}>
            شماره تماس: <b className="ltr-inline">{phone}</b>
          </p>
          <p className="muted" style={{ margin: 0 }}>
            آدرس: {address}
          </p>
        </div>
      </main>

      <footer className="site-footer">
        <div className="footer-bottom">© {new Date().getFullYear()} — تماس مارکت</div>
      </footer>
    </div>
  );
}
