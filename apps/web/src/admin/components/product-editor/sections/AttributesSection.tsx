import React from 'react';
import type { ProductForm, AttributeDef } from '../types';
import { ProductAccordionSection } from '../ProductAccordionSection';
import { ATTR_TYPE_LABELS, MULTI_SEP } from '../utils';

interface Props {
  form: ProductForm;
  set: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
  attributeDefs: AttributeDef[];
  attrByKey: Map<string, AttributeDef>;
}

export function AttributesSection({ form, set, attributeDefs, attrByKey }: Props) {
  const updateAttrKey = (idx: number, key: string) => {
    const cp = [...form.attributes];
    const cur = cp[idx];
    if (!cur) return;
    const prevDef = attrByKey.get(cur.key.trim());
    const nextDef = attrByKey.get(key.trim());
    let value = cur.value;
    if (nextDef && !prevDef && (nextDef.type === 'boolean' || nextDef.type === 'select')) {
      value = nextDef.type === 'boolean' ? 'بله' : '';
    }
    cp[idx] = { ...cur, key, value };
    set('attributes', cp);
  };

  const setAttrValue = (idx: number, value: string) => {
    const cp = [...form.attributes];
    const cur = cp[idx];
    if (!cur) return;
    cp[idx] = { ...cur, value };
    set('attributes', cp);
  };

  const toggleAttrOption = (idx: number, opt: string) => {
    const cp = [...form.attributes];
    const cur = cp[idx];
    if (!cur) return;
    const current = cur.value.split(MULTI_SEP).filter(Boolean);
    const next = current.includes(opt) ? current.filter((o) => o !== opt) : [...current, opt];
    cp[idx] = { ...cur, value: next.join(MULTI_SEP) };
    set('attributes', cp);
  };

  const quickAddAttr = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    if (!name) return;
    if (form.attributes.some((a) => a.key.trim() === name)) return;
    const def = attrByKey.get(name);
    set('attributes', [...form.attributes, { key: name, value: def?.type === 'boolean' ? 'بله' : '' }]);
  };

  return (
    <ProductAccordionSection
      id="pe-attributes-section"
      title="ویژگی‌ها"
      summary={form.attributes.length ? `${form.attributes.length} ویژگی` : 'بدون ویژگی'}
    >
      <div className="pe-accordion-actions">
        {attributeDefs && attributeDefs.length > 0 && (
          <select className="a-select a-select--sm" value="" onChange={quickAddAttr}>
            <option value="">+ افزودن سریع...</option>
            {attributeDefs.filter(d => !form.attributes.some(a => a.key.trim() === d.name.trim())).map(d => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="a-btn a-btn--secondary a-btn--sm"
          onClick={() => set('attributes', [...form.attributes, { key: '', value: '' }])}
        >
          + افزودن ویژگی
        </button>
      </div>

      <div className="space-y-3">
        {form.attributes.length === 0 ? (
          <div className="a-empty">هیچ ویژگی ثبت نشده است.</div>
        ) : (
          form.attributes.map((attr, idx) => {
            const def = attrByKey.get(attr.key.trim());
            return (
              <div key={idx} className={`a-attr-row ${def ? 'a-attr-row--defined' : ''}`}>
                <div className="a-attr-key">
                  <input
                    className="a-input"
                    placeholder="نام ویژگی (مثال: رم)"
                    list="a-attr-names"
                    value={attr.key}
                    onChange={(e) => updateAttrKey(idx, e.target.value)}
                  />
                  {def && (
                    <span className={`a-attr-type ${def.type === 'select' ? 'a-attr-type--select' : ''}`}>
                      {ATTR_TYPE_LABELS[def.type] ?? def.type}
                    </span>
                  )}
                </div>
                <div className="flex-1 w-full min-w-0 relative">
                  {def?.type === 'select' ? (
                    <div className="a-attr-multi">
                      {(def.options ?? []).map((opt) => {
                        const checked = attr.value.split(MULTI_SEP).includes(opt);
                        return (
                          <label key={opt} className={`a-chip-opt ${checked ? 'a-chip-opt--on' : ''}`}>
                            <input type="checkbox" checked={checked} onChange={() => toggleAttrOption(idx, opt)} />
                            <span className="a-chip-opt-copy"><strong>{opt}</strong></span>
                          </label>
                        );
                      })}
                      {(def.options ?? []).length === 0 && (
                        <span className="a-hint">این ویژگی در بخش مدیریت، گزینه‌ای تعریف نشده است.</span>
                      )}
                    </div>
                  ) : def?.type === 'boolean' ? (
                    <div className="a-segmented" role="group" aria-label="بله / خیر">
                      {['بله', 'خیر'].map((b) => (
                        <button
                          key={b}
                          type="button"
                          className={`a-seg ${attr.value === b ? 'a-seg--on' : ''}`}
                          onClick={() => setAttrValue(idx, b)}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  ) : def?.type === 'number' ? (
                    <input
                      className="a-input ltr text-left"
                      inputMode="numeric"
                      dir="ltr"
                      placeholder="مقدار عددی"
                      value={attr.value}
                      onChange={(e) => setAttrValue(idx, e.target.value)}
                    />
                  ) : (
                    <input
                      className="a-input"
                      placeholder="مقدار (مثال: 8 گیگابایت)"
                      value={attr.value}
                      onChange={(e) => setAttrValue(idx, e.target.value)}
                    />
                  )}
                  <button
                    type="button"
                    className="absolute left-1 top-2 w-6 h-6 flex items-center justify-center text-rose-400 hover:bg-rose-500/20 rounded-lg transition"
                    aria-label="حذف ویژگی"
                    onClick={() => {
                      const cp = [...form.attributes];
                      cp.splice(idx, 1);
                      set('attributes', cp);
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {(attributeDefs ?? []).length > 0 && (
        <datalist id="a-attr-names">
          {(attributeDefs ?? []).map((d) => (
            <option key={d.id} value={d.name} />
          ))}
        </datalist>
      )}
    </ProductAccordionSection>
  );
}
