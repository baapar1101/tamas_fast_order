import type { ProductForm } from '../types';
import { ProductAccordionSection } from '../ProductAccordionSection';
import { BundleItemSelect } from '../BundleItemSelect';
import { formatNumber } from '@tamas/shared';

interface Props {
  form: ProductForm;
  set: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
}

export function BundleItemsSection({ form, set }: Props) {
  return (
    <ProductAccordionSection
      id="pe-bundle-section"
      title="محصولات باندل / قطعات"
      description="موجودی باندل بر اساس محصولات انتخاب‌شده کسر می‌شود"
      summary={form.bundleItems.length ? `${formatNumber(form.bundleItems.length)} قلم` : 'بدون قطعه'}
    >
      <div className="p-4 flex flex-col gap-4">
        {form.bundleItems.map((item, idx) => (
          <div key={idx} className="pe-bundle-row">
            <div className="pe-bundle-product">
              <label className="a-label text-xs">شناسه کالا (Product ID) یا جستجو</label>
              <BundleItemSelect
                value={item.productId}
                onChange={(val) => {
                  const copy = [...form.bundleItems];
                  if (copy[idx]) {
                    copy[idx]!.productId = val;
                    set('bundleItems', copy);
                  }
                }}
              />
            </div>
            <div className="pe-bundle-qty">
              <label className="a-label text-xs">تعداد</label>
              <input
                type="number"
                min="1"
                className="a-input text-center"
                value={item.qty}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1;
                  const copy = [...form.bundleItems];
                  if (copy[idx]) {
                    copy[idx]!.qty = val;
                    set('bundleItems', copy);
                  }
                }}
              />
            </div>
            <div className="pe-bundle-actions pt-5">
              <button
                type="button"
                className="a-btn a-btn--danger a-btn--sm"
                title="حذف قطعه"
                onClick={() => {
                  const copy = [...form.bundleItems];
                  copy.splice(idx, 1);
                  set('bundleItems', copy);
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        <div>
          <button
            type="button"
            className="a-btn a-btn--secondary a-btn--sm"
            onClick={() => set('bundleItems', [...form.bundleItems, { productId: '', qty: 1 }])}
          >
            + افزودن کالا به باندل
          </button>
        </div>
      </div>
    </ProductAccordionSection>
  );
}
