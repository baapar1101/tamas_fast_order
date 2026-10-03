import type { ReactNode } from 'react';
import { Modal } from '../../components/Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'حذف',
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      size="sm"
      title={title}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="a-btn a-btn--danger" disabled={busy} onClick={onConfirm} autoFocus>
            {busy ? 'در حال حذف...' : confirmLabel}
          </button>
          <button type="button" className="a-btn a-btn--secondary" disabled={busy} onClick={onClose}>
            انصراف
          </button>
        </>
      }
    >
      <div className="a-confirm">
        <span className="a-confirm__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.7 2.7 17a2 2 0 0 0 1.74 3h15.12a2 2 0 0 0 1.74-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
          </svg>
        </span>
        <div>
          <p className="a-confirm__text">{description}</p>
          <p className="a-confirm__hint">این عملیات در گزارش فعالیت‌های مدیریت ثبت می‌شود.</p>
        </div>
      </div>
    </Modal>
  );
}
