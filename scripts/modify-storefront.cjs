const fs = require('fs');
const file = 'd:/tamas_fast_order/apps/web/src/storefront/StorefrontPage.tsx';
let c = fs.readFileSync(file, 'utf8');

// 1. Add mobileTab state
c = c.replace(
  "const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');",
  "const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');\n  const [mobileTab, setMobileTab] = useState<'home' | 'categories' | 'search' | 'cart' | 'profile'>('home');"
);

// 2. Wrap main container
c = c.replace(
  '<main className="container">',
  '<main className="container" data-mobile-tab={mobileTab}>\n' +
  '        {/* Mobile-only Categories View */}\n' +
  '        <div className="mobile-only-categories">\n' +
  '          <div style={{ padding: \'20px 16px\', background: \'#fff\', borderBottom: \'1px solid #f1f5f9\', position: \'sticky\', top: 0, zIndex: 10 }}>\n' +
  '            <h2 style={{ fontSize: 18, fontWeight: 800, color: \'#0f172a\' }}>دسته‌بندی محصولات</h2>\n' +
  '          </div>\n' +
  '          <div style={{ display: \'grid\', gridTemplateColumns: \'repeat(2, 1fr)\', gap: 12, padding: 16 }}>\n' +
  '            {(bootstrap.data?.categories ?? []).map((c) => {\n' +
  '              const iconSrc = c.iconUrl ? c.iconUrl.startsWith(\'http\') || c.iconUrl.startsWith(\'/\') ? c.iconUrl : c.iconUrl.startsWith(\'img_\') ? `/uploads/${c.iconUrl}` : `/assets/category/${c.iconUrl}` : null;\n' +
  '              return (\n' +
  '                <button\n' +
  '                  key={c.id}\n' +
  '                  type="button"\n' +
  '                  style={{ display: \'flex\', flexDirection: \'column\', alignItems: \'center\', gap: 12, padding: \'24px 12px\', background: \'#fff\', borderRadius: 16, border: \'1px solid #e2e8f0\', boxShadow: \'0 2px 10px rgba(0,0,0,0.02)\' }}\n' +
  '                  onClick={() => { setCategory(c.name); setBrands([]); resetPage(); setMobileTab(\'home\'); }}\n' +
  '                >\n' +
  '                  {iconSrc ? <img src={iconSrc} alt="" loading="lazy" style={{ width: 48, height: 48, objectFit: \'contain\' }} /> : <span style={{ fontSize: 32, color: \'var(--primary)\' }}><Icon name="box" /></span>}\n' +
  '                  <span style={{ fontSize: 13, fontWeight: 700, color: \'#334155\' }}>{c.faName}</span>\n' +
  '                </button>\n' +
  '              );\n' +
  '            })}\n' +
  '          </div>\n' +
  '        </div>\n' +
  '\n' +
  '        {/* Mobile-only Cart View */}\n' +
  '        <div className="mobile-only-cart" style={{ height: \'100%\', overflowY: \'auto\', background: \'#f8fafc\' }}>\n' +
  '          <CartPanel onCheckout={openCheckout} canViewPrices={canViewPrices} />\n' +
  '        </div>\n' +
  '\n' +
  '        {/* Mobile-only Profile View */}\n' +
  '        <div className="mobile-only-profile" style={{ height: \'100%\', overflowY: \'auto\', padding: 16, background: \'#f8fafc\' }}>\n' +
  '          {user ? (\n' +
  '            <div style={{ background: \'#fff\', borderRadius: 16, padding: 20, boxShadow: \'0 2px 10px rgba(0,0,0,0.02)\', textAlign: \'center\' }}>\n' +
  '              <div style={{ width: 80, height: 80, borderRadius: \'50%\', background: \'var(--brand)\', color: \'white\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\', fontSize: 32, fontWeight: 800, margin: \'0 auto 16px\' }}>{user.name?.[0] || \'U\'}</div>\n' +
  '              <h2 style={{ fontSize: 20, fontWeight: 800, color: \'#0f172a\', marginBottom: 4 }}>{user.name} {user.lastName}</h2>\n' +
  '              <p style={{ fontSize: 14, color: \'#64748b\', marginBottom: 24 }}>{user.phone}</p>\n' +
  '              <div style={{ display: \'flex\', flexDirection: \'column\', gap: 12 }}>\n' +
  '                <Link to="/orders" style={{ display: \'flex\', alignItems: \'center\', gap: 12, padding: 16, background: \'#f1f5f9\', borderRadius: 12, color: \'#334155\', textDecoration: \'none\', fontWeight: 600 }}><Icon name="bag" /> سفارش‌های من</Link>\n' +
  '                {isAdmin && <Link to="/admin" style={{ display: \'flex\', alignItems: \'center\', gap: 12, padding: 16, background: \'#ecfdf5\', borderRadius: 12, color: \'#059669\', textDecoration: \'none\', fontWeight: 600 }}><Icon name="grid" /> پنل مدیریت</Link>}\n' +
  '                <button type="button" onClick={() => { localStorage.removeItem(\'tamas_session\'); window.location.reload(); }} style={{ display: \'flex\', alignItems: \'center\', gap: 12, padding: 16, background: \'#fff1f2\', borderRadius: 12, color: \'#e11d48\', border: \'none\', fontWeight: 600, cursor: \'pointer\' }}><Icon name="chevron" style={{ transform: \'rotate(180deg)\' }} /> خروج از حساب</button>\n' +
  '              </div>\n' +
  '            </div>\n' +
  '          ) : (\n' +
  '            <div style={{ background: \'#fff\', borderRadius: 16, padding: 32, boxShadow: \'0 2px 10px rgba(0,0,0,0.02)\', textAlign: \'center\', marginTop: 40 }}>\n' +
  '              <div style={{ width: 64, height: 64, borderRadius: \'50%\', background: \'#f1f5f9\', color: \'#64748b\', display: \'flex\', alignItems: \'center\', justifyContent: \'center\', fontSize: 28, margin: \'0 auto 16px\' }}><Icon name="user" /></div>\n' +
  '              <h2 style={{ fontSize: 18, fontWeight: 800, color: \'#0f172a\', marginBottom: 12 }}>وارد حساب کاربری شوید</h2>\n' +
  '              <p style={{ fontSize: 13, color: \'#64748b\', marginBottom: 24, lineHeight: 1.6 }}>برای مشاهده قیمت‌های همکاری و ثبت سفارش، لطفاً وارد شوید.</p>\n' +
  '              <button type="button" className="btn primary w-full" onClick={() => { setAuthStep(\'phone\'); setAuthOpen(true); }}>ورود / ثبت‌نام</button>\n' +
  '            </div>\n' +
  '          )}\n' +
  '        </div>'
);

// 3. Move CartPanel to be desktop only
c = c.replace(
  '<CartPanel onCheckout={openCheckout} canViewPrices={canViewPrices} />\n        </div>\n      </main>',
  '<div className="desktop-only-cart"><CartPanel onCheckout={openCheckout} canViewPrices={canViewPrices} /></div>\n        </div>\n      </main>'
);

// 4. Replace the tabbar
c = c.replace(
  /<nav className="tabbar" aria-label="ناوبری موبایل">[\s\S]*?<\/nav>/,
  '<nav className="tabbar" aria-label="ناوبری موبایل">\n' +
  '        <button type="button" className={`tabbar-item ${mobileTab === \'home\' ? \'active\' : \'\'}`} onClick={() => { setSearch(\'\'); setCategory(null); setBrands([]); setPromotion(false); setInStockOnly(false); resetPage(); setMobileTab(\'home\'); window.scrollTo({ top: 0, behavior: \'smooth\' }); }}>\n' +
  '          <span className="tabbar-icon"><Icon name="home" /></span><span>صفحه اصلی</span>\n' +
  '        </button>\n' +
  '        <button type="button" className={`tabbar-item ${mobileTab === \'categories\' ? \'active\' : \'\'}`} onClick={() => setMobileTab(\'categories\')}>\n' +
  '          <span className="tabbar-icon"><Icon name="grid" /></span><span>دسته‌بندی‌ها</span>\n' +
  '        </button>\n' +
  '        <button type="button" className={`tabbar-item ${mobileTab === \'search\' ? \'active\' : \'\'}`} onClick={() => setMobileTab(\'search\')}>\n' +
  '          <span className="tabbar-icon"><Icon name="search" /></span><span>جستجو</span>\n' +
  '        </button>\n' +
  '        <button type="button" className={`tabbar-item ${mobileTab === \'cart\' ? \'active\' : \'\'}`} onClick={() => setMobileTab(\'cart\')}>\n' +
  '          <span className="tabbar-icon"><Icon name="bag" />{lines.length > 0 && <span className="badge-count">{formatNumber(cartCount(lines))}</span>}</span><span>سبد خرید</span>\n' +
  '        </button>\n' +
  '        <button type="button" className={`tabbar-item ${mobileTab === \'profile\' ? \'active\' : \'\'}`} onClick={() => setMobileTab(\'profile\')}>\n' +
  '          <span className="tabbar-icon"><Icon name="user" /></span><span>{user ? \'حساب کاربری\' : \'ورود / عضویت\'}</span>\n' +
  '        </button>\n' +
  '      </nav>'
);

fs.writeFileSync(file, c);
console.log('Done modifying StorefrontPage.tsx');
