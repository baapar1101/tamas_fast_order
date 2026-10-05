import type { ProductForm } from '../types';
import { ProductAccordionSection } from '../ProductAccordionSection';

interface Props {
  form: ProductForm;
  set: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
}

export function ColorAppearanceSection({ form, set }: Props) {
  return (
    <ProductAccordionSection
      id="pe-color-section"
      title="رنگ و ظاهر"
      summary={form.color || form.colorEn || 'رنگ انتخاب نشده'}
    >
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
    </ProductAccordionSection>
  );
}
