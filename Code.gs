const SPREADSHEET_ID = '1VjRRhxuLrr1HiEjLBNRrxXrZmk_pPjfu-s6xZY6bha4';
const SHEETS = {
  products: 'Products',
  categories: 'Categories',
  brands: 'Brands',
  colors: 'Colors',
  users: 'Users',
  orders: 'Orders',
  settings: 'Settings'
};

const DEFAULT_HEADERS = {
  Products: ['product_id', 'Category', 'Brand', 'title', 'model', 'color', 'color_en', 'color_code', 'sku', 'price', 'old_price', 'discount', 'stock', 'warranty', 'promotion', 'status', 'image_url', 'attribute_key', 'attribute_value'],
  Categories: ['category_name', 'category_fa_name', 'icon_url', 'Brand'],
  Brands: ['brand_name', 'brand_fa_name', 'icon_url'],
  Colors: ['color_code', 'color_fa_name', 'color_name'],
  Users: ['name', 'last_name', 'Store_name', 'phone_number', 'mobile_number', 'address', 'postal_code', 'certificate_file_url', 'actived'],
  Orders: ['order_id', 'date', 'customer_name', 'phone', 'address', 'items_json', 'total_price', 'status'],
  Settings: ['key', 'value']
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
    else if (a === 'orders') d = { ok: true, orders: read_(SHEETS.orders) };
    else if (a === 'users') d = { ok: true, users: read_(SHEETS.users) };
    else if (a === 'exportAll') d = exportAll_();
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
  sh.appendRow(h.map(x => x === 'actived' ? false : String(p[x] || '').trim()));
  return { ok: true, message: 'User registered', user: { name: p.name, last_name: p.last_name, mobile_number: m, actived: false } };
}

function createOrder_(p) {
  const sh = getSheet_(SHEETS.orders);
  const id = 'KP-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 1000);
  sh.appendRow([id, new Date(), p.customer_name || '', p.phone || '', p.address || '', JSON.stringify(p.items || []), Number(p.total || 0), 'new']);
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

function read_(n) {
  const v = getSheet_(n).getDataRange().getValues();
  if (v.length < 2) return [];
  const h = v[0].map(x => String(x).trim());
  return v.slice(1).filter(r => r.some(x => x !== '' && x !== null)).map(r => {
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
