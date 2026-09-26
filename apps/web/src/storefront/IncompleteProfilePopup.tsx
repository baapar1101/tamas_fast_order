import { useState } from 'react';
import { Icon } from '../components/Icon';

interface Props {
  /** If true, the popup is shown */
  show: boolean;
  /** Called when user clicks "complete profile" */
  onComplete: () => void;
}

/**
 * A native popup overlay shown when the user's profile is incomplete.
 * Shows a clear message + CTA to complete profile + a dismiss/close button.
 * Dismissal is per-session (reappears on next page load).
 */
export function IncompleteProfilePopup({ show, onComplete }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!show || dismissed) return null;

  return (
    <div className="ipp-overlay" onClick={() => setDismissed(true)}>
      <div className="ipp-dialog" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="ipp-close"
          onClick={() => setDismissed(true)}
          aria-label="بستن"
        >
          ✕
        </button>

        <div className="ipp-icon">
          <Icon name="user" />
        </div>

        <h2 className="ipp-title">حساب کاربری شما کامل نیست</h2>

        <p className="ipp-desc">
          برای مشاهده قیمت‌ها و ثبت سفارش، لطفاً اطلاعات حساب کاربری خود را تکمیل کنید.
        </p>

        <div className="ipp-actions">
          <button
            type="button"
            className="btn primary"
            style={{ flex: 1 }}
            onClick={() => {
              setDismissed(true);
              onComplete();
            }}
          >
            تکمیل حساب کاربری
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setDismissed(true)}
          >
            بعداً
          </button>
        </div>
      </div>
    </div>
  );
}
