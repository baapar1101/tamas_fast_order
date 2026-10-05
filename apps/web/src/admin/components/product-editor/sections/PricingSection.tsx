import type { ProductForm } from '../types';
import { ProductAccordionSection } from '../ProductAccordionSection';
import { formatNumber } from '@tamas/shared';

interface Props {
  form: ProductForm;
  set: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
  isBundleMode?: boolean;
}

export function PricingSection({ form, set, isBundleMode }: Props) {
  return (
    <ProductAccordionSection
      id="pe-pricing-section"
      title="قیمت و موجودی"
      summary={form.price ? `${formatNumber(form.price)} تومان` : 'قیمت ثبت نشده'}
      defaultOpen={true}
    >
      <div className="a-form-grid">
        <div className="a-field">
          <label className="a-label" htmlFor="pe-price">قیمت فروش (تومان) *</label>
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
            value={form.oldPrice ?? ''}
            onChange={(e) => set('oldPrice', e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null)}
          />
        </div>
        <div className="a-field a-span-2">
          {isBundleMode ? (
            <div className="a-amber-box">
              در محصولات باندل، موجودی از طریق قطعات زیرمجموعه محاسبه می‌شود.
            </div>
          ) : (
            <div className="a-info-box">
              <p>موجودی کل (برای نمایش به کاربر) جمع انبارهای تهران و کرمان است. در صورت صفر بودن هر دو، از فیلد <strong>«موجودی کل (سایر انبارها)»</strong> استفاده می‌شود.</p>
            </div>
          )}
        </div>
        <div className="a-field">
          <label className="a-label" htmlFor="pe-stock">موجودی کل (سایر انبارها)</label>
          <input
            id="pe-stock"
            className="a-input a-ltr"
            inputMode="numeric"
            value={form.stock}
            onChange={(e) => set('stock', Number(e.target.value.replace(/\D/g, '')))}
            disabled={isBundleMode}
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
            disabled={isBundleMode}
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
            disabled={isBundleMode}
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
    </ProductAccordionSection>
  );
}
