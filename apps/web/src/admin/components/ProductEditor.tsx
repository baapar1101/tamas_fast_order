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
}

interface Props {
  product: ProductDTO | null;
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
});

export function ProductEditor({ product, categories, brands, busy, onClose, onSave }: Props) {
  const [form, setForm] = useState<ProductForm>(product ? fromProduct(product) : blank());
  const [error, setError] = useState('');

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
      // The API treats empty optional strings as null; sending "" would store
      // a blank instead of clearing the column.
      oldPrice: form.oldPrice && form.oldPrice > 0 ? form.oldPrice : null,
    });
  }

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
      <div className="stack">
        {error && <div className="alert error">{error}</div>}

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
            {product && <span className="faint" style={{ fontSize: 11 }}>کد کالا کلید همگام‌سازی با شیت است و تغییر نمی‌کند.</span>}
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
            <span className="faint" style={{ fontSize: 11 }}>
              محصولات با عنوان یکسان در فروشگاه به‌صورت یک کارت با چند رنگ نمایش داده می‌شوند.
            </span>
          </div>

          <div className="field">
            <label htmlFor="f-model">مدل</label>
            <input id="f-model" className="input" value={form.model} onChange={(e) => set('model', e.target.value)} />
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
                <option key={c.id} value={c.name}>
                  {c.faName}
                </option>
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
                <option key={b.id} value={b.name}>
                  {b.faName}
                </option>
              ))}
            </datalist>
            <span className="faint" style={{ fontSize: 11 }}>نام جدید بنویسید تا خودکار ساخته شود.</span>
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
            <label htmlFor="f-stock">موجودی کلی (اگر انبارها صفر باشند)</label>
            <input
              id="f-stock"
              className="input ltr"
              inputMode="numeric"
              value={form.stock}
              onChange={(e) => set('stock', Number(e.target.value.replace(/\D/g, '')) || 0)}
            />
          </div>

          <div className="field">
            <label htmlFor="f-warranty">گارانتی</label>
            <input id="f-warranty" className="input" value={form.warranty} onChange={(e) => set('warranty', e.target.value)} />
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
            <label htmlFor="f-status">وضعیت</label>
            <select id="f-status" className="select" value={form.status} onChange={(e) => set('status', e.target.value as 'active' | 'inactive')}>
              <option value="active">فعال (در فروشگاه دیده می‌شود)</option>
              <option value="inactive">غیرفعال</option>
            </select>
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

          <div className="field full">
            <label>
              <input
                type="checkbox"
                checked={form.promotion}
                onChange={(e) => set('promotion', e.target.checked)}
                style={{ marginInlineEnd: 6 }}
              />
              پیشنهاد ویژه
            </label>
          </div>
        </div>

        <ImagePicker
          label="تصویر اصلی"
          value={form.imageUrl}
          onChange={(url) => set('imageUrl', url)}
          kind="product"
        />

        <div className="field">
          <div className="row" style={{ marginBottom: 6 }}>
            <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-muted)' }}>مشخصات فنی</label>
            <span className="spacer" />
            <button
              type="button"
              className="btn sm"
              onClick={() => set('attributes', [...form.attributes, { key: '', value: '' }])}
            >
              + افزودن ویژگی
            </button>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <datalist id="attrs-list">
              {attributesList.map((a) => (
                <option key={a.id} value={a.name} />
              ))}
            </datalist>
            {form.attributes.map((attr, i) => (
              <div className="row" key={i}>
                <input
                  className="input"
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
                  className="input"
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
                  className="btn ghost sm"
                  onClick={() => set('attributes', form.attributes.filter((_, j) => j !== i))}
                  aria-label="حذف ویژگی"
                >
                  ✕
                </button>
              </div>
            ))}
            {form.attributes.length === 0 && <span className="faint" style={{ fontSize: 12 }}>ویژگی‌ای ثبت نشده است.</span>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
