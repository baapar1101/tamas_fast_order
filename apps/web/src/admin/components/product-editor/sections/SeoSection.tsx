import type { ProductForm } from '../types';
import { ProductAccordionSection } from '../ProductAccordionSection';

interface Props {
  form: ProductForm;
  set: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
}

export function SeoSection({ form, set }: Props) {
  return (
    <ProductAccordionSection
      id="pe-seo-section"
      title="موتورهای جستجو (SEO)"
      summary={form.slug ? `/${form.slug}` : 'نامک ثبت نشده'}
    >
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
    </ProductAccordionSection>
  );
}
