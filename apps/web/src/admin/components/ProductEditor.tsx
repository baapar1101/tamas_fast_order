import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BrandDTO, CategoryDTO, ProductDTO } from '@tamas/shared';
import { api } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { ImagePicker } from './ImagePicker';

export interface ProductForm {
  productId: string;
  sku: string;
  title: string;
  model: string;
  categoryName: string;
  brandName: string;
  color: string;
  colorEn: string;
  colorCode: string;
  price: number;
  oldPrice: number | null;
  discount: number;
  stock: number;
  kermanStock: number;
  tehranStock: number;
  otherStocks: Record<string, number>;
  parentProductId: string;
  warranty: string;
  sellType: string;
  seller: string;
  promotion: boolean;
  status: 'active' | 'inactive';
  imageUrl: string;
  gallery: string[];
  attributes: Array<{ key: string; value: string }>;
  sortOrder: number;
  subTitle: string;
  description: string;
  keywords: string;
  slug: string;
  ribbon: string;
  type: string;
  weight: number;
  dimensions: string;
  tracking: boolean;
}

interface Props {
  product: ProductDTO | null;
  template?: ProductDTO;
  categories: CategoryDTO[];
  brands: BrandDTO[];
  busy: boolean;
  onClose: () => void;
  onSave: (form: ProductForm) => void;
}

const blank = (): ProductForm => ({
  productId: '',
  sku: '',
  title: '',
  model: '',
  categoryName: '',
  brandName: '',
  color: '',
  colorEn: '',
  colorCode: '',
  price: 0,
  oldPrice: null,
  discount: 0,
  stock: 0,
  kermanStock: 0,
  tehranStock: 0,
  otherStocks: {},
  parentProductId: '',
  warranty: '',
  sellType: '',
  seller: '',
  promotion: false,
  status: 'active',
  imageUrl: '',
  gallery: [],
  attributes: [],
  sortOrder: 0,
  subTitle: '',
  description: '',
  keywords: '',
  slug: '',
  ribbon: '',
  type: 'physical',
  weight: 0,
  dimensions: '',
  tracking: true,
});

const fromProduct = (p: ProductDTO): ProductForm => ({
  productId: p.productId,
  sku: p.sku ?? '',
  title: p.title,
  model: p.model ?? '',
  categoryName: p.categoryName ?? '',
  brandName: p.brandName ?? '',
  color: p.color ?? '',
  colorEn: p.colorEn ?? '',
  colorCode: p.colorCode ?? '',
  price: p.price,
  oldPrice: p.oldPrice,
  discount: p.discount,
  stock: p.stock,
  kermanStock: p.kermanStock,
  tehranStock: p.tehranStock,
  otherStocks: p.otherStocks ?? {},
  parentProductId: p.parentProductId ?? '',
  warranty: p.warranty ?? '',
  sellType: p.sellType ?? '',
  seller: p.seller ?? '',
  promotion: p.promotion,
  status: p.status,
  imageUrl: p.imageUrl ?? '',
  gallery: p.gallery,
  attributes: p.attributes,
  sortOrder: p.sortOrder,
  subTitle: p.subTitle ?? '',
  description: p.description ?? '',
  keywords: p.keywords ?? '',
  slug: p.slug ?? '',
  ribbon: p.ribbon ?? '',
  type: p.type ?? 'physical',
  weight: p.weight ?? 0,
  dimensions: p.dimensions ?? '',
  tracking: p.tracking ?? true,
});

type TabKey = 'basic' | 'pricing' | 'attributes' | 'gallery' | 'seo';

export function ProductEditor({ product, template, categories, brands, busy, onClose, onSave }: Props) {
  const [form, setForm] = useState<ProductForm>(product ? fromProduct(product) : template ? fromProduct(template) : blank());
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('basic');

  const { data: attributesList = [] } = useQuery({
    queryKey: ['admin', 'attributes'],
    queryFn: async () => {
      return api.get<{ id: string; name: string; type: string }[]>('/admin/attributes');
    },
  });

  const { data: warehousesList = [] } = useQuery({
    queryKey: ['admin', 'warehouses'],
    queryFn: async () => {
      return api.get<{ id: string; code: string; name: string; isActive: boolean }[]>('/admin/warehouses');
    },
  });

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm({ ...form, [key]: value });

  function submit() {
    if (!form.productId.trim()) {
      setError('کد کالا (product_id) الزامی است.');
      return;
    }
    if (!form.title.trim()) {
      setError('عنوان محصول الزامی است.');
      return;
    }
    setError('');
    onSave({
      ...form,
      productId: form.productId.trim(),
      title: form.title.trim(),
      oldPrice: form.oldPrice && form.oldPrice > 0 ? form.oldPrice : null,
    });
  }

  const tabs = [
    { id: 'basic', label: 'اطلاعات پایه' },
    { id: 'pricing', label: 'قیمت و موجودی' },
    { id: 'attributes', label: 'ویژگی‌ها و نوع' },
    { id: 'gallery', label: 'گالری تصاویر' },
    { id: 'seo', label: 'سئو و تنظیمات' },
  ] as const;

  return (
    <Modal
      open
      wide
      busy={busy}
      title={product ? `ویرایش: ${product.title}` : 'محصول جدید'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn primary" style={{ flex: 1 }} onClick={submit} disabled={busy}>
            {busy ? 'در حال ذخیره…' : 'ذخیره محصول'}
          </button>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            انصراف
          </button>
        </>
      }
    >
      <div className="flex flex-col h-full gap-4">
        {error && <div className="alert error">{error}</div>}

        {/* Custom Tab Bar */}
        <div className="flex overflow-x-auto border-b border-white/[0.06] mb-4 pb-2 gap-2 hide-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
              onClick={() => setActiveTab(tab.id as TabKey)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'basic' && (
            <div className="form-grid">
              <div className="field">
                <label htmlFor="f-pid">کد کالا (product_id) *</label>
                <input
                  id="f-pid"
                  className="input ltr"
                  value={form.productId}
                  onChange={(e) => set('productId', e.target.value)}
                  disabled={Boolean(product)}
                />
                {product && <span className="faint" style={{ fontSize: 11 }}>کد کالا کلید همگام‌سازی است و تغییر نمی‌کند.</span>}
              </div>

              <div className="field">
                <label htmlFor="f-parent">کد محصول والد (parent_product_id)</label>
                <input id="f-parent" className="input ltr" value={form.parentProductId} onChange={(e) => set('parentProductId', e.target.value)} />
                <span className="faint" style={{ fontSize: 11 }}>برای اتصال به عنوان واریانت، کد محصول اصلی را وارد کنید.</span>
              </div>

              <div className="field">
                <label htmlFor="f-sku">SKU</label>
                <input id="f-sku" className="input ltr" value={form.sku} onChange={(e) => set('sku', e.target.value)} />
              </div>

              <div className="field full">
                <label htmlFor="f-title">عنوان *</label>
                <input id="f-title" className="input" value={form.title} onChange={(e) => set('title', e.target.value)} />
                <span className="faint" style={{ fontSize: 11 }}>محصولات با عنوان یکسان در فروشگاه در یک صفحه با چند رنگ نمایش داده می‌شوند.</span>
              </div>

              <div className="field">
                <label htmlFor="f-model">مدل</label>
                <input id="f-model" className="input" value={form.model} onChange={(e) => set('model', e.target.value)} />
              </div>

              <div className="field full">
                <label htmlFor="f-subtitle">زیرعنوان (SubTitle)</label>
                <input id="f-subtitle" className="input" value={form.subTitle} onChange={(e) => set('subTitle', e.target.value)} />
              </div>

              <div className="field full">
                <label htmlFor="f-desc">توضیحات (Description)</label>
                <textarea id="f-desc" className="input" rows={6} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </div>

              <div className="field">
                <label htmlFor="f-cat">دسته‌بندی</label>
                <input
                  id="f-cat"
                  className="input"
                  list="cat-list"
                  value={form.categoryName}
                  onChange={(e) => set('categoryName', e.target.value)}
                />
                <datalist id="cat-list">
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.faName}</option>
                  ))}
                </datalist>
              </div>

              <div className="field">
                <label htmlFor="f-brand">برند</label>
                <input
                  id="f-brand"
                  className="input"
                  list="brand-list"
                  value={form.brandName}
                  onChange={(e) => set('brandName', e.target.value)}
                />
                <datalist id="brand-list">
                  {brands.map((b) => (
                    <option key={b.id} value={b.name}>{b.faName}</option>
                  ))}
                </datalist>
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="form-grid">
              <div className="field">
                <label htmlFor="f-price">قیمت (تومان) *</label>
                <input
                  id="f-price"
                  className="input ltr"
                  inputMode="numeric"
                  value={form.price}
                  onChange={(e) => set('price', Number(e.target.value.replace(/\D/g, '')) || 0)}
                />
              </div>

              <div className="field">
                <label htmlFor="f-oldprice">قیمت قبلی</label>
                <input
                  id="f-oldprice"
                  className="input ltr"
                  inputMode="numeric"
                  value={form.oldPrice ?? ''}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    set('oldPrice', digits ? Number(digits) : null);
                  }}
                />
              </div>

              <div className="field">
                <label htmlFor="f-discount">تخفیف (٪)</label>
                <input
                  id="f-discount"
                  className="input ltr"
                  inputMode="numeric"
                  value={form.discount}
                  onChange={(e) => set('discount', Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0))}
                />
              </div>

              {warehousesList.filter(w => w.isActive).map((w) => (
                <div className="field" key={w.code}>
                  <label htmlFor={`f-wh-${w.code}`}>موجودی {w.name}</label>
                  <input
                    id={`f-wh-${w.code}`}
                    className="input ltr"
                    inputMode="numeric"
                    value={
                      w.code === 'tehran' ? form.tehranStock :
                      w.code === 'kerman' ? form.kermanStock :
                      (form.otherStocks?.[w.code] || 0)
                    }
                    onChange={(e) => {
                      const val = Number(e.target.value.replace(/\D/g, '')) || 0;
                      if (w.code === 'tehran') set('tehranStock', val);
                      else if (w.code === 'kerman') set('kermanStock', val);
                      else set('otherStocks', { ...form.otherStocks, [w.code]: val });
                    }}
                  />
                </div>
              ))}

              <div className="field">
                <label htmlFor="f-stock">موجودی کلی (پشتیبان)</label>
                <input
                  id="f-stock"
                  className="input ltr"
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => set('stock', Number(e.target.value.replace(/\D/g, '')) || 0)}
                />
              </div>

              <div className="field">
                <label htmlFor="f-selltype">نوع فروش</label>
                <input
                  id="f-selltype"
                  className="input"
                  placeholder="نقدی, اعتباری"
                  value={form.sellType}
                  onChange={(e) => set('sellType', e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="f-seller">فروشنده</label>
                <input id="f-seller" className="input" value={form.seller} onChange={(e) => set('seller', e.target.value)} />
              </div>

              <div className="field">
                <label htmlFor="f-warranty">گارانتی</label>
                <input id="f-warranty" className="input" value={form.warranty} onChange={(e) => set('warranty', e.target.value)} />
              </div>
            </div>
          )}

          {activeTab === 'attributes' && (
            <div className="form-grid">
              <div className="field">
                <label htmlFor="f-type">نوع محصول</label>
                <select id="f-type" className="select" value={form.type} onChange={(e) => set('type', e.target.value)}>
                  <option value="physical">فیزیکی (ارسال پستی)</option>
                  <option value="digital">دیجیتال (دانلودی)</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="f-weight">وزن (گرم)</label>
                <input id="f-weight" className="input ltr" inputMode="numeric" value={form.weight} onChange={(e) => set('weight', Number(e.target.value.replace(/\D/g, '')) || 0)} />
              </div>

              <div className="field">
                <label htmlFor="f-dim">ابعاد</label>
                <input id="f-dim" className="input ltr" placeholder="L x W x H" value={form.dimensions} onChange={(e) => set('dimensions', e.target.value)} />
              </div>

              <div className="field">
                <label htmlFor="f-color">رنگ (فارسی)</label>
                <input id="f-color" className="input" value={form.color} onChange={(e) => set('color', e.target.value)} />
              </div>

              <div className="field">
                <label htmlFor="f-coloren">رنگ (انگلیسی)</label>
                <input id="f-coloren" className="input ltr" value={form.colorEn} onChange={(e) => set('colorEn', e.target.value)} />
              </div>

              <div className="field">
                <label htmlFor="f-colorcode">کد رنگ</label>
                <div className="row">
                  <input
                    id="f-colorcode"
                    className="input ltr"
                    placeholder="#C25E27"
                    value={form.colorCode}
                    onChange={(e) => set('colorCode', e.target.value)}
                  />
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(form.colorCode) ? form.colorCode : '#00768f'}
                    onChange={(e) => set('colorCode', e.target.value)}
                    style={{ width: 40, height: 36, padding: 2, border: '1px solid var(--border-strong)', borderRadius: 8 }}
                    aria-label="انتخاب رنگ"
                  />
                </div>
              </div>

              <div className="field full mt-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-3">
                  <label className="text-sm font-bold text-white">مشخصات فنی</label>
                  <button
                    type="button"
                    className="huma-btn-secondary !py-1 !px-3 !text-xs"
                    onClick={() => set('attributes', [...form.attributes, { key: '', value: '' }])}
                  >
                    + افزودن ویژگی
                  </button>
                </div>

                <div className="space-y-3">
                  <datalist id="attrs-list">
                    {attributesList.map((a) => (
                      <option key={a.id} value={a.name} />
                    ))}
                  </datalist>
                  {form.attributes.map((attr, i) => (
                    <div className="flex flex-col sm:flex-row items-center gap-2" key={i}>
                      <input
                        className="huma-input sm:w-1/3"
                        placeholder="نام ویژگی (مثلا: وزن)"
                        list="attrs-list"
                        value={attr.key}
                        onChange={(e) => {
                          const next = [...form.attributes];
                          next[i] = { ...attr, key: e.target.value };
                          set('attributes', next);
                        }}
                      />
                      <input
                        className="huma-input sm:flex-1"
                        placeholder="مقدار"
                        value={attr.value}
                        onChange={(e) => {
                          const next = [...form.attributes];
                          next[i] = { ...attr, value: e.target.value };
                          set('attributes', next);
                        }}
                      />
                      <button
                        type="button"
                        className="huma-btn-secondary !bg-rose-500/10 !text-rose-400 !border-rose-500/30"
                        onClick={() => set('attributes', form.attributes.filter((_, j) => j !== i))}
                        aria-label="حذف ویژگی"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {form.attributes.length === 0 && <span className="text-xs text-slate-400">ویژگی‌ای ثبت نشده است.</span>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gallery' && (
            <div className="space-y-6">
              <ImagePicker
                label="تصویر اصلی محصول"
                value={form.imageUrl}
                onChange={(url) => set('imageUrl', url)}
                kind="product"
              />
              
              <div className="border-t border-white/[0.06] pt-4">
                <label className="block text-sm font-bold text-white mb-3">گالری تصاویر (بیشتر از یک عکس)</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {form.gallery.map((g, idx) => (
                    <div key={idx} className="relative group">
                      <ImagePicker
                        label={`تصویر ${idx + 1}`}
                        value={g}
                        onChange={(url) => {
                          const copy = [...form.gallery];
                          copy[idx] = url;
                          set('gallery', copy);
                        }}
                        kind="product"
                      />
                      <button 
                        type="button" 
                        onClick={() => {
                          const copy = [...form.gallery];
                          copy.splice(idx, 1);
                          set('gallery', copy);
                        }}
                        className="absolute top-1 left-1 bg-rose-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {form.gallery.length < 5 && (
                     <div className="flex items-center justify-center border border-dashed border-white/20 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] transition cursor-pointer min-h-[120px]"
                          onClick={() => set('gallery', [...form.gallery, ''])}>
                       <span className="text-2xl text-slate-400">+</span>
                     </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'seo' && (
            <div className="form-grid">
              <div className="field">
                <label htmlFor="f-slug">نامک (Slug) - برای URL</label>
                <input id="f-slug" className="input ltr" value={form.slug} onChange={(e) => set('slug', e.target.value)} />
              </div>
              
              <div className="field">
                <label htmlFor="f-keywords">کلمات کلیدی (سئو - با کاما جدا کنید)</label>
                <input id="f-keywords" className="input" value={form.keywords} onChange={(e) => set('keywords', e.target.value)} />
              </div>
              
              <div className="field">
                <label htmlFor="f-ribbon">روبان (Ribbon)</label>
                <input id="f-ribbon" className="input" placeholder="مثال: پرفروش، حراج" value={form.ribbon} onChange={(e) => set('ribbon', e.target.value)} />
              </div>
              
              <div className="field">
                <label htmlFor="f-sort">ترتیب نمایش</label>
                <input
                  id="f-sort"
                  className="input ltr"
                  inputMode="numeric"
                  value={form.sortOrder}
                  onChange={(e) => set('sortOrder', Number(e.target.value.replace(/[^\d-]/g, '')) || 0)}
                />
              </div>

              <div className="field">
                <label htmlFor="f-status">وضعیت نمایش</label>
                <select id="f-status" className="select" value={form.status} onChange={(e) => set('status', e.target.value as 'active' | 'inactive')}>
                  <option value="active">فعال (در فروشگاه دیده می‌شود)</option>
                  <option value="inactive">غیرفعال (مخفی)</option>
                </select>
              </div>

              <div className="field full mt-4 p-4 border border-white/[0.06] rounded-xl bg-white/[0.01] space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-white/10 bg-black/20 text-brand-500 focus:ring-brand-500/30"
                    checked={form.promotion}
                    onChange={(e) => set('promotion', e.target.checked)}
                  />
                  <div>
                    <div className="font-semibold text-slate-200">پیشنهاد ویژه (شگفت‌انگیز)</div>
                    <div className="text-xs text-slate-500">آیا این محصول در لیست پیشنهادات ویژه صفحه اصلی نمایش داده شود؟</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded border-white/10 bg-black/20 text-brand-500 focus:ring-brand-500/30"
                    checked={form.tracking}
                    onChange={(e) => set('tracking', e.target.checked)}
                  />
                  <div>
                    <div className="font-semibold text-slate-200">پیگیری موجودی (Tracking)</div>
                    <div className="text-xs text-slate-500">اگر غیرفعال باشد، محصول بدون توجه به موجودی قابل خرید است.</div>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
