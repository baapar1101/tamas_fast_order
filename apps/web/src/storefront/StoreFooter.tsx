import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useBootstrap } from './hooks';

export function StoreFooter() {
  const [aboutOpen, setAboutOpen] = useState(false);
  const bootstrap = useBootstrap();
  const settings = bootstrap.data?.settings ?? {};

  return (
    <footer className="site-footer">
      <div className="footer-container">
        <div className="footer-brand">
          <img src="/logo.png" alt="تماس مارکت" className="footer-logo" />
          <div className={`footer-about${aboutOpen ? ' open' : ''}`}>
            <h4 className="footer-title">درباره تماس مارکت (از سال ۱۳۹۰)</h4>
            <div className="footer-about-text">
              <p>
                داستان ما در تماس مارکت از سال ۱۳۹۰ با نام تجاری «موبایل تماس» آغاز شد. در ابتدا، تمرکز ما بر ارائه خدمات در حوزه موبایل بود، اما با شناخت عمیق‌تر نیازهای بازار و رشد چشمگیر صنعت، از سال ۱۳۹۴ مسیر فعالیتمان را به سمت فروش عمده لوازم جانبی موبایل سوق دادیم.
              </p>
              <p>
                در سال ۱۳۹۸، با هدف گسترش دامنه خدمات، بازار و ایجاد یک هویت تجاری مدرن‌تر، نام تجاری خود را به «تماس مارکت» تغییر دادیم. از سال ۱۳۹۹، با افتخار و تمرکز بر ارتقاء تجربه مشتریان، بستری جامع برای فروش آنلاین فراهم آورده‌ایم تا بتوانیم به صورت گسترده‌تر و کارآمدتر در خدمت شما عزیزان باشیم.
              </p>
              <p>
                امروز، تماس مارکت با پشتوانه سال‌ها تجربه و دانش تخصصی در حوزه فروش عمده کالای دیجیتال، به عنوان یکی از نام‌های شناخته شده در این صنعت، آماده ارائه بهترین خدمات و محصولات به شما همکاران گرامی است.
              </p>
            </div>
            <button type="button" className="footer-more" onClick={() => setAboutOpen(!aboutOpen)}>
              <span>{aboutOpen ? 'بستن' : 'مشاهده بیشتر'}</span>
              <Icon name="chevron" style={{ transform: aboutOpen ? 'rotate(180deg)' : 'none', transition: 'transform .3s ease' }} />
            </button>
          </div>
        </div>

        <div className="footer-benefits">
          <h3 className="footer-title">چرا همکاری با ما؟</h3>
          <p className="footer-text">
            <Icon name="money" /> <span><strong>قیمت‌های استثنایی:</strong> دسترسی مستقیم به قیمت‌های عمده و لحظه‌ای.</span>
          </p>
          <p className="footer-text">
            <Icon name="bolt" /> <span><strong>سرعت در سفارش:</strong> فرآیند ثبت و تأیید سریع برای اینکه وقت شما تلف نشود.</span>
          </p>
          <p className="footer-text">
            <Icon name="chart" /> <span><strong>پنل کاربری هوشمند:</strong> مدیریت آسان فاکتورها، موجودی و سفارشات در یک‌جا.</span>
          </p>
          <p className="footer-text">
            <Icon name="handshake" /> <span><strong>پشتیبانی همیشگی:</strong> تیم ما همیشه کنار شماست تا در مسیر کسب‌وکارتان کمکی کند.</span>
          </p>
        </div>

        <div className="footer-contact">
          <h3 className="footer-title">ارتباط با ما</h3>
          <p className="footer-text">
            <Icon name="phone" /> <span><strong>شماره تماس:</strong> <a href={`tel:${settings.support_phone || '09135006644'}`} className="footer-phone">{settings.support_phone || '۰۹۱۳۵۰۰۶۶۴۴'}</a></span>
          </p>
          <p className="footer-text">
            <Icon name="pin" /> <span><strong>آدرس:</strong> {settings.store_address || 'کرمان، خیابان شهید نامجو، بعد از کوچه ۹، پلاک ۱۰۹'}</span>
          </p>
          <p className="footer-text">
            <Icon name="mail" /> <span><strong>کد پستی:</strong> ۷۶۱۹۷۴۴۵۶۸</span>
          </p>
          <p className="footer-text">
            <Icon name="clock" /> <span><strong>ساعات کاری:</strong> شنبه تا پنجشنبه از ساعت ۹:۰۰ الی ۲۱:۰۰</span>
          </p>
          <div className="footer-socials" aria-label="شبکه‌های اجتماعی">
            <a className="footer-social-link whatsapp" href="https://whatsapp.com/channel/0029Vb4s4DUJf05jmXNTbq1q" target="_blank" rel="noopener noreferrer">
              <Icon name="support" />
              <span>واتس‌اپ</span>
            </a>
            <a className="footer-social-link instagram" href="https://www.instagram.com/tamasmarket.ir?stkn=MXV3enBoZHhpcHRrdQ==" target="_blank" rel="noopener noreferrer">
              <Icon name="eye" />
              <span>اینستاگرام</span>
            </a>
          </div>
        </div>

        <div className="footer-enamad">
          <h3 className="footer-title">نماد اعتماد</h3>
          <div className="enamad-box">
            <a referrerPolicy="origin" target="_blank" rel="noopener noreferrer" href="https://trustseal.enamad.ir/?id=553708&Code=Xw8AUVHGeMUsBwbqomP1VmI7XdD6Oruw">
              <img
                referrerPolicy="origin"
                src="https://trustseal.enamad.ir/logo.aspx?id=553708&Code=Xw8AUVHGeMUsBwbqomP1VmI7XdD6Oruw"
                alt="نماد اعتماد الکترونیکی"
              />
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <nav className="footer-legal" aria-label="پیوندهای مهم">
          <Link to="/terms"><Icon name="book" style={{ marginInlineEnd: 4 }} /> شرایط و قوانین همکاری</Link>
          <Link to="/terms#faq"><Icon name="help" style={{ marginInlineEnd: 4 }} /> سؤالات متداول</Link>
          <Link to="/terms#sales-terms"><Icon name="receipt" style={{ marginInlineEnd: 4 }} /> روش‌های پرداخت و تسویه‌حساب</Link>
        </nav>
        <p className="footer-copy">© تمامی حقوق برای تماس مارکت محفوظ است.</p>
      </div>
    </footer>
  );
}