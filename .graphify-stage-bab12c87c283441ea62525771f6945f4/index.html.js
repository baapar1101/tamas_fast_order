
/* Paste your deployed Google Apps Script /exec URL here. */
const API_URL = "https://script.google.com/macros/s/AKfycbxDY0PcZad8NPSlD_DgPrQJRGJj8kn0swETF0x4Q2lQhhPMAdgCuzsGZghC2bkmuietZQ/exec";

let allProducts = [], catalog = {categories:[], brands:[]}, cart = [], onlyStock = true, onlyPromotion = false, ascending = true;
let currentSlide=0, sliderTimer;

function money(n){ return Number(n||0).toLocaleString('fa-IR') + ' ریال'; }
function goToSlide(index){
  const slides=[...document.querySelectorAll('.hero-slide')],dots=[...document.querySelectorAll('.slider-dot')];
  if(!slides.length)return;
  currentSlide=(index+slides.length)%slides.length;
  slides.forEach((slide,i)=>slide.classList.toggle('active',i===currentSlide));
  dots.forEach((dot,i)=>dot.classList.toggle('active',i===currentSlide));
}
function changeSlide(step){goToSlide(currentSlide+step);resetSliderTimer()}
function resetSliderTimer(){clearInterval(sliderTimer);sliderTimer=setInterval(()=>goToSlide(currentSlide+1),5000)}

function jsonp(url){
  return new Promise((resolve,reject)=>{
    const cb='jsonp_'+Date.now()+'_'+Math.random().toString(16).slice(2);
    const s=document.createElement('script');
    window[cb]=data=>{delete window[cb];s.remove();resolve(data)};
    s.onerror=()=>{delete window[cb];s.remove();reject(new Error('API error'))};
    s.src=url+(url.includes('?')?'&':'?')+'callback='+cb+'&_='+Date.now();
    document.body.appendChild(s);
  });
}

async function load(){
  if(API_URL.startsWith('PASTE_')){
    allProducts = demoProducts();
  }else{
    try{
      const data=await jsonp(API_URL+'?action=catalog');
      allProducts=data.products||[];
      catalog={categories:data.categories||[],brands:data.brands||[]};
    }catch(e){
      console.warn(e); allProducts=demoProducts();
    }
  }
  buildBrands(); buildCategories(); render();
}

function demoProducts(){
  return [
    {product_id:'1',title:'Apple iPhone 17 Pro Max 512/12GB ZA/A',model:'iPhone 17 Pro Max 512/12GB ZA/A',color:'نارنجی (Cosmic Orange)',color_en:'Cosmic Orange',price:450000000,old_price:455000000,discount:1,stock:5,warranty:'18 ماه گارانتی شرکتی',seller:'تماس مارکت',status:'Not Active',image_url:'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd8?auto=format&fit=crop&w=400&q=80',brand:'اپل'},
    {product_id:'2',title:'Apple iPhone 17 Pro Max 512/12GB ZA/A',model:'iPhone 17 Pro Max 512/12GB ZA/A',color:'سرمه‌ای (Deep Blue)',color_en:'Deep Blue',price:477900000,old_price:482000000,discount:1,stock:3,warranty:'18 ماه گارانتی شرکتی',seller:'تماس مارکت',status:'Not Active',image_url:'https://images.unsplash.com/photo-1592286927505-2fd0f9d7c6f4?auto=format&fit=crop&w=400&q=80',brand:'اپل'},
    {product_id:'3',title:'Apple iPhone 17 256/8GB CH/A',model:'iPhone 17 256/8GB CH/A',color:'مشکی (Black)',color_en:'Black',price:302590000,old_price:0,discount:0,stock:7,warranty:'18 ماه گارانتی شرکتی',seller:'تماس مارکت',status:'Not Active',image_url:'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?auto=format&fit=crop&w=400&q=80',brand:'اپل'}
  ];
}

function buildBrands(){
  const brands=catalog.brands.length?catalog.brands:[...new Set(allProducts.map(p=>p.brand).filter(Boolean))].map(name=>({brand_fa_name:name,icon:''}));
  const el=document.getElementById('brands'); if(!el)return;
  el.innerHTML = `<button class="brand-icon-btn active" title="همه" aria-label="همه" onclick="filterBrand('')">⌂</button>`+
    brands.map(b=>{const name=b.brand_fa_name||b.brand_name||b.name; const icon=assetIcon_(b.icon_url||b.icon,'brand',name); return `<button class="brand-icon-btn" title="${esc(name)}" aria-label="${esc(name)}" onclick="filterBrand('${String(name).replace(/'/g,"\\'")}')">${icon||'<span class="chip-icon-text">•</span>'}</button>`}).join('');
}
function buildCategories(){
  const cats=catalog.categories||[];
  if(!cats.length)return;
  document.getElementById('categories').innerHTML=cats.map(c=>{const name=c.category_fa_name||c.category_name; const icon=assetIcon_(c.icon_url||c.icon,'category',name); return `<button class="chip category-chip" onclick="filterCategory('${String(name).replace(/'/g,"\\'")}')">${icon}<span>${esc(name)}</span></button>`}).join('');
}
function assetIcon_(value,folder,fallbackName){
  const v=String(value||'').trim();
  const fallback=String(fallbackName||'').trim();
  const map = folder==='brand'
    ? {'hoco':'hoco.svg','حُوکو':'hoco.svg','هوکو':'hoco.svg','HOCO':'hoco.svg','macdodo':'macdodo.svg','yesido':'yesido.svg','qcy':'qcy.svg','oxygen':'oxygen.svg','hadron':'hadron.svg'}
    : {'ایرپاد':'airpod.svg','airpod':'airpod.svg','AirPods':'airpod.svg','گوشی موبایل':'mobile.svg','موبایل':'mobile.svg','گوشی':'mobile.svg','تبلت':'mobile.svg','هدفون و هندزفری':'handsfree.svg','هندزفری':'handsfree.svg','هدفون':'headphon.svg','پاوربانک':'powerbank.svg','اسپیکر':'speaker.svg','ساعت':'watch.svg','شارژر':'adapter.svg','آداپتور':'adapter.svg','کابل':'cable.svg','قاب':'cover.svg','کاور':'cover.svg','محافظ صفحه':'glass.svg','لوازم جانبی خودرو':'caracsories.svg','ماوس و کیبورد':'mouse_keyboard.svg','محصولات زیبایی':'health.svg','محصولات سلامت':'health.svg','پایه نگهدارنده گوشی و مونوپاد':'holder.svg','کابل صدا':'aux_icon.svg'};
  if(map[v]) return `<img class="chip-icon" src="assets/${folder}/${map[v]}" alt="">`;
  if(map[fallback]) return `<img class="chip-icon" src="assets/${folder}/${map[fallback]}" alt="">`;
  if(!v)return '';
  if(/\.(svg|png|jpg|jpeg|webp)$/i.test(v)) return `<img class="chip-icon" src="assets/${folder}/${esc(v)}" alt="">`;
  return `<span class="chip-icon-text">${esc(v)}</span>`;
}
let selectedBrand='';
function filterBrand(b){
  selectedBrand=b;
  document.querySelectorAll('.brand-icon-btn').forEach(btn=>btn.classList.toggle('active', b && btn.getAttribute('title')===b ? true : !b && btn.getAttribute('title')==='همه'));
  render();
}
let selectedCategory='';
function filterCategory(c){selectedCategory=c;render()}
function togglePromotion(){onlyPromotion=!onlyPromotion;document.getElementById('promoSwitch').classList.toggle('on',onlyPromotion);render()}
function sortPrice(){ascending=!ascending;render()}
function render(){
  const q=document.getElementById('search').value.trim().toLowerCase();
  let list=allProducts.filter(p=>
    Number(p.stock)>0 &&
    (!onlyPromotion || p.promotion===true || String(p.promotion).toUpperCase()==='TRUE') &&
    (!selectedBrand || p.brand===selectedBrand) &&
    (!selectedCategory || p.Category===selectedCategory || p.category===selectedCategory) &&
    (!q || JSON.stringify(p).toLowerCase().includes(q))
  );
  list.sort((a,b)=>ascending?Number(a.price)-Number(b.price):Number(b.price)-Number(a.price));

  // Group by model/title
  const groups={};
  list.forEach(p=>{const k=p.model||p.title; (groups[k]??=[]).push(p)});
  document.getElementById('products').innerHTML=Object.entries(groups).map(([title,items])=>`
    <article class="product">
      <div class="product-head">
        <div class="product-title">${esc(title)}</div>
        <img class="product-thumb" src="${esc(items[0].image_url||'')}" onerror="this.style.visibility='hidden'">
      </div>
      <div class="variant-head">رنگ‌بندی و بهترین پیشنهاد</div>
      ${items.map(p=>variantHTML(p)).join('')}
    </article>`).join('') || '<div class="loading">محصولی پیدا نشد.</div>';
}
function variantHTML(p){
  const dot = p.color_en==='Deep Blue'?'#12273b':(p.color_en==='Black'?'#111':'#e7792b');
  return `<div class="variant">
    <button class="add" onclick='addToCart(${JSON.stringify(p).replace(/'/g,"&#39;")})'>+</button>
    <div>
      <div><span class="color-dot" style="background:${dot}"></span>${esc(p.color||'')}</div>
      <div class="meta"><span>◉ اصلی</span><span>♧ ${esc(p.warranty||'')}</span><span>▣ ${esc(p.seller||'')}</span></div>
    </div>
    <div class="price">${p.old_price?`<span class="old">${money(p.old_price)}</span>`:''}${p.discount?`<span class="discount">${esc(p.discount)}٪</span>`:''}<br>${money(p.price)}</div>
  </div>`;
}
function addToCart(p){
  const x=cart.find(i=>i.product_id===p.product_id);
  if(x)x.qty++; else cart.push({...p,qty:1});
  renderCart();
}
function changeQty(id,d){
  const x=cart.find(i=>i.product_id===id); if(!x)return;
  x.qty+=d; if(x.qty<=0)cart=cart.filter(i=>i.product_id!==id); renderCart();
}
function renderCart(){
  const el=document.getElementById('cartItems');
  if(!cart.length){el.className='cart-empty';el.innerHTML='لیست خرید شما خالی است';return}
  el.className='';
  const total=cart.reduce((s,i)=>s+i.price*i.qty,0);
  el.innerHTML=cart.map(i=>`<div class="cart-item"><b>${esc(i.title||i.model||'محصول')}</b>${i.model&&i.model!==i.title?`<div class="meta">مدل: ${esc(i.model)}</div>`:''}${i.color?`<div class="meta">رنگ: ${esc(i.color)}</div>`:''}
    <div class="qty"><button onclick="changeQty('${i.product_id}',-1)">−</button>${i.qty}<button onclick="changeQty('${i.product_id}',1)">+</button>
    <span>${money(i.price*i.qty)}</span></div></div>`).join('')+
    `<div class="total"><span>مجموع</span><span>${money(total)}</span></div>
     <button class="btn primary checkout" onclick="openModal()">ادامه و ثبت سفارش</button>`;
}
function openModal(){document.getElementById('checkoutModal').classList.add('open')}
function closeModal(){document.getElementById('checkoutModal').classList.remove('open')}
function openRegister(){document.getElementById('registerModal').classList.add('open')}
function closeRegister(){document.getElementById('registerModal').classList.remove('open')}
async function submitRegistration(){
  const payload={action:'registerUser',
    name:document.getElementById('regName').value.trim(),
    last_name:document.getElementById('regLastName').value.trim(),
    Store_name:document.getElementById('regStoreName').value.trim(),
    phone_number:document.getElementById('regPhone').value.trim(),
    mobile_number:document.getElementById('regMobile').value.trim(),
    address:document.getElementById('regAddress').value.trim(),
    postal_code:document.getElementById('regPostalCode').value.trim(),
    certificate_file_url:document.getElementById('regCertificate').value.trim()};
  if(!payload.name||!payload.last_name||!payload.mobile_number){alert('نام، نام خانوادگی و شماره موبایل را وارد کنید.');return}
  try{
    const res=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
    const data=await res.json(); if(!data.ok) throw new Error(data.error||'ثبت نام ناموفق بود');
    alert('ثبت نام با موفقیت انجام شد و پس از بررسی فعال می‌شود.'); closeRegister();
  }catch(err){alert(err.message||'خطا در ثبت نام');}
}
function submitOrder(){
  const payload={action:'createOrder',customer_name:document.getElementById('customerName').value,phone:document.getElementById('phone').value,address:document.getElementById('address').value,items:cart.map(({product_id,title,color,price,qty})=>({product_id,title,color,price,qty})),total:cart.reduce((s,i)=>s+i.price*i.qty,0)};
  if(!payload.customer_name||!payload.phone){alert('نام و شماره موبایل را وارد کنید.');return}
  if(API_URL.startsWith('PASTE_')){alert('دمو: سفارش آماده است. ابتدا API_URL را تنظیم کنید.');return}
  fetch(API_URL,{method:'POST',mode:'no-cors',body:JSON.stringify(payload)});
  alert('سفارش شما ثبت شد.');
  cart=[];renderCart();closeModal();
}
function scrollToCart(){document.getElementById('cart').scrollIntoView({behavior:'smooth'})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
document.getElementById('search').addEventListener('input',render);
resetSliderTimer();
load();

