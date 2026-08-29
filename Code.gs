
/**
 * Karplus Plus - Google Sheets API
 * Google Sheet: 1VjRRhxuLrr1HiEjLBNRrxXrZmk_pPjfu-s6xZY6bha4
 *
 * Deploy:
 *   Deploy > New deployment > Web app
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Then put the /exec URL into index.html as API_URL.
 */

const SPREADSHEET_ID = '1VjRRhxuLrr1HiEjLBNRrxXrZmk_pPjfu-s6xZY6bha4';
const SHEETS = {
  products: 'Products',
  categories: 'Categories',
  brands: 'Brands',
  colors: 'Colors',
  orders: 'Orders',
  settings: 'Settings'
};

function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  const action = p.action || 'products';
  let data;

  try {
    if (action === 'products') data = { ok: true, products: readSheetObjects_(SHEETS.products) };
    else if (action === 'categories') data = { ok: true, categories: readSheetObjects_(SHEETS.categories) };
    else if (action === 'brands') data = { ok: true, brands: readSheetObjects_(SHEETS.brands) };
    else if (action === 'colors') data = { ok: true, colors: readSheetObjects_(SHEETS.colors) };
    else if (action === 'catalog') data = getCatalog_();
    else if (action === 'settings') data = getSettings_();
    else data = { ok: false, error: 'Unknown action' };
  } catch (err) {
    data = { ok: false, error: String(err) };
  }

  // JSONP makes the public read endpoint usable by a static HTML page.
  const callback = (p.callback || '').replace(/[^\w.$]/g, '');
  const json = JSON.stringify(data);

  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = e && e.postData ? e.postData.contents : '';
    const payload = body ? JSON.parse(body) : {};
    if (payload.action === 'createOrder') return json_(createOrder_(payload));
    return json_({ ok:false, error:'Unknown action' });
  } catch (err) {
    return json_({ ok:false, error:String(err) });
  }
}

function getProducts_() {
  return { ok: true, products: readSheetObjects_(SHEETS.products) };
}

function getSettings_() {
  const values = getSheet_(SHEETS.settings).getDataRange().getValues();
  const settings = {};
  values.slice(1).forEach(r => { if (r[0] !== '') settings[String(r[0])] = r[1]; });
  return { ok: true, settings: settings };
}

function getCatalog_() {
  return {
    ok: true,
    products: readSheetObjects_(SHEETS.products),
    categories: readSheetObjects_(SHEETS.categories),
    brands: readSheetObjects_(SHEETS.brands),
    colors: readSheetObjects_(SHEETS.colors),
    settings: getSettings_().settings
  };
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function readSheetObjects_(name) {
  const values = getSheet_(name).getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(h => String(h).trim());
  return values.slice(1)
    .filter(row => row.some(v => v !== '' && v !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        let value = row[i];
        if (typeof value === 'string') value = value.trim();
        if (h === 'promotion') value = value === true || String(value).toUpperCase() === 'TRUE';
        obj[h] = value;
      });
      return obj;
    });
}

function createOrder_(payload) {
  const sheet = getSheet_(SHEETS.orders);

  const orderId = 'KP-' + Utilities.formatDate(
    new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss'
  ) + '-' + Math.floor(Math.random()*1000);

  sheet.appendRow([
    orderId,
    new Date(),
    payload.customer_name || '',
    payload.phone || '',
    payload.address || '',
    JSON.stringify(payload.items || []),
    Number(payload.total || 0),
    'new'
  ]);

  return { ok: true, order_id: orderId };
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
