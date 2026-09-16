import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BrandDTO, CategoryDTO, ProductDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { api } from '../../lib/api';
import { ImagePicker } from './ImagePicker';
import { Price } from '../../components/Price';

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

export function ProductEditor({ product, template, categories, brands, busy, onClose, onSave }: Props) {
  const [form, setForm] = useState<ProductForm>(product ? fromProduct(product) : template ? fromProduct(template) : blank());
  const [error, setError] = useState('');

  // Variants Fetching (if editing an existing parent product)
  const { data: variantsData, isLoading: variantsLoading } = useQuery({
    queryKey: ['admin', 'products', 'variants', form.productId],
    queryFn: () => api.get<{ items: ProductDTO[] }>('/admin/products', { parentProductId: form.productId }),
    enabled: !!product && !!form.productId && !form.parentProductId,
  });
  const variants = variantsData?.items ?? [];

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

  const titleText = product ? 'ویرایش محصول' : 'ایجاد محصول';

  return (
    <div className="flex flex-col h-full animate-fade-in pb-20 lg:pb-0">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-slate-900/80 backdrop-blur-md border-b border-white/[0.06] p-4 mb-6 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/[0.06] transition text-slate-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-extrabold text-white">{titleText}</h1>
            {product && <p className="text-xs text-slate-400 mt-0.5">{product.title}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="huma-btn-secondary !hidden sm:!flex" onClick={onClose} disabled={busy}>
            انصراف
          </button>
          <button type="button" className="huma-btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'در حال ذخیره…' : 'ذخیره محصول'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4">
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm font-semibold">
            {error}
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 px-4">
        
        {/* Left Column (Main Content Blocks) */}
        <div className="space-y-6">
          
          {/* General Info */}
          <section className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-white/[0.06] pb-3 mb-4">اطلاعات پایه</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">کد کالا (product_id) *</label>
                <input 
                  className="huma-input ltr" 
                  value={form.productId} 
                  onChange={(e) => set('productId', e.target.value)}
                  readOnly={!!product}
                  title={product ? 'کد کالا قابل تغییر نیست' : ''}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">عنوان *</label>
                <input className="huma-input" value={form.title} onChange={(e) => set('title', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">زیرعنوان (SubTitle)</label>
                <input className="huma-input ltr text-right" value={form.subTitle} onChange={(e) => set('subTitle', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">مدل</label>
                <input className="huma-input ltr text-right" value={form.model} onChange={(e) => set('model', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">کد شناسایی (SKU)</label>
                <input className="huma-input ltr text-right" value={form.sku} onChange={(e) => set('sku', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">توضیحات (Description)</label>
                <textarea 
                  className="huma-input min-h-[140px] resize-y py-3" 
                  value={form.description} 
                  onChange={(e) => set('description', e.target.value)} 
                />
              </div>
            </div>
          </section>

          {/* Gallery */}
          <section className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
              <h3 className="text-sm font-bold text-white">گالری تصاویر</h3>
              <span className="text-xs text-slate-500">حداکثر ۵ تصویر</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {/* Main Image */}
              <div className="relative group">
                <div className="text-xs text-center text-emerald-400 mb-1 font-semibold">تصویر اصلی</div>
                <ImagePicker
                  url={form.imageUrl}
                  onSelect={(url) => set('imageUrl', url)}
                  kind="product"
                />
              </div>
              {/* Gallery Images */}
              {form.gallery.map((url, idx) => (
                <div key={idx} className="relative group pt-5">
                  <ImagePicker
                    url={url}
                    onSelect={(url) => {
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
                    className="absolute top-6 left-1 bg-rose-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {form.gallery.length < 5 && (
                <div className="pt-5">
                  <div className="flex items-center justify-center border border-dashed border-white/20 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] transition cursor-pointer h-full min-h-[120px]"
                        onClick={() => set('gallery', [...form.gallery, ''])}>
                    <span className="text-2xl text-slate-400">+</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Pricing */}
          <section className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-white/[0.06] pb-3 mb-4">قیمت‌گذاری و موجودی</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">قیمت (تومان)</label>
                <input
                  className="huma-input ltr"
                  inputMode="numeric"
                  value={form.price}
                  onChange={(e) => set('price', Number(e.target.value.replace(/\D/g, '')))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">قیمت خط‌خورده (تومان)</label>
                <input
                  className="huma-input ltr"
                  inputMode="numeric"
                  value={form.oldPrice || ''}
                  onChange={(e) => set('oldPrice', Number(e.target.value.replace(/\D/g, '')))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">موجودی انبار</label>
                <input
                  className="huma-input ltr"
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => set('stock', Number(e.target.value.replace(/\D/g, '')))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">گارانتی</label>
                <input className="huma-input" value={form.warranty} onChange={(e) => set('warranty', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Variants Block */}
          {!form.parentProductId && (
            <section className="glass-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">تنوع محصول (Variants)</h3>
                  <p className="text-xs text-slate-500 mt-1">محصول دارای تنوع رنگ یا ویژگی‌های دیگر است</p>
                </div>
                {product && (
                  <button type="button" className="huma-btn-secondary !text-xs !py-1.5">
                    + افزودن تنوع
                  </button>
                )}
              </div>
              
              {!product ? (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm p-4 rounded-xl text-center font-semibold">
                  ابتدا اطلاعات محصول را ذخیره کنید تا امکان افزودن تنوع فراهم شود.
                </div>
              ) : variantsLoading ? (
                <div className="animate-pulse p-4 text-center text-slate-400">در حال بارگذاری تنوع‌ها...</div>
              ) : variants.length === 0 ? (
                <div className="text-center text-slate-500 py-6 text-sm">هیچ تنوعی ثبت نشده است.</div>
              ) : (
                <div className="huma-table-container">
                  <table className="huma-table">
                    <thead>
                      <tr>
                        <th>رنگ / تنوع</th>
                        <th>قیمت (تومان)</th>
                        <th>موجودی</th>
                        <th>وضعیت</th>
                        <th>عملیات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map(v => {
                        const totalStock = v.kermanStock + v.tehranStock > 0 ? v.kermanStock + v.tehranStock : v.stock;
                        return (
                          <tr key={v.id}>
                            <td>
                              <div className="flex items-center gap-2 font-bold text-white">
                                {v.colorCode && (
                                  <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: v.colorCode }} />
                                )}
                                {v.color || 'بدون نام'}
                              </div>
                            </td>
                            <td className="font-semibold text-emerald-400"><Price amount={v.price} /></td>
                            <td>
                              <span className={`chip ${totalStock > 0 ? 'chip-brand' : 'chip-rose'}`}>
                                {formatNumber(totalStock)}
                              </span>
                            </td>
                            <td>
                              <span className={`chip ${v.status === 'active' ? 'chip-brand' : 'chip-slate'}`}>
                                {v.status === 'active' ? 'فعال' : 'غیرفعال'}
                              </span>
                            </td>
                            <td>
                              <button type="button" className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                                ویرایش
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Shipping */}
          <section className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-white/[0.06] pb-3 mb-4">حمل و نقل</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">وزن بسته (گرم)</label>
                <input
                  className="huma-input ltr"
                  inputMode="numeric"
                  value={form.weight}
                  onChange={(e) => set('weight', Number(e.target.value.replace(/\D/g, '')))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">ابعاد بسته‌بندی</label>
                <input className="huma-input ltr text-right" placeholder="مثال: 20x15x10" value={form.dimensions} onChange={(e) => set('dimensions', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Features / Attributes */}
          <section className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">ویژگی‌ها</h3>
                <p className="text-xs text-slate-500 mt-1">ویژگی‌های فنی و مشخصات محصول</p>
              </div>
              <button 
                type="button" 
                className="huma-btn-secondary !text-xs !py-1.5"
                onClick={() => set('attributes', [...form.attributes, { key: '', value: '' }])}
              >
                + افزودن ویژگی
              </button>
            </div>
            
            <div className="space-y-3">
              {form.attributes.length === 0 ? (
                <div className="text-center text-slate-500 py-4 text-sm">هیچ ویژگی ثبت نشده است.</div>
              ) : (
                form.attributes.map((attr, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
                    <div className="w-full sm:w-1/3">
                      <input
                        className="huma-input !py-2 !text-sm"
                        placeholder="نام ویژگی (مثال: رم)"
                        value={attr.key}
                        onChange={(e) => {
                          const cp = [...form.attributes];
                          cp[idx].key = e.target.value;
                          set('attributes', cp);
                        }}
                      />
                    </div>
                    <div className="flex-1 w-full relative">
                      <input
                        className="huma-input !py-2 !text-sm pr-10"
                        placeholder="مقدار (مثال: 8 گیگابایت)"
                        value={attr.value}
                        onChange={(e) => {
                          const cp = [...form.attributes];
                          cp[idx].value = e.target.value;
                          set('attributes', cp);
                        }}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-rose-400 hover:bg-rose-500/20 rounded-lg transition"
                        onClick={() => {
                          const cp = [...form.attributes];
                          cp.splice(idx, 1);
                          set('attributes', cp);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* SEO */}
          <section className="glass-card p-6 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-white/[0.06] pb-3 mb-4">موتورهای جستجو (SEO)</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">نامک (Slug) - انتهای URL</label>
                <input className="huma-input ltr text-right" placeholder="english-product-name" value={form.slug} onChange={(e) => set('slug', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">کلمات کلیدی (با کاما جدا کنید)</label>
                <input className="huma-input" value={form.keywords} onChange={(e) => set('keywords', e.target.value)} />
              </div>
            </div>
          </section>

        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-6">
          
          {/* Categorization */}
          <section className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-white/[0.06] pb-3 mb-4">دسته‌بندی و برند</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">دسته‌بندی اصلی</label>
              <select className="huma-input !py-2.5" value={form.categoryName} onChange={(e) => set('categoryName', e.target.value)}>
                <option value="">-- انتخاب دسته‌بندی --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.faName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">برند محصول</label>
              <select className="huma-input !py-2.5" value={form.brandName} onChange={(e) => set('brandName', e.target.value)}>
                <option value="">-- بدون برند --</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.faName}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Settings */}
          <section className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-white/[0.06] pb-3 mb-4">تنظیمات</h3>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-white/10 bg-black/20 text-emerald-500 focus:ring-emerald-500/30"
                  checked={form.status === 'active'}
                  onChange={(e) => set('status', e.target.checked ? 'active' : 'inactive')}
                />
                <div>
                  <div className="font-semibold text-slate-200 text-sm">محصول فعال باشد</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-white/10 bg-black/20 text-brand-500 focus:ring-brand-500/30"
                  checked={form.promotion}
                  onChange={(e) => set('promotion', e.target.checked)}
                />
                <div>
                  <div className="font-semibold text-slate-200 text-sm">پیشنهاد ویژه</div>
                  <div className="text-[10px] text-slate-500 mt-1">نمایش در اسلایدر محصولات ویژه</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-white/10 bg-black/20 text-brand-500 focus:ring-brand-500/30"
                  checked={form.tracking}
                  onChange={(e) => set('tracking', e.target.checked)}
                />
                <div>
                  <div className="font-semibold text-slate-200 text-sm">پیگیری موجودی</div>
                  <div className="text-[10px] text-slate-500 mt-1">جلوگیری از فروش در صورت اتمام موجودی</div>
                </div>
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 mt-2">روبان / برچسب روی عکس</label>
                <input className="huma-input !py-2" placeholder="مثال: پرفروش" value={form.ribbon} onChange={(e) => set('ribbon', e.target.value)} />
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
