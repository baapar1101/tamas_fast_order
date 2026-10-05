import type { ProductForm } from '../types';
import { ProductAccordionSection } from '../ProductAccordionSection';

interface Props {
  form: ProductForm;
  set: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
}

export function SettingsSection({ form, set }: Props) {
  return (
    <ProductAccordionSection
      id="pe-settings-section"
      title="تنظیمات"
      summary={`${form.status === 'active' ? 'فعال' : 'غیرفعال'}${form.promotion ? ' · پیشنهاد ویژه' : ''}`}
    >
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
    </ProductAccordionSection>
  );
}
