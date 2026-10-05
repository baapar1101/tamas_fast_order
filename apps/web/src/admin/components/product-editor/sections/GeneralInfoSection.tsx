import type { ProductDTO } from '@tamas/shared';
import type { ProductForm } from '../types';

interface Props {
  product: ProductDTO | null;
  form: ProductForm;
  set: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
}

export function GeneralInfoSection({ product, form, set }: Props) {
  return (
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
          <input
            id="pe-title"
            className="a-input"
            value={form.title}
            onChange={(e) => {
              const formatted = e.target.value.replace(
                /([a-zA-Z]+)/g,
                (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
              );
              set('title', formatted);
            }}
          />
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
  );
}
