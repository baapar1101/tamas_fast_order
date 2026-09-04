const SPREADSHEET_ID = '1VjRRhxuLrr1HiEjLBNRrxXrZmk_pPjfu-s6xZY6bha4';
const SHEETS = {
  products: 'Products',
  categories: 'Categories',
  brands: 'Brands',
  colors: 'Colors',
  users: 'Users',
  orders: 'Orders',
  settings: 'Settings',
  sessions: 'Sessions'
};

const DEFAULT_HEADERS = {
  Products: ['product_id', 'Category', 'Brand', 'title', 'model', 'color', 'color_en', 'color_code', 'sku', 'price', 'old_price', 'discount', 'stock', 'warranty', 'promotion', 'status', 'image_url', 'attribute_key', 'attribute_value'],
  Categories: ['category_name', 'category_fa_name', 'icon_url', 'Brand'],
  Brands: ['brand_name', 'brand_fa_name', 'icon_url'],
  Colors: ['color_code', 'color_fa_name', 'color_name'],
  Users: ['name', 'last_name', 'Store_name', 'phone_number', 'mobile_number', 'address', 'postal_code', 'certificate_file_url', 'activity', 'page_website', 'actived'],
  Orders: ['order_id', 'created_at', 'customer_name', 'phone', 'address', 'items_json', 'total', 'payment', 'status'],
  Settings: ['key', 'value'],
  Sessions: ['token', 'mobile_number', 'created_at', 'expires_at']
};

/* --- Authentication configuration ---
 * The OTP itself is sent and verified by the browser against
 * https://otp.eldery.ir; this script only issues the session that follows.
 * Apps Script has no network route to that host, so it must not proxy it. */
const SESSION_TTL_DAYS = 30;
const SESSION_MAX_PER_HOUR = 10;
/* Columns the user is allowed to fill in themselves (never 'mobile_number' or 'actived'). */
const PROFILE_FIELDS = ['name', 'last_name', 'Store_name', 'phone_number', 'address', 'postal_code', 'certificate_file_url', 'activity', 'page_website'];
/* Columns that must be filled before the profile counts as complete.
   `page_website` is deliberately not here: it speeds up approval but a
   shopkeeper with no page must still be able to register. Add it to require it. */
const REQUIRED_USER_FIELDS = ['name', 'last_name', 'Store_name', 'address', 'activity'];
/* Allowed values for the activity column, so the sheet stays consistent. */
const ACTIVITY_TYPES = ['آنلاین‌شاپ', 'مغازه‌دار', 'عمده‌فروش'];

/* Accepted payment methods. The client sends the key; the sheet gets the label
   so the Orders tab stays readable without a lookup. */
const PAYMENT_METHODS = {
  cash: 'نقدی (واریز به حساب)',
  credit: 'اعتباری هفتگی',
  cheque: 'چک صیادی'
};

function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  const a = p.action || 'catalog';
  let d;
  try {
    if (a === 'catalog') d = getCatalog_();
    else if (a === 'settings') d = getSettings_();
    else if (a === 'products') d = { ok: true, products: read_(SHEETS.products) };
    else if (a === 'categories') d = { ok: true, categories: read_(SHEETS.categories) };
    else if (a === 'brands') d = { ok: true, brands: read_(SHEETS.brands) };
    else if (a === 'colors') d = { ok: true, colors: read_(SHEETS.colors) };
    else if (a === 'orders') { requireAdmin_(p); d = { ok: true, orders: read_(SHEETS.orders) }; }
    else if (a === 'users') { requireAdmin_(p); d = { ok: true, users: read_(SHEETS.users) }; }
    else if (a === 'exportAll') { requireAdmin_(p); d = exportAll_(); }
    else d = { ok: false, error: 'Unknown action: ' + a };
  } catch (x) {
    d = { ok: false, error: String(x) };
  }
  return output_(d, p.callback);
}

function doPost(e) {
  try {
    const p = JSON.parse(e && e.postData ? e.postData.contents : '{}');
    const a = p.action || '';
    if (a === 'startSession') return json_(startSession_(p));
    if (a === 'getProfile') return json_(getProfile_(p));
    if (a === 'myOrders') return json_(myOrders_(p));
    if (a === 'saveProfile') return json_(saveProfile_(p));
    if (a === 'logout') return json_(logout_(p));
    if (a === 'registerUser') return json_(registerUser_(p));
    if (a === 'createOrder') return json_(createOrder_(p));
    if (a === 'syncCatalog') return json_(syncCatalog_(p));
    if (a === 'syncSheet') return json_(syncSheet_(p));
    if (a === 'updateStock') return json_(updateStock_(p));
    if (a === 'setupSheets') return json_(setupSheets_());
    return json_({ ok: false, error: 'Unknown action: ' + a });
  } catch (x) {
    return json_({ ok: false, error: String(x) });
  }
}

function getCatalog_() {
  setupSheets_();
  return {
    ok: true,
    products: read_(SHEETS.products),
    categories: read_(SHEETS.categories),
    brands: read_(SHEETS.brands),
    colors: read_(SHEETS.colors),
    settings: getSettings_().settings
  };
}

function exportAll_() {
  setupSheets_();
  return {
    ok: true,
    catalog: getCatalog_(),
    orders: read_(SHEETS.orders),
    users: read_(SHEETS.users)
  };
}

function getSettings_() {
  const sh = getSheet_(SHEETS.settings);
  const v = sh.getDataRange().getValues();
  const s = {};
  if (v.length > 1) {
    v.slice(1).forEach(r => {
      if (r[0] !== '' && r[0] !== null) s[String(r[0])] = r[1];
    });
  }
  return { ok: true, settings: s };
}

function syncCatalog_(p) {
  const catalog = p.catalog || p;
  const results = {};
  
  if (Array.isArray(catalog.categories)) {
    results.categories = writeSheetObjects_(SHEETS.categories, DEFAULT_HEADERS.Categories, catalog.categories);
  }
  if (Array.isArray(catalog.brands)) {
    results.brands = writeSheetObjects_(SHEETS.brands, DEFAULT_HEADERS.Brands, catalog.brands);
  }
  if (Array.isArray(catalog.colors)) {
    results.colors = writeSheetObjects_(SHEETS.colors, DEFAULT_HEADERS.Colors, catalog.colors);
  }
  if (Array.isArray(catalog.products)) {
    results.products = writeSheetObjects_(SHEETS.products, DEFAULT_HEADERS.Products, catalog.products);
  }
  if (catalog.settings && typeof catalog.settings === 'object') {
    const settingsArr = Object.entries(catalog.settings).map(([k, v]) => ({ key: k, value: v }));
    results.settings = writeSheetObjects_(SHEETS.settings, DEFAULT_HEADERS.Settings, settingsArr);
  }
  
  return { ok: true, message: 'Catalog synchronized successfully', details: results };
}

function syncSheet_(p) {
  const sheetName = p.sheetName;
  const rows = p.rows || [];
  const headers = p.headers || DEFAULT_HEADERS[sheetName];
  if (!sheetName) throw Error('sheetName is required');
  const count = writeSheetObjects_(sheetName, headers, rows);
  return { ok: true, message: `Sheet '${sheetName}' synchronized successfully`, count: count };
}

function updateStock_(p) {
  const updates = p.items || [];
  if (!Array.isArray(updates) || !updates.length) throw Error('items array is required');
  const sh = getSheet_(SHEETS.products);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { ok: true, updated: 0 };
  
  const headers = data[0].map(x => String(x).trim());
  const idIdx = headers.indexOf('product_id');
  const skuIdx = headers.indexOf('sku');
  const stockIdx = headers.indexOf('stock');
  
  if (stockIdx < 0) throw Error('stock column not found');
  let count = 0;
  
  updates.forEach(u => {
    const targetId = String(u.product_id || '').trim();
    const targetSku = String(u.sku || '').trim();
    for (let r = 1; r < data.length; r++) {
      const rowId = idIdx >= 0 ? String(data[r][idIdx] || '').trim() : '';
      const rowSku = skuIdx >= 0 ? String(data[r][skuIdx] || '').trim() : '';
      if ((targetId && rowId === targetId) || (targetSku && rowSku === targetSku)) {
        sh.cell(r + 1, stockIdx + 1).setValue(Number(u.stock));
        count++;
      }
    }
  });
  
  return { ok: true, updated: count };
}

function setupSheets_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.keys(DEFAULT_HEADERS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.appendRow(DEFAULT_HEADERS[name]);
      sh.getRange(1, 1, 1, DEFAULT_HEADERS[name].length).setFontWeight('bold');
    }
  });
  return { ok: true, message: 'All required sheets exist' };
}

/* ============================== AUTHENTICATION ==============================
 * The page sends and verifies the OTP directly against https://otp.eldery.ir
 * (this script has no network route to that host). Once the browser has a
 * `verified: true` response it calls startSession, which issues the token that
 * every later profile read/write is keyed to — a client can only ever reach
 * the row for the phone number stored with its own token.
 * ========================================================================== */

function startSession_(p) {
  const phone = normalizePhone_(p.phone);
  if (!isValidPhone_(phone)) return { ok: false, error: 'شماره موبایل معتبر نیست.' };

  /* The OTP check happened in the browser, so this call is only as trustworthy
   * as the client making it. Cap how fast one number can mint sessions. */
  const cache = CacheService.getScriptCache();
  const countKey = 'session_count_' + phone;
  const started = Number(cache.get(countKey) || 0);
  if (started >= SESSION_MAX_PER_HOUR) {
    return { ok: false, error: 'تعداد ورود بیش از حد مجاز است. یک ساعت دیگر تلاش کنید.' };
  }
  cache.put(countKey, String(started + 1), 3600);

  const payload = profilePayload_(phone);
  payload.ok = true;
  payload.token = createSession_(phone);
  payload.message = payload.isNew ? 'ثبت نام انجام شد. لطفاً اطلاعات خود را تکمیل کنید.' : 'با موفقیت وارد شدید.';
  return payload;
}

function getProfile_(p) {
  const s = getSession_(p.token);
  if (!s) return { ok: false, error: 'نشست شما منقضی شده است. دوباره وارد شوید.', expired: true };
  const payload = profilePayload_(s.phone);
  payload.ok = true;
  return payload;
}

function saveProfile_(p) {
  const s = getSession_(p.token);
  if (!s) return { ok: false, error: 'نشست شما منقضی شده است. دوباره وارد شوید.', expired: true };

  const values = {};
  PROFILE_FIELDS.forEach(f => { values[f] = String(p[f] == null ? '' : p[f]).trim(); });
  if (values.phone_number) values.phone_number = toAsciiDigits_(values.phone_number);
  if (values.postal_code) values.postal_code = toAsciiDigits_(values.postal_code).replace(/\D/g, '');
  /* Only the offered activity types are accepted; anything else is discarded
     so the column stays reportable. */
  if (values.activity && ACTIVITY_TYPES.indexOf(values.activity) < 0) values.activity = '';
  if (values.page_website) values.page_website = values.page_website.slice(0, 300);

  const missing = REQUIRED_USER_FIELDS.filter(f => !String(values[f] || '').trim());
  if (missing.length) {
    return {
      ok: false,
      complete: false,
      missing: missing,
      error: 'لطفاً فیلدهای الزامی را تکمیل کنید: ' + missing.map(fieldLabel_).join('، ')
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_(SHEETS.users);
    const found = findUserRow_(sh, s.phone);
    const h = found.headers;

    let row;
    if (found.row) {
      const updated = found.values.slice();
      h.forEach((col, i) => { if (values.hasOwnProperty(col)) updated[i] = values[col]; });
      sh.getRange(found.row, 1, 1, h.length).setValues([updated]);
      row = found.row;
    } else {
      row = writeRow_(sh, h.map(col => {
        if (col === 'mobile_number') return s.phone;
        if (col === 'actived') return false;
        return values.hasOwnProperty(col) ? values[col] : '';
      }));
    }
    /* Keep the leading zero: without a text format Sheets stores 09... as the
       number 9... and the zero is lost on the way back out. */
    forceTextCells_(sh, h, row, ['mobile_number', 'phone_number', 'postal_code']);
  } finally {
    lock.releaseLock();
  }

  const payload = profilePayload_(s.phone);
  payload.ok = true;
  payload.message = 'اطلاعات شما ذخیره شد.';
  return payload;
}

/* Builds the single `payment` cell: chosen method plus, for a direct deposit,
   whatever receipt reference the buyer supplied. */
function paymentCell_(p) {
  const label = PAYMENT_METHODS[String(p.payment_method || '').trim()] || PAYMENT_METHODS.cash;
  const ref = toAsciiDigits_(p.payment_ref || '').replace(/[^\w-]/g, '').slice(0, 40);
  const link = String(p.payment_link || '').trim().slice(0, 300);
  const parts = [label];
  if (ref) parts.push('کد پیگیری: ' + ref);
  if (/^https?:\/\//i.test(link)) parts.push('رسید: ' + link);
  return parts.join(' | ');
}

/* Order history for the signed-in caller only: rows are matched against the
   phone number stored with the token, never one supplied by the client. */
function myOrders_(p) {
  const s = getSession_(p.token);
  if (!s) return { ok: false, error: 'نشست شما منقضی شده است. دوباره وارد شوید.', expired: true };

  const sh = getSheet_(SHEETS.orders);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { ok: true, orders: [] };

  const h = data[0].map(x => String(x).trim());
  const iPhone = h.indexOf('phone');
  if (iPhone < 0) throw Error('Orders header not found: phone');
  const at = k => h.indexOf(k);
  const val = (row, k) => { const i = at(k); return i < 0 ? '' : row[i]; };

  const rows = [];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (isBlankRow_(row)) continue;
    if (normalizePhone_(row[iPhone]) !== s.phone) continue;

    let items = [];
    try { items = JSON.parse(val(row, 'items_json') || '[]') || []; } catch (x) { items = []; }
    if (!Array.isArray(items)) items = [];

    /* Column names differ between older and current sheets, so accept both. */
    const d = val(row, 'created_at') || val(row, 'date');
    const stamp = d instanceof Date ? d.getTime() : (Date.parse(d) || 0);
    rows.push({
      stamp: stamp,
      order_id: String(val(row, 'order_id') || ''),
      date: d instanceof Date ? d.toISOString() : String(d || ''),
      address: String(val(row, 'address') || ''),
      total_price: Number(val(row, 'total') || val(row, 'total_price') || 0),
      payment: String(val(row, 'payment') || '').trim(),
      status: String(val(row, 'status') || '').trim(),
      items: items
    });
  }

  rows.sort((a, b) => b.stamp - a.stamp);
  return { ok: true, orders: rows.slice(0, 50).map(o => { delete o.stamp; return o; }) };
}

function logout_(p) {
  const s = getSession_(p.token);
  if (s) getSheet_(SHEETS.sessions).deleteRow(s.row);
  return { ok: true, message: 'از حساب خود خارج شدید.' };
}

/* --- profile helpers --- */

function profilePayload_(phone) {
  const sh = getSheet_(SHEETS.users);
  const found = findUserRow_(sh, phone);
  const user = found.row ? userObject_(found.headers, found.values, phone) : emptyUser_(phone);
  const missing = REQUIRED_USER_FIELDS.filter(f => !String(user[f] || '').trim());
  return {
    isNew: !found.row,
    user: user,
    complete: !missing.length,
    missing: missing,
    requiredFields: REQUIRED_USER_FIELDS,
    profileFields: PROFILE_FIELDS
  };
}

function findUserRow_(sh, phone) {
  const data = sh.getDataRange().getValues();
  const h = (data[0] || []).map(x => String(x).trim());
  const mi = h.indexOf('mobile_number');
  if (mi < 0) throw Error('Users header not found: mobile_number');
  for (let r = 1; r < data.length; r++) {
    if (normalizePhone_(data[r][mi]) === phone) return { row: r + 1, headers: h, values: data[r] };
  }
  return { row: 0, headers: h, values: null };
}

function userObject_(headers, values, phone) {
  const o = {};
  headers.forEach((k, i) => {
    let v = values[i];
    if (k === 'actived') v = v === true || String(v).toUpperCase() === 'TRUE';
    else v = typeof v === 'string' ? v.trim() : (v === null || v === undefined ? '' : String(v).trim());
    o[k] = v;
  });
  o.mobile_number = phone;
  return o;
}

function emptyUser_(phone) {
  const o = {};
  DEFAULT_HEADERS.Users.forEach(k => { o[k] = k === 'actived' ? false : ''; });
  o.mobile_number = phone;
  return o;
}

function fieldLabel_(f) {
  const labels = {
    name: 'نام',
    last_name: 'نام خانوادگی',
    Store_name: 'نام فروشگاه',
    phone_number: 'تلفن ثابت',
    address: 'آدرس',
    postal_code: 'کد پستی',
    certificate_file_url: 'لینک جواز کسب',
    activity: 'نوع فعالیت',
    page_website: 'صفحه اینستاگرام یا وب‌سایت'
  };
  return labels[f] || f;
}

/* --- sessions --- */

function createSession_(phone) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_(SHEETS.sessions);
    pruneSessions_(sh);
    const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    const now = new Date();
    const row = writeRow_(sh, [token, phone, now, new Date(now.getTime() + SESSION_TTL_DAYS * 86400000)]);
    forceTextCells_(sh, headers_(sh), row, ['mobile_number']);
    return token;
  } finally {
    lock.releaseLock();
  }
}

function getSession_(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  const sh = getSheet_(SHEETS.sessions);
  const data = sh.getDataRange().getValues();
  const h = (data[0] || []).map(x => String(x).trim());
  const ti = h.indexOf('token'), mi = h.indexOf('mobile_number'), ei = h.indexOf('expires_at');
  if (ti < 0 || mi < 0 || ei < 0) return null;
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][ti] || '').trim() !== t) continue;
    const exp = data[r][ei] instanceof Date ? data[r][ei] : new Date(data[r][ei]);
    if (!exp || isNaN(exp.getTime()) || exp.getTime() < Date.now()) {
      sh.deleteRow(r + 1);
      return null;
    }
    return { row: r + 1, phone: normalizePhone_(data[r][mi]) };
  }
  return null;
}

function pruneSessions_(sh) {
  const data = sh.getDataRange().getValues();
  const h = (data[0] || []).map(x => String(x).trim());
  const ei = h.indexOf('expires_at');
  if (ei < 0) return;
  const now = Date.now();
  for (let r = data.length - 1; r >= 1; r--) {
    const exp = data[r][ei] instanceof Date ? data[r][ei] : new Date(data[r][ei]);
    if (!exp || isNaN(exp.getTime()) || exp.getTime() < now) sh.deleteRow(r + 1);
  }
}

/* --- phone numbers --- */

function toAsciiDigits_(v) {
  return String(v == null ? '' : v)
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660));
}

function normalizePhone_(v) {
  let s = toAsciiDigits_(v).replace(/\D/g, '');
  if (s.indexOf('0098') === 0) s = s.slice(4);
  else if (s.length === 12 && s.indexOf('98') === 0) s = s.slice(2);
  if (s.length === 10 && s.charAt(0) === '9') s = '0' + s;
  return s;
}

function isValidPhone_(s) {
  return /^09\d{9}$/.test(s);
}

/* --- admin gate for the endpoints that expose personal data ---
 * Set an `admin_key` row in the Settings sheet to lock down
 * ?action=users / orders / exportAll. Left open when unset. */
function requireAdmin_(p) {
  const key = String(getSettings_().settings.admin_key || '').trim();
  if (!key) return;
  if (String((p && p.key) || '').trim() !== key) throw Error('Unauthorized');
}

function registerUser_(p) {
  const sh = getSheet_(SHEETS.users);
  const h = headers_(sh);
  const need = ['name', 'last_name', 'Store_name', 'phone_number', 'mobile_number', 'address', 'postal_code', 'certificate_file_url', 'actived'];
  need.forEach(x => {
    if (h.indexOf(x) < 0) throw Error('Users header not found: ' + x);
  });
  const m = String(p.mobile_number || '').trim();
  if (!p.name || !p.last_name || !m) throw Error('name, last_name and mobile_number are required');
  const mi = h.indexOf('mobile_number');
  if (sh.getDataRange().getValues().slice(1).some(r => String(r[mi] || '').trim() === m)) {
    return { ok: false, error: 'این شماره موبایل قبلاً ثبت شده است.' };
  }
  const row = writeRow_(sh, h.map(x => x === 'actived' ? false : String(p[x] || '').trim()));
  forceTextCells_(sh, h, row, ['mobile_number', 'phone_number', 'postal_code']);
  return { ok: true, message: 'User registered', user: { name: p.name, last_name: p.last_name, mobile_number: m, actived: false } };
}

function createOrder_(p) {
  /* When a session token is supplied, the verified phone number and the saved
   * profile win over whatever the client typed into the checkout form. */
  const s = getSession_(p.token);
  let name = String(p.customer_name || '').trim();
  let phone = String(p.phone || '').trim();
  let address = String(p.address || '').trim();

  if (s) {
    const status = profilePayload_(s.phone);
    if (!status.complete) {
      return {
        ok: false,
        complete: false,
        missing: status.missing,
        error: 'برای ثبت سفارش ابتدا اطلاعات حساب خود را تکمیل کنید: ' + status.missing.map(fieldLabel_).join('، ')
      };
    }
    const u = status.user;
    phone = s.phone;
    name = [u.name, u.last_name].filter(Boolean).join(' ') + (u.Store_name ? ' (' + u.Store_name + ')' : '');
    address = address || u.address;
  }

  if (!name || !phone) return { ok: false, error: 'نام و شماره موبایل الزامی است.' };

  const sh = getSheet_(SHEETS.orders);
  const h = headers_(sh);
  const id = 'KP-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 1000);
  const now = new Date();

  /* Written by header name, not by position: the Orders tab has gained columns
     (payment) and renamed others (date→created_at, total_price→total), and a
     positional write would silently shift every value one column across. */
  const record = {
    order_id: id,
    created_at: now,
    date: now,
    customer_name: name,
    phone: phone,
    address: address,
    items_json: JSON.stringify(p.items || []),
    total: Number(p.total || 0),
    total_price: Number(p.total || 0),
    payment: paymentCell_(p),
    status: 'new'
  };

  const row = writeRow_(sh, h.map(col => record.hasOwnProperty(col) ? record[col] : ''));
  forceTextCells_(sh, h, row, ['phone']);
  return { ok: true, order_id: id };
}

function getSheet_(n) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let s = ss.getSheetByName(n);
  if (!s) {
    if (DEFAULT_HEADERS[n]) {
      s = ss.insertSheet(n);
      s.appendRow(DEFAULT_HEADERS[n]);
    } else {
      throw Error('Sheet not found: ' + n);
    }
  }
  return s;
}

function headers_(s) {
  return s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(x => String(x).trim());
}

/* A row holding nothing but unticked checkboxes still counts as empty. The
   Users sheet is a Sheets Table whose blank rows already carry `actived`
   = FALSE, and without this they read back as phantom users. */
function isBlankRow_(values) {
  return !values.some(x => x !== '' && x !== null && x !== undefined && x !== false);
}

/* Fills the first blank row inside the used range instead of appending after
   it. appendRow() would jump past a Table's pre-made empty rows and drop the
   record outside the Table. Returns the row number written. */
function writeRow_(sh, values) {
  const data = sh.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (isBlankRow_(data[r])) {
      sh.getRange(r + 1, 1, 1, values.length).setValues([values]);
      return r + 1;
    }
  }
  sh.appendRow(values);
  return sh.getLastRow();
}

/* Re-applies the plain-text format to columns that must keep a leading zero. */
function forceTextCells_(sh, headers, row, cols) {
  cols.forEach(col => {
    const i = headers.indexOf(col);
    if (i < 0) return;
    const cell = sh.getRange(row, i + 1);
    const v = cell.getValue();
    cell.setNumberFormat('@');
    if (v !== '' && v !== null) cell.setValue(String(v));
  });
}

function read_(n) {
  const v = getSheet_(n).getDataRange().getValues();
  if (v.length < 2) return [];
  const h = v[0].map(x => String(x).trim());
  return v.slice(1).filter(r => !isBlankRow_(r)).map(r => {
    const o = {};
    h.forEach((k, i) => {
      let x = r[i];
      if (k === 'promotion' || k === 'actived') x = x === true || String(x).toUpperCase() === 'TRUE';
      o[k] = typeof x === 'string' ? x.trim() : x;
    });
    return o;
  });
}

function writeSheetObjects_(name, headers, rows) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  sh.clearContents();
  
  if (!headers || !headers.length) {
    if (rows.length > 0 && typeof rows[0] === 'object') {
      headers = Object.keys(rows[0]);
    } else {
      headers = DEFAULT_HEADERS[name] || ['id'];
    }
  }
  
  const values = [headers];
  rows.forEach(item => {
    if (Array.isArray(item)) {
      values.push(item);
    } else {
      const r = headers.map(h => {
        const val = item[h];
        return val !== undefined && val !== null ? val : '';
      });
      values.push(r);
    }
  });
  
  sh.getRange(1, 1, values.length, headers.length).setValues(values);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  return rows.length;
}

function output_(o, c) {
  if (c) return ContentService.createTextOutput(String(c).replace(/[^\w.$]/g, '') + '(' + JSON.stringify(o) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return json_(o);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
