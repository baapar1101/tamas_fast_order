import { useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BrandDTO, CategoryDTO, ProductDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { api } from '../../lib/api';
import { ImagePicker } from './ImagePicker';
import { Price } from '../../components/Price';
import { AnimatedDropdown } from './AnimatedDropdown';

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
  digikalaLink: string;
}

interface Props {
  product: ProductDTO | null;
  template?: ProductDTO;
  categories: CategoryDTO[];
  brands: BrandDTO[];
  busy: boolean;
  onClose: () => void;
  onSave: (form: ProductForm) => void;
  onManageVariants?: (product: ProductDTO) => void;
}

interface AttributeDef {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
}

const ATTR_TYPE_LABELS: Record<string, string> = {
  text: 'متن ساده',
  number: 'عدد',
  boolean: 'بله / خیر',
  select: 'چند گزینه‌ای',
};

const MULTI_SEP = '، ';

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
  digikalaLink: '',
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
  digikalaLink: p.digikalaLink ?? '',
});

export function ProductEditor({ product, template, categories, brands, busy, onClose, onSave, onManageVariants }: Props) {
  const [form, setForm] = useState<ProductForm>(product ? fromProduct(product) : template ? fromProduct(template) : blank());
  const [error, setError] = useState('');

  // Variants Fetching (if editing an existing parent product)
  const { data: variantsData, isLoading: variantsLoading } = useQuery({
    queryKey: ['admin', 'products', 'variants', form.productId],
    queryFn: () => api.get<{ items: ProductDTO[] }>('/admin/products', { parentProductId: form.productId }),
    enabled: !!product && !!form.productId && !form.parentProductId,
  });
  const variants = variantsData?.items ?? [];

  const { data: attributeDefs } = useQuery({
    queryKey: ['admin', 'attributes'],
    queryFn: () => api.get<AttributeDef[]>('/admin/attributes'),
    staleTime: 60_000,
  });
  const attrByKey = new Map((attributeDefs ?? []).map((d) => [d.name.trim(), d]));

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm({ ...form, [key]: value });

  const updateAttrKey = (idx: number, key: string) => {
    const cp = [...form.attributes];
    const cur = cp[idx];
    if (!cur) return;
    const prevDef = attrByKey.get(cur.key.trim());
    const nextDef = attrByKey.get(key.trim());
    let value = cur.value;
    if (nextDef && !prevDef && (nextDef.type === 'boolean' || nextDef.type === 'select')) {
      value = nextDef.type === 'boolean' ? 'بله' : '';
    }
    cp[idx] = { ...cur, key, value };
    set('attributes', cp);
  };

  const setAttrValue = (idx: number, value: string) => {
    const cp = [...form.attributes];
    const cur = cp[idx];
    if (!cur) return;
    cp[idx] = { ...cur, value };
    set('attributes', cp);
  };

  const toggleAttrOption = (idx: number, opt: string) => {
    const cp = [...form.attributes];
    const cur = cp[idx];
    if (!cur) return;
    const current = cur.value.split(MULTI_SEP).filter(Boolean);
    const next = current.includes(opt) ? current.filter((o) => o !== opt) : [...current, opt];
    cp[idx] = { ...cur, value: next.join(MULTI_SEP) };
    set('attributes', cp);
  };

  const quickAddAttr = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    if (!name) return;
    if (form.attributes.some((a) => a.key.trim() === name)) return;
    const def = attrByKey.get(name);
    set('attributes', [...form.attributes, { key: name, value: def?.type === 'boolean' ? 'بله' : '' }]);
  };

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
      {/* Sticky Toolbar */}
      <div className="a-stickybar mb-6">
        <div className="a-stickybar-head">
          <button
            type="button"
            onClick={onClose}
            className="a-btn a-btn--ghost a-btn--sm"
            aria-label="بستن"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          <div className="flex flex-col">
            <span className="a-stickybar-title">{titleText}</span>
            {product && <span className="a-subtitle">{product.title}</span>}
          </div>
        </div>
        <div className="a-stickybar-actions">
          <button type="button" className="a-btn a-btn--secondary" onClick={onClose} disabled={busy}>
            انصراف
          </button>
          <button type="button" className="a-btn a-btn--primary" onClick={submit} disabled={busy}>
            {busy ? 'در حال ذخیره…' : 'ذخیره محصول'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4">
          <div className="a-error-box">{error}</div>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="admin-page-grid">
        
        {/* Left Column (Main Content Blocks) */}
        <div className="space-y-6">
          
          {/* General Info */}
          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">اطلاعات پایه</h3>
            </div>
            <div className="a-form-grid">
              <div className="a-field">
                <label className="a-label" htmlFor="pe-product-id">کد کالا (product_id) *</label>
                <input
                  id="pe-product-id"
                  className="a-input a-ltr"
                  value={form.productId}
                  onChange={(e) => set('productId', e.target.value)}
                  readOnly={!!product}
                  title={product ? 'کد کالا قابل تغییر نیست' : ''}
                />
              </div>
              <div className="a-field">
                <label className="a-label" htmlFor="pe-sku">کد شناسایی (SKU)</label>
                <input id="pe-sku" className="a-input a-ltr" value={form.sku} onChange={(e) => set('sku', e.target.value)} />
              </div>
              <div className="a-field a-span-2">
                <label className="a-label" htmlFor="pe-title">عنوان *</label>
                <input id="pe-title" className="a-input" value={form.title} onChange={(e) => set('title', e.target.value)} />
              </div>
              <div className="a-field">
                <label className="a-label" htmlFor="pe-subtitle">زیرعنوان (SubTitle)</label>
                <input id="pe-subtitle" className="a-input a-ltr" value={form.subTitle} onChange={(e) => set('subTitle', e.target.value)} />
              </div>
              <div className="a-field">
                <label className="a-label" htmlFor="pe-model">مدل</label>
                <input id="pe-model" className="a-input a-ltr" value={form.model} onChange={(e) => set('model', e.target.value)} />
              </div>
              <div className="a-field a-span-2">
                <label className="a-label" htmlFor="pe-desc">توضیحات (Description)</label>
                <textarea id="pe-desc" className="a-textarea" value={form.description} onChange={(e) => set('description', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Color & Appearance */}
          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">رنگ و ظاهر</h3>
            </div>
            <div className="a-form-grid">
              <div className="a-field">
                <label className="a-label" htmlFor="pe-color">نام رنگ (فارسی)</label>
                <input id="pe-color" className="a-input" placeholder="مثال: مشکی" value={form.color} onChange={(e) => set('color', e.target.value)} />
              </div>
              <div className="a-field">
                <label className="a-label" htmlFor="pe-color-en">نام رنگ (انگلیسی)</label>
                <input id="pe-color-en" className="a-input a-ltr" placeholder="e.g. Black" value={form.colorEn} onChange={(e) => set('colorEn', e.target.value)} />
              </div>
              <div className="a-field">
                <label className="a-label" htmlFor="pe-color-code">کد رنگ (هگز)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    id="pe-color-code"
                    className="a-input a-ltr"
                    placeholder="#000000"
                    value={form.colorCode}
                    onChange={(e) => set('colorCode', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <span
                    style={{
                      width: '2.2rem',
                      height: '2.2rem',
                      borderRadius: '0.5rem',
                      border: '2px solid var(--a-border-2)',
                      background: form.colorCode && /^#?[0-9a-f]{3,8}$/i.test(form.colorCode.trim())
                        ? (form.colorCode.trim().startsWith('#') ? form.colorCode.trim() : `#${form.colorCode.trim()}`)
                        : 'var(--a-surface)',
                      flexShrink: 0,
                      transition: 'background 0.15s ease',
                    }}
                    title="پیش‌نمایش رنگ"
                  />
                  <input
                    type="color"
                    value={form.colorCode && /^#[0-9a-f]{6}$/i.test(form.colorCode.trim()) ? form.colorCode.trim() : '#000000'}
                    onChange={(e) => set('colorCode', e.target.value)}
                    style={{ width: '2.2rem', height: '2.2rem', padding: 0, border: 'none', cursor: 'pointer', background: 'transparent' }}
                    title="انتخاب رنگ"
                  />
                </div>
              </div>
            </div>
          </section>

{/* Gallery */}
          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">گالری تصاویر</h3>
              <span className="a-hint">حداکثر ۵ تصویر</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {/* Main Image */}
              <div className="relative group">
                <ImagePicker
                  label="تصویر اصلی"
                  value={form.imageUrl}
                  onChange={(url) => set('imageUrl', url)}
                  kind="product"
                />
              </div>
              {/* Gallery Images */}
              {form.gallery.map((url, idx) => (
                <div key={idx} className="relative group pt-5">
                  <ImagePicker
                    label={`تصویر ${idx + 1}`}
                    value={url}
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
                    className="absolute top-6 left-1 bg-rose-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {form.gallery.length < 5 && (
                <div className="pt-5">
                  <div className="a-dropzone a-dropzone--min flex items-center justify-center"
                        onClick={() => set('gallery', [...form.gallery, ''])}>
                    <span className="a-muted text-xl">+</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Pricing */}
          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">قیمت‌گذاری و موجودی</h3>
            </div>
            <div className="a-form-grid">
              <div className="a-field">
                <label className="a-label" htmlFor="pe-price">قیمت (تومان)</label>
                <input
                  id="pe-price"
                  className="a-input a-ltr"
                  inputMode="numeric"
                  value={form.price}
                  onChange={(e) => set('price', Number(e.target.value.replace(/\D/g, '')))}
                />
              </div>
              <div className="a-field">
                <label className="a-label" htmlFor="pe-old-price">قیمت خط‌خورده (تومان)</label>
                <input
                  id="pe-old-price"
                  className="a-input a-ltr"
                  inputMode="numeric"
                  value={form.oldPrice || ''}
                  onChange={(e) => set('oldPrice', Number(e.target.value.replace(/\D/g, '')))}
                />
              </div>
              <div className="a-field">
                <label className="a-label" htmlFor="pe-stock">موجودی کلی</label>
                <input
                  id="pe-stock"
                  className="a-input a-ltr"
                  inputMode="numeric"
                  value={form.stock}
                  onChange={(e) => set('stock', Number(e.target.value.replace(/\D/g, '')))}
                />
              </div>
              <div className="a-field">
                <label className="a-label" htmlFor="pe-tehran-stock">موجودی انبار تهران</label>
                <input
                  id="pe-tehran-stock"
                  className="a-input a-ltr"
                  inputMode="numeric"
                  value={form.tehranStock}
                  onChange={(e) => set('tehranStock', Number(e.target.value.replace(/\D/g, '')))}
                />
              </div>
              <div className="a-field">
                <label className="a-label" htmlFor="pe-kerman-stock">موجودی انبار کرمان</label>
                <input
                  id="pe-kerman-stock"
                  className="a-input a-ltr"
                  inputMode="numeric"
                  value={form.kermanStock}
                  onChange={(e) => set('kermanStock', Number(e.target.value.replace(/\D/g, '')))}
                />
              </div>
              <div className="a-field">
                <label className="a-label" htmlFor="pe-warranty">گارانتی</label>
                <input id="pe-warranty" className="a-input" value={form.warranty} onChange={(e) => set('warranty', e.target.value)} />
              </div>
              <div className="a-field">
                <label className="a-label" htmlFor="pe-digikala">لینک دیجی‌کالا</label>
                <input id="pe-digikala" className="a-input a-ltr" placeholder="https://www.digikala.com/product/dkp-..." value={form.digikalaLink} onChange={(e) => set('digikalaLink', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Sell Type */}
          <section className="a-card">
            <div className="a-card-head">
              <div>
                <h3 className="a-card-title">نحوه فروش</h3>
                <p className="a-card-sub">روش‌های مجاز فروش این محصول را انتخاب کنید</p>
              </div>
            </div>
            <div className="a-form-grid">
              <div className="a-field a-span-2">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {[
                    { value: 'نقدی', icon: '💵' },
                    { value: 'اعتباری', icon: '💳' },
                    { value: 'چکی', icon: '📄' },
                    { value: 'کارت به کارت', icon: '🏦' },
                  ].map((st) => {
                    const current = form.sellType.split(/[,،]+/).map(s => s.trim()).filter(Boolean);
                    const isOn = current.includes(st.value);
                    return (
                      <button
                        key={st.value}
                        type="button"
                        className={`a-chip-opt ${isOn ? 'a-chip-opt--on' : ''}`}
                        style={{ padding: '0.5rem 0.85rem', cursor: 'pointer' }}
                        onClick={() => {
                          const next = isOn
                            ? current.filter(v => v !== st.value)
                            : [...current, st.value];
                          set('sellType', next.join('، '));
                        }}
                      >
                        <span>{st.icon}</span>
                        <span className="a-chip-opt-copy"><strong>{st.value}</strong></span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="a-field a-span-2">
                <label className="a-label" htmlFor="pe-sell-type">یا ورود دستی (با کاما جدا کنید)</label>
                <input
                  id="pe-sell-type"
                  className="a-input"
                  placeholder="مثال: نقدی، اعتباری، چکی"
                  value={form.sellType}
                  onChange={(e) => set('sellType', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Variants Block */}
          {!form.parentProductId && (
            <section className="a-card">
              <div className="a-card-head">
                <div>
                  <h3 className="a-card-title">تنوع محصول (Variants)</h3>
                  <p className="a-card-sub">محصول دارای تنوع رنگ یا ویژگی‌های دیگر است</p>
                </div>
                {product && onManageVariants && (
                  <button type="button" className="a-btn a-btn--info a-btn--sm" onClick={() => onManageVariants(product)}>
                    + افزودن تنوع
                  </button>
                )}
              </div>
              
              {!product ? (
                <div className="a-amber-box">ابتدا اطلاعات محصول را ذخیره کنید تا امکان افزودن تنوع فراهم شود.</div>
              ) : variantsLoading ? (
                <div className="animate-pulse p-4 text-center a-muted">در حال بارگذاری تنوع‌ها...</div>
              ) : variants.length === 0 ? (
                <div className="a-empty">هیچ تنوعی ثبت نشده است.</div>
              ) : (
                <div className="a-table-wrap">
                  <table className="a-table">
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
                              <div className="a-strong flex items-center gap-2">
                                {v.colorCode && (
                                  <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: v.colorCode }} />
                                )}
                                {v.color || 'بدون نام'}
                              </div>
                            </td>
                            <td><Price amount={v.price} /></td>
                            <td>
                              <span className={`a-badge ${totalStock > 0 ? 'a-badge--green' : 'a-badge--red'}`}>
                                {formatNumber(totalStock)}
                              </span>
                            </td>
                            <td>
                              <span className={`a-badge ${v.status === 'active' ? 'a-badge--green' : 'a-badge--neutral'}`}>
                                {v.status === 'active' ? 'فعال' : 'غیرفعال'}
                              </span>
                            </td>
                            <td>
                              <button type="button" className="a-link" onClick={() => onManageVariants?.(product!)}>ویرایش</button>
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
          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">حمل و نقل</h3>
            </div>
            <div className="a-form-grid">
              <div className="a-field">
                <label className="a-label" htmlFor="pe-weight">وزن بسته (گرم)</label>
                <input
                  id="pe-weight"
                  className="a-input a-ltr"
                  inputMode="numeric"
                  value={form.weight}
                  onChange={(e) => set('weight', Number(e.target.value.replace(/\D/g, '')))}
                />
              </div>
              <div className="a-field">
                <label className="a-label" htmlFor="pe-dimensions">ابعاد بسته‌بندی</label>
                <input id="pe-dimensions" className="a-input a-ltr" placeholder="مثال: 20x15x10" value={form.dimensions} onChange={(e) => set('dimensions', e.target.value)} />
              </div>
            </div>
          </section>

{/* Features / Attributes */}
          <section className="a-card">
            <div className="a-card-head">
              <div>
                <h3 className="a-card-title">ویژگی‌ها</h3>
                <p className="a-card-sub">ویژگی‌های فنی و مشخصات محصول</p>
              </div>
              <div className="a-actions">
                <AnimatedDropdown
                  buttonClassName="a-select--auto"
                  value=""
                  onChange={(val) => quickAddAttr({ target: { value: val } } as React.ChangeEvent<HTMLSelectElement>)}
                  placeholder="از ویژگی‌های تعریف‌شده…"
                  options={[
                    { value: '', label: 'از ویژگی‌های تعریف‌شده…' },
                    ...(attributeDefs ?? []).map((d) => ({
                      value: d.name,
                      label: `${d.name} (${ATTR_TYPE_LABELS[d.type] ?? d.type})`
                    }))
                  ]}
                />
                <button
                  type="button"
                  className="a-btn a-btn--info a-btn--sm"
                  onClick={() => set('attributes', [...form.attributes, { key: '', value: '' }])}
                >
                  + افزودن ویژگی
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              {form.attributes.length === 0 ? (
                <div className="a-empty">هیچ ویژگی ثبت نشده است.</div>
              ) : (
                form.attributes.map((attr, idx) => {
                  const def = attrByKey.get(attr.key.trim());
                  return (
                    <div key={idx} className={`a-attr-row ${def ? 'a-attr-row--defined' : ''}`}>
                      <div className="a-attr-key">
                        <input
                          className="a-input"
                          placeholder="نام ویژگی (مثال: رم)"
                          list="a-attr-names"
                          value={attr.key}
                          onChange={(e) => updateAttrKey(idx, e.target.value)}
                        />
                        {def && (
                          <span className={`a-attr-type ${def.type === 'select' ? 'a-attr-type--select' : ''}`}>
                            {ATTR_TYPE_LABELS[def.type] ?? def.type}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 w-full min-w-0 relative">
                        {def?.type === 'select' ? (
                          <div className="a-attr-multi">
                            {(def.options ?? []).map((opt) => {
                              const checked = attr.value.split(MULTI_SEP).includes(opt);
                              return (
                                <label key={opt} className={`a-chip-opt ${checked ? 'a-chip-opt--on' : ''}`}>
                                  <input type="checkbox" checked={checked} onChange={() => toggleAttrOption(idx, opt)} />
                                  <span className="a-chip-opt-copy"><strong>{opt}</strong></span>
                                </label>
                              );
                            })}
                            {(def.options ?? []).length === 0 && (
                              <span className="a-hint">این ویژگی در بخش مدیریت، گزینه‌ای تعریف نشده است.</span>
                            )}
                          </div>
                        ) : def?.type === 'boolean' ? (
                          <div className="a-segmented" role="group" aria-label="بله / خیر">
                            {['بله', 'خیر'].map((b) => (
                              <button
                                key={b}
                                type="button"
                                className={`a-seg ${attr.value === b ? 'a-seg--on' : ''}`}
                                onClick={() => setAttrValue(idx, b)}
                              >
                                {b}
                              </button>
                            ))}
                          </div>
                        ) : def?.type === 'number' ? (
                          <input
                            className="a-input ltr text-left"
                            inputMode="numeric"
                            dir="ltr"
                            placeholder="مقدار عددی"
                            value={attr.value}
                            onChange={(e) => setAttrValue(idx, e.target.value)}
                          />
                        ) : (
                          <input
                            className="a-input"
                            placeholder="مقدار (مثال: 8 گیگابایت)"
                            value={attr.value}
                            onChange={(e) => setAttrValue(idx, e.target.value)}
                          />
                        )}
                        <button
                          type="button"
                          className="absolute left-1 top-2 w-6 h-6 flex items-center justify-center text-rose-400 hover:bg-rose-500/20 rounded-lg transition"
                          aria-label="حذف ویژگی"
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
                  );
                })
              )}
            </div>

            {(attributeDefs ?? []).length > 0 && (
              <datalist id="a-attr-names">
                {(attributeDefs ?? []).map((d) => (
                  <option key={d.id} value={d.name} />
                ))}
              </datalist>
            )}
          </section>

          {/* SEO */}
          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">موتورهای جستجو (SEO)</h3>
            </div>
            <div className="space-y-3">
              <div className="a-field">
                <label className="a-label" htmlFor="pe-slug">نامک (Slug) - انتهای URL</label>
                <input id="pe-slug" className="a-input a-ltr" placeholder="english-product-name" value={form.slug} onChange={(e) => set('slug', e.target.value)} />
              </div>
              <div className="a-field">
                <label className="a-label" htmlFor="pe-keywords">کلمات کلیدی (با کاما جدا کنید)</label>
                <input id="pe-keywords" className="a-input" value={form.keywords} onChange={(e) => set('keywords', e.target.value)} />
              </div>
            </div>
          </section>

        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-6">
          
          {/* Categorization */}
          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">دسته‌بندی و برند</h3>
            </div>
            <div className="a-form-grid">
              <div className="a-field">
                <label className="a-label" htmlFor="pe-category">دسته‌بندی اصلی</label>
                <AnimatedDropdown
                  id="pe-category"
                  value={form.categoryName}
                  onChange={(val) => set('categoryName', val)}
                  placeholder="-- انتخاب دسته‌بندی --"
                  options={[
                    { value: '', label: '-- انتخاب دسته‌بندی --' },
                    ...categories.map((c) => ({ value: c.name, label: c.faName }))
                  ]}
                />
              </div>
              <div className="a-field">
                <label className="a-label" htmlFor="pe-brand">برند محصول</label>
                <AnimatedDropdown
                  id="pe-brand"
                  value={form.brandName}
                  onChange={(val) => set('brandName', val)}
                  placeholder="-- بدون برند --"
                  options={[
                    { value: '', label: '-- بدون برند --' },
                    ...brands.map((b) => ({ value: b.name, label: b.faName }))
                  ]}
                />
              </div>
            </div>
          </section>

          {/* Settings */}
          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">تنظیمات</h3>
            </div>
            
            <div className="space-y-3">
              <div className={`a-option-row${form.status === 'active' ? ' a-option-row--on' : ''}`}>
                <div className="a-option-copy">
                  <span className="a-option-title">محصول فعال باشد</span>
                  <span className="a-option-desc">در صورت غیرفعال بودن، محصول از سایت حذف می‌شود.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.status === 'active'}
                  className="a-switch"
                  onClick={() => set('status', form.status === 'active' ? 'inactive' : 'active')}
                />
              </div>

              <div className={`a-option-row${form.promotion ? ' a-option-row--on' : ''}`}>
                <div className="a-option-copy">
                  <span className="a-option-title">پیشنهاد ویژه</span>
                  <span className="a-option-desc">نمایش در اسلایدر محصولات ویژه</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.promotion}
                  className="a-switch"
                  onClick={() => set('promotion', !form.promotion)}
                />
              </div>

              <div className={`a-option-row${form.tracking ? ' a-option-row--on' : ''}`}>
                <div className="a-option-copy">
                  <span className="a-option-title">پیگیری موجودی</span>
                  <span className="a-option-desc">جلوگیری از فروش در صورت اتمام موجودی</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.tracking}
                  className="a-switch"
                  onClick={() => set('tracking', !form.tracking)}
                />
              </div>

              <div>
                <label className="a-field">
                  <span className="a-label">روبان / برچسب روی عکس</span>
                  <input className="a-input" placeholder="مثال: پرفروش" value={form.ribbon} onChange={(e) => set('ribbon', e.target.value)} />
                </label>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
