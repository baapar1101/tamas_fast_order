import type { ProductForm } from '../types';
import { ProductAccordionSection } from '../ProductAccordionSection';

interface Props {
  form: ProductForm;
  set: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
}

export function SellTypeSection({ form, set }: Props) {
  return (
    <ProductAccordionSection
      id="pe-sell-type-section"
      title="نحوه فروش"
      description="روش‌های مجاز فروش این محصول"
      summary={form.sellType || 'روش فروش انتخاب نشده'}
    >
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
    </ProductAccordionSection>
  );
}
