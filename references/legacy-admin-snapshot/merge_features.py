import re
import json
import os

source_path = r"D:\tamas_fast_order\.claude\worktrees\otp-auth-google-sheets-be809d\index.html"
source_css_path = r"D:\tamas_fast_order\.claude\worktrees\otp-auth-google-sheets-be809d\style.css"
target_path = r"D:\tamas_fast_order\index.html"

with open(source_path, 'r', encoding='utf-8') as f:
    src_html = f.read()

with open(source_css_path, 'r', encoding='utf-8') as f:
    src_css = f.read()

with open(target_path, 'r', encoding='utf-8') as f:
    tgt_html = f.read()

# 1. Extract CSS
# We need to extract specific CSS from style.css
# - variant-info, warranty-text, sell-badges-col, color-title, price, current-price, warehouse-section, warehouse-row, wh-details, wh-badge, wh-count, stock-warn, add-wh-btn
# - .product.is-promotion, .promo-star-tag, .title-star
# - .sell-badge, .cash, .credit, .cheque, .default
# - .auth-box, .auth-close, .auth-step, .auth-hint, .ltr-field, .otp-field, .auth-msg, .auth-phone-chip, .link-btn, .account-card, .account-status, .account-row

css_to_add = """
/* ---- Added Features CSS ---- */
.variant-info { display: flex; flex-direction: column; gap: 5px; flex: 1 1 auto; min-width: 200px; }
.warranty-text { font-size: 12px; color: #64748b; font-weight: 500; }
.sell-badges-col { display: flex; flex-direction: column; gap: 5px; align-items: flex-start; margin-top: 4px; }
.color-title { font-weight: 700; font-size: 15px; display: flex; align-items: center; }
.warehouse-section { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; margin-right: auto; margin-left: 0; }
.warehouse-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #ffffff; border: 1px solid #dce5ec; border-radius: 8px; padding: 4px 10px; }
.warehouse-row.urgent-stock { border-color: #f87171; background: #fff5f5; }
.wh-details { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.wh-badge { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 6px; white-space: nowrap; }
.wh-badge.kerman { background: #e0f2fe; color: #0369a1; }
.wh-badge.tehran { background: #f0fdf4; color: #15803d; }
.wh-count { color: #64748b; font-size: 12px; white-space: nowrap; }
.stock-warn { color: #dc2626; font-weight: 800; }
.add-wh-btn { width: 32px; height: 32px; border-radius: 50%; border: 1px solid #00768f; background: #00768f; color: #ffffff; font-size: 20px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.2s ease, background 0.2s ease; flex-shrink: 0; }
.add-wh-btn:hover { background: #005a6e; transform: scale(1.1); }
.product-accordion.is-promotion, .product-card.is-promotion { border: 2px solid #ef4444; background: linear-gradient(180deg, #fff7f7 0%, #ffffff 100%); box-shadow: 0 8px 24px rgba(239, 68, 68, 0.22); position: relative; }
.promo-star-tag { position: absolute; top: -12px; right: 18px; background: linear-gradient(135deg, #dc2626, #ef4444); color: #ffffff; font-weight: 800; font-size: 12px; padding: 3px 12px; border-radius: 20px; display: flex; align-items: center; gap: 5px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4); z-index: 5; }
.title-star { color: #dc2626; font-size: 18px; margin-left: 6px; display: inline-block; }
.sell-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 6px; white-space: nowrap; }
.sell-badge.cash { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
.sell-badge.credit { background: #ffedd5; color: #c2410c; border: 1px solid #fed7aa; }
.sell-badge.cheque { background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff; }
.sell-badge.default { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.product-thumb:hover, .card-thumb:hover { transform: scale(1.6); z-index: 9999; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.32); border-color: #00768f; background: #ffffff; position: relative; }

/* Auth Modal CSS */
.auth-box { position: relative; max-width: 460px; }
.auth-box h3 { margin: 0 0 8px; }
.auth-close { position: absolute; top: 12px; left: 14px; width: 32px; height: 32px; border: 0; background: transparent; font-size: 26px; line-height: 1; color: #999; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.auth-hint { font-size: 13px; color: #666; margin-bottom: 20px; line-height: 1.6; }
.ltr-field { direction: ltr !important; text-align: left !important; font-family: Tahoma, sans-serif !important; letter-spacing: 2px; font-size: 16px !important; }
.otp-field { text-align: center !important; letter-spacing: 12px; font-size: 24px !important; font-weight: bold; }
.auth-msg { font-size: 12.5px; min-height: 18px; margin: 8px 0 12px; color: #666; }
.auth-msg.error { color: #dc2626; }
.auth-msg.ok { color: #16a34a; }
.link-btn { background: none; border: 0; color: #00768f; font-size: 12px; cursor: pointer; text-decoration: underline; padding: 0; }
.ltr-inline { direction: ltr; display: inline-block; }
.auth-phone-chip { background: #e0f2fe; color: #0369a1; padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 700; margin-bottom: 15px; display: inline-block; }
.account-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; margin-bottom: 20px; }
.account-status { font-weight: 700; font-size: 13px; margin-bottom: 15px; display: flex; align-items: center; gap: 6px; }
.account-status.active { color: #15803d; }
.account-status.pending { color: #c2410c; }
.account-row { display: flex; justify-content: space-between; font-size: 13px; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; }
.account-row:last-child { border: 0; }
.account-row span { color: #64748b; }
.account-row b { color: #1e293b; }
.profile-notice { background: #fff3cd; color: #856404; padding: 12px; border: 1px solid #ffeeba; border-radius: 8px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
"""

tgt_html = tgt_html.replace("/* Footer */", css_to_add + "\n/* Footer */")

# 2. Extract Auth Modal HTML and Profile Notice
# It's between `<div class="modal" id="authModal">` and `  <div class="modal" id="checkoutModal">` (we don't need checkoutModal)
auth_modal_match = re.search(r'<div class="modal" id="authModal">.*?</div>\s+</div>', src_html, re.DOTALL)
if auth_modal_match:
    auth_modal_html = auth_modal_match.group(0)
    tgt_html = tgt_html.replace("<!-- Print Invoice Modal -->", auth_modal_html + "\n\n<!-- Print Invoice Modal -->")

# Extract profile notice and put it after header
profile_notice_match = re.search(r'<div class="profile-notice" id="profileNotice" hidden>.*?</div>', src_html, re.DOTALL)
if profile_notice_match:
    profile_notice_html = profile_notice_match.group(0)
    tgt_html = tgt_html.replace("</header>", "</header>\n" + profile_notice_html)

# Update userBtn in header to trigger auth modal
tgt_html = tgt_html.replace('<button class="btn" onclick="openLogin()">ورود / ثبت‌نام</button>', '<button class="btn" id="authBtn" onclick="openAuth()">ورود / ثبت‌نام</button>')
tgt_html = tgt_html.replace('<button class="btn" id="userBtn" onclick="openLogin()">ورود / ثبت‌نام</button>', '<button class="btn" id="authBtn" onclick="openAuth()">ورود / ثبت‌نام</button>')


# 3. Extract JS Functions
js_functions = """
/* ---- Added Features JS ---- */
const OTP_BASE_URL = "https://otp.eldery.ir";

function getWarehouseStocks(p) {
  const kerman = Math.max(0, parseInt(p.kerman_stock || 0, 10));
  const tehran = Math.max(0, parseInt(p.tehran_stock || 0, 10));
  if (kerman > 0 || tehran > 0) return { kerman, tehran, total: kerman + tehran };
  const globalStock = Math.max(0, parseInt(p.stock !== undefined && p.stock !== '' ? p.stock : 1, 10));
  return { kerman: globalStock, tehran: 0, total: globalStock };
}
function getProductStock(p) { return getWarehouseStocks(p).total; }

function renderSellTypeBadges(sellTypeStr) {
  if (!sellTypeStr || !String(sellTypeStr).trim()) return '';
  const types = String(sellTypeStr).split(/[,،;]+/).map(s => s.trim()).filter(Boolean);
  const badgesHTML = types.map(t => {
    if (t.includes('نقد')) return `<span class="sell-badge cash" title="فروش نقدی">💵 ${esc(t)}</span>`;
    if (t.includes('اعتبار')) return `<span class="sell-badge credit" title="فروش اعتباری">💳 ${esc(t)}</span>`;
    if (t.includes('چک')) return `<span class="sell-badge cheque" title="فروش چکی">📄 ${esc(t)}</span>`;
    return `<span class="sell-badge default">🏷️ ${esc(t)}</span>`;
  }).join('');
  return `<div class="sell-badges-col">${badgesHTML}</div>`;
}

// Override getColorHex to be more robust from source
function getColorHex(p) {
  if (!p) return '#00768f';
  let directCode = p.color_code || p.color_hex || p.hex;
  if (directCode && String(directCode).trim()) {
    let c = String(directCode).trim();
    if (!c.startsWith('#') && /^[0-9A-Fa-f]{3,8}$/.test(c)) c = '#' + c;
    return c;
  }
  let rawColor = String(p.color || p.color_en || '').trim();
  if (!rawColor && p.title) {
    const match = p.title.match(/رنگ\s+([^\\s]+)/);
    if (match) rawColor = match[1];
  }
  const colorMap = [
    { keys: ['سفید طلایی'], hex: '#f5e050' }, { keys: ['سفید', 'white', 'صدفی', 'شفاف', 'clear'], hex: '#ffffff' },
    { keys: ['مشکی', 'black', 'دودی'], hex: '#000000' }, { keys: ['سرمه‌ای', 'deep blue', 'navy'], hex: '#12273b' },
    { keys: ['آبی', 'blue', 'cyan'], hex: '#0000ff' }, { keys: ['یاسی', 'lilac', 'lavender'], hex: '#c8a2c8' },
    { keys: ['خاکستری', 'طوسی', 'توسی', 'gray', 'grey'], hex: '#808080' }, { keys: ['نارنجی', 'orange'], hex: '#ffa500' },
    { keys: ['سبز', 'green'], hex: '#008000' }, { keys: ['قرمز', 'red'], hex: '#ff0000' },
    { keys: ['طلایی', 'gold'], hex: '#ffd700' }, { keys: ['روز گلد', 'rose gold'], hex: '#b76e79' },
    { keys: ['نقره ای', 'silver'], hex: '#c0c0c0' }, { keys: ['بنفش', 'purple'], hex: '#800080' },
    { keys: ['زرد', 'yellow'], hex: '#ffff00' }, { keys: ['صورتی', 'pink'], hex: '#ffc0cb' },
    { keys: ['کرم', 'cream'], hex: '#fffdd0' }, { keys: ['قهوه‌ای', 'brown'], hex: '#795548' }
  ];
  for (const item of colorMap) {
    if (item.keys.some(k => rawColor.includes(k))) return item.hex;
  }
  return '#00768f';
}

"""

# Extract OTP javascript from src_html
otp_js_match = re.search(r'/\* ======================= OTP LOGIN / REGISTRATION =======================.*?restoreAuth\(\);\s*', src_html, re.DOTALL)
if otp_js_match:
    otp_js = otp_js_match.group(0)
    # We need to remove submitOrder and openModal/closeModal overrides if any, but it's mostly OTP
    # We will inject it after API_URL definition
    js_functions += "\n" + otp_js


# Inject JS before loadFavorites
tgt_html = tgt_html.replace('// Favorites management', js_functions + '\n\n// Favorites management')


# 4. Modify render function in tgt_html
# Replace `Number(p.stock)` with `getProductStock(p)`
tgt_html = tgt_html.replace('Number(p.stock) > 0', 'getProductStock(p) > 0')

# Update grid view variant
grid_replacement = """
    container.className = 'products-grid';
    container.innerHTML = list.map(p => {
      const isFav = favorites.includes(p.product_id);
      const isPromo = p.promotion === true || String(p.promotion).toUpperCase() === 'TRUE';
      return `
        <article class="product-card ${isPromo ? 'is-promotion' : ''}">
          ${isPromo ? '<div class="promo-star-tag"><span class="star-icon">⭐</span> پیشنهاد ویژه</div>' : ''}
          ${p.discount ? `<span class="card-badge">${p.discount}٪ تخفیف</span>` : ''}
          <button class="card-fav-btn ${isFav?'active':''}" onclick="toggleFav('${p.product_id}')">
            ${isFav?'❤️':'🤍'}
          </button>
          <img class="card-thumb" src="${esc(p.image_url||'')}" alt="${esc(p.title)}" onerror="this.src='logo.png'" onclick="openImageZoom('${esc(p.image_url||'')}')" style="cursor: zoom-in;">
          <div>
            <div class="card-title">${isPromo ? '<span class="title-star">⭐</span>' : ''}${esc(p.title)}</div>
            <div class="card-meta">
              <span>برند: <b>${esc(p.brand||'متفرقه')}</b></span>
              <span>رنگ: ${esc(p.color||'-')}</span>
            </div>
            ${renderSellTypeBadges(p.sell_type)}
          </div>
          <div class="card-price-box">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <div>
                ${p.old_price ? `<span class="card-old-price">${money(p.old_price)}</span>` : ''}
                <div class="card-price">${money(p.price)}</div>
              </div>
              <button class="btn primary" onclick='addToCart(${JSON.stringify(p).replace(/'/g,"&#39;")}, "kerman")'>
                + خرید
              </button>
            </div>
            <button class="btn" style="width:100%;font-size:11.5px;padding:5px;" onclick='openQuickView(${JSON.stringify(p).replace(/'/g,"&#39;")})'>
              👁 مشاهده جزئیات
            </button>
          </div>
        </article>
      `;
    }).join('');
"""
# Need to precisely replace the grid loop
tgt_html = re.sub(r"container\.className = 'products-grid';.*?\}\)\.join\(''\);", grid_replacement.strip().replace('\\', '\\\\'), tgt_html, flags=re.DOTALL)


list_replacement = """
    container.className = 'products-list';
    const groups = {};
    list.forEach(p => { const k = p.model || p.title; (groups[k] ??= []).push(p); });

    container.innerHTML = Object.entries(groups).map(([title, items]) => {
      const isPromoGroup = items.some(p => p.promotion === true || String(p.promotion).toUpperCase() === 'TRUE');
      return `
      <article class="product-accordion ${isPromoGroup ? 'is-promotion' : ''}">
        ${isPromoGroup ? '<div class="promo-star-tag"><span class="star-icon">⭐</span> پیشنهاد ویژه</div>' : ''}
        <div class="product-head">
          <div class="product-title">${isPromoGroup ? '<span class="title-star">⭐</span>' : ''}${esc(title)}</div>
          <img class="product-thumb" src="${esc(items[0].image_url||'')}" alt="" onerror="this.src='logo.png'" onclick="openImageZoom('${esc(items[0].image_url||'')}')" style="cursor: zoom-in;">
        </div>
        <div class="variant-head">رنگ‌بندی و لیست قیمت عمده</div>
        ${items.map(p => {
          const stocks = getWarehouseStocks(p);
          const warehouseBtns = [];
          const jsonStr = JSON.stringify(p).replace(/'/g,"&#39;");
          if (stocks.kerman > 0) warehouseBtns.push(`<div class="warehouse-row ${stocks.kerman===1?'urgent-stock':''}"><div class="wh-details"><span class="wh-badge kerman">انبار کرمان</span>${stocks.kerman===1?'<span class="wh-count"><b class="stock-warn">تنها ۱ عدد</b></span>':''}</div><button class="add-wh-btn" onclick='addToCart(${jsonStr}, "kerman")'>+</button></div>`);
          if (stocks.tehran > 0) warehouseBtns.push(`<div class="warehouse-row ${stocks.tehran===1?'urgent-stock':''}"><div class="wh-details"><span class="wh-badge tehran">انبار تهران</span>${stocks.tehran===1?'<span class="wh-count"><b class="stock-warn">تنها ۱ عدد</b></span>':''}</div><button class="add-wh-btn" onclick='addToCart(${jsonStr}, "tehran")'>+</button></div>`);
          if (!warehouseBtns.length && stocks.total > 0) warehouseBtns.push(`<div class="warehouse-row"><div class="wh-details"><span class="wh-badge kerman">موجودی سایت</span></div><button class="add-wh-btn" onclick='addToCart(${jsonStr}, "kerman")'>+</button></div>`);
          
          return `
          <div class="variant">
            <div class="variant-info">
              <div class="color-title"><span class="color-dot" style="background:${getColorHex(p)}"></span>${esc(p.color||'مشکی')}</div>
              <div class="warranty-text">♧ ${esc(p.warranty||'شرکتی')}</div>
              ${renderSellTypeBadges(p.sell_type)}
            </div>
            <div style="text-align:left; margin-left: auto;">
              ${p.old_price ? `<span class="card-old-price">${money(p.old_price)}</span>` : ''}
              <div class="card-price">${money(p.price)}</div>
            </div>
            <div class="warehouse-section">
              ${warehouseBtns.join('')}
            </div>
          </div>
        `}).join('')}
      </article>
      `;
    }).join('');
"""
tgt_html = re.sub(r"container\.className = 'products-list';.*?\}\)\.join\(''\);\s*\}\s*\}", list_replacement.strip().replace('\\', '\\\\') + "\n  }\n}", tgt_html, flags=re.DOTALL)


# 5. Fix addToCart compatibility
# We added `warehouse` parameter to addToCart in the UI, we should update the `addToCart` function itself
cart_js_replacement = """
function addToCart(p, warehouse = 'kerman') {
  const stocks = getWarehouseStocks(p);
  const maxStock = stocks[warehouse] || stocks.total || 1;
  const cartKey = (p.product_id || p.sku || p.title) + '_' + warehouse;
  const existing = cart.find(i => i.cart_key === cartKey || i.product_id === p.product_id);

  if (existing) {
    if (existing.qty >= maxStock) {
      alert(`موجودی حداکثر ${maxStock} عدد می‌باشد.`);
      return;
    }
    existing.qty++;
  } else {
    cart.push({
      ...p,
      warehouse: warehouse,
      warehouse_name: warehouse === 'kerman' ? 'انبار کرمان' : (warehouse === 'tehran' ? 'انبار تهران' : 'موجودی سایت'),
      max_stock: maxStock,
      qty: 1,
      cart_key: cartKey
    });
  }
  renderCart();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.product_id === id || i.cart_key === id);
  if(!item) return;
  if(delta > 0 && item.qty >= (item.max_stock || 999)) return alert("حداکثر موجودی انتخاب شده");
  item.qty += delta;
"""
tgt_html = tgt_html.replace("""function addToCart(p) {
  const item = cart.find(i => i.product_id === p.product_id);
  if(item) item.qty++;
  else cart.push({ ...p, qty: 1 });
  renderCart();
}
function changeQty(id, delta) {
  const item = cart.find(i => i.product_id === id);
  if(!item) return;
  item.qty += delta;""", cart_js_replacement.strip())


# In renderCart, we should show the warehouse name
tgt_html = tgt_html.replace('<!-- Cart items list -->', '<!-- Cart items list (Modified for warehouses) -->')

with open(target_path, 'w', encoding='utf-8') as f:
    f.write(tgt_html)
print("Merge complete")
