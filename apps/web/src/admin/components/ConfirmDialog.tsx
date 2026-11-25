import type { ReactNode } from 'react';
import { Modal } from '../../components/Modal';

/**
 * Confirmation dialog — docs/ui-guidelines.md §4.8.
 * The confirm button names the exact verb («حذف», «برداشتن», «لغو لینک»), never
 * «بله/تأیید»; cancel is «انصراف». Destructive actions say whether they can be undone.
 */
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  /** Exact verb for the confirming action. */
  confirmLabel?: string;
  /** Progressive label while busy; defaults to «در حال {confirmLabel}…». */
  busyLabel?: string;
  cancelLabel?: string;
  /** `danger` for destructive work, `primary` for everything else. */
  tone?: 'danger' | 'primary';
  /** Secondary line under the description. Pass `null` to hide it. */
  hint?: ReactNode;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'حذف',
  busyLabel,
  cancelLabel = 'انصراف',
  tone = 'danger',
  hint = 'این عملیات در گزارش فعالیت‌های مدیریت ثبت می‌شود.',
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const progress = busyLabel ?? `در حال ${confirmLabel}…`;
  return (
    <Modal
      open={open}
      size="sm"
      title={title}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={`a-btn ${tone === 'danger' ? 'a-btn--danger' : 'a-btn--primary'}`}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={onConfirm}
            autoFocus
          >
            {busy ? progress : confirmLabel}
          </button>
          <button type="button" className="a-btn a-btn--secondary" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </button>
        </>
      }
    >
      <div className="a-confirm">
        <span className={`a-confirm__icon${tone === 'danger' ? '' : ' a-confirm__icon--neutral'}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {tone === 'danger' ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.7 2.7 17a2 2 0 0 0 1.74 3h15.12a2 2 0 0 0 1.74-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
            )}
          </svg>
        </span>
        <div>
          <p className="a-confirm__text">{description}</p>
          {hint !== null && <p className="a-confirm__hint">{hint}</p>}
        </div>
      </div>
    </Modal>
  );
}
