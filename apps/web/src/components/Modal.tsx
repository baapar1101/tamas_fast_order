import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Set while a save is in flight so a stray click cannot close the dialog. */
  busy?: boolean;
  /** Render as a normal page section instead of a focus-trapping overlay. */
  inline?: boolean;
}

export function Modal({ open, title, onClose, children, footer, wide, size, busy, inline = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open || inline) return undefined;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Keep the focus lifecycle tied to opening/closing the modal. Callbacks and
    // busy state can change while a user types (or a parent timer rerenders).
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      const preferred = panelRef.current?.querySelector<HTMLElement>('[autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
      preferred?.focus();
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previous;
      previousFocusRef.current?.focus();
    };
  }, [open, inline]);

  useEffect(() => {
    if (!open || inline) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (!focusable.length) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, busy, inline]);

  if (!open) return null;

  const panel = (
    <div
      ref={panelRef}
      className={`modal-panel modal-panel--${size ?? (wide ? 'lg' : 'md')}${wide ? ' wide' : ''}${inline ? ' modal-panel--inline' : ''}`}
      role={inline ? undefined : 'dialog'}
      aria-modal={inline ? undefined : true}
      aria-labelledby={title !== undefined ? titleId : undefined}
      tabIndex={inline ? undefined : -1}
    >
      {title !== undefined && (
        <div className="modal-head">
          <h3 id={titleId}>{title}</h3>
          {!inline && <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label="بستن پنجره">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>}
        </div>
      )}
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-foot">{footer}</div>}
    </div>
  );

  if (inline) return panel;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      {panel}
    </div>,
    document.body,
  );
}
