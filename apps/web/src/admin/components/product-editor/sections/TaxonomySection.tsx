import type { BrandDTO, CategoryDTO } from '@tamas/shared';
import type { ProductForm } from '../types';
import { ProductAccordionSection } from '../ProductAccordionSection';
import { AnimatedDropdown } from '../../AnimatedDropdown';

interface Props {
  form: ProductForm;
  set: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
  categories: CategoryDTO[];
  brands: BrandDTO[];
}

export function TaxonomySection({ form, set, categories, brands }: Props) {
  return (
    <ProductAccordionSection
      id="pe-taxonomy-section"
      title="دسته‌بندی و برند"
      summary={[form.categoryName, form.brandName].filter(Boolean).join(' · ') || 'انتخاب نشده'}
    >
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
    </ProductAccordionSection>
  );
}
