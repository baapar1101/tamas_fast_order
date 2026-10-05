import type { ProductForm } from '../types';
import { ProductAccordionSection } from '../ProductAccordionSection';
import { formatNumber } from '@tamas/shared';

interface Props {
  form: ProductForm;
  set: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
}

export function ShippingSection({ form, set }: Props) {
  return (
    <ProductAccordionSection
      id="pe-shipping-section"
      title="حمل و نقل"
      summary={form.weight ? `${formatNumber(form.weight)} گرم${form.dimensions ? ` · ${form.dimensions}` : ''}` : 'وزن و ابعاد ثبت نشده'}
    >
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
    </ProductAccordionSection>
  );
}
