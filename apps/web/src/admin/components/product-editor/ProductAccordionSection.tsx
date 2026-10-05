import { useState } from 'react';
import type { ProductAccordionSectionProps } from './types';

export function ProductAccordionSection({
  id,
  title,
  description,
  summary,
  className = '',
  defaultOpen = false,
  children,
}: ProductAccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const triggerId = `${id}-trigger`;
  const panelId = `${id}-panel`;

  return (
    <section className={`a-card pe-accordion${open ? ' pe-accordion--open' : ''}${className ? ` ${className}` : ''}`}>
      <h3 className="pe-accordion-heading">
        <button
          id={triggerId}
          type="button"
          className="pe-accordion-trigger"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="pe-accordion-copy">
            <span className="a-card-title">{title}</span>
            {description && <span className="a-card-sub">{description}</span>}
          </span>
          {summary && <span className="pe-accordion-summary">{summary}</span>}
          <svg className="pe-accordion-chevron" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h3>
      {open && (
        <div id={panelId} className="pe-accordion-panel" role="region" aria-labelledby={triggerId}>
          {children}
        </div>
      )}
    </section>
  );
}
