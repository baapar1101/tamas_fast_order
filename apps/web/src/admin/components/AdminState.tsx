import type { ReactNode } from 'react';

/**
 * Loading / empty / filtered-empty / error states for admin views.
 * Contract and copy rules: docs/ui-guidelines.md §5.
 */
export type AdminStateKind = 'loading' | 'empty' | 'filtered' | 'error';

interface AdminStateProps {
  kind: AdminStateKind;
  /** Persian noun for the entity, e.g. «سفارش», «محصول», «دسته». Builds the default copy. */
  noun?: string;
  title?: ReactNode;
  text?: ReactNode;
  /** Error object or message for kind="error". */
  error?: unknown;
  onRetry?: () => void;
  /** Extra action, e.g. «پاک کردن فیلترها» or a create button. */
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

/** «سفارش» → «سفارشی», «دسته» → «دسته‌ای», «کالا» → «کالایی». */
export function indefinite(noun: string): string {
  const trimmed = noun.trim();
  if (/[هة]$/.test(trimmed)) return `${trimmed}‌ای`;
  if (/[اوآ]$/.test(trimmed)) return `${trimmed}یی`;
  return `${trimmed}ی`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'ارتباط با سرور برقرار نشد.';
}

function defaultTitle(kind: AdminStateKind, noun?: string): string {
  switch (kind) {
    case 'loading':
      return 'در حال دریافت…';
    case 'empty':
      return noun ? `هنوز ${indefinite(noun)} ثبت نشده است.` : 'هنوز موردی ثبت نشده است.';
    case 'filtered':
      return noun ? `${indefinite(noun)} با این فیلتر نیست.` : 'موردی با این فیلتر نیست.';
    case 'error':
      return 'دریافت اطلاعات انجام نشد.';
  }
}

const ICONS: Record<AdminStateKind, ReactNode> = {
  loading: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  ),
  empty: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5h4.5l1.5 2.25h4.5l1.5-2.25h4.5M3.75 13.5 6 5.25h12l2.25 8.25M3.75 13.5v5.25h16.5V13.5" />
    </svg>
  ),
  filtered: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18l-7 8.25v6l-4 1.5v-7.5L3 4.5Z" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.7 2.7 17a2 2 0 0 0 1.74 3h15.12a2 2 0 0 0 1.74-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
    </svg>
  ),
};

export function AdminState({ kind, noun, title, text, error, onRetry, action, compact, className }: AdminStateProps) {
  const isError = kind === 'error';
  const resolvedText = text ?? (isError ? errorMessage(error) : undefined);
  const classes = ['a-state', `a-state--${kind}`, compact ? 'a-state--compact' : '', className ?? ''].filter(Boolean).join(' ');
  const actions = (onRetry || action) && (
    <div className="a-state__action">
      {onRetry && (
        <button type="button" className="a-btn a-btn--outline a-btn--sm" onClick={onRetry}>
          تلاش دوباره
        </button>
      )}
      {action}
    </div>
  );

  return (
    <div className={classes} role={isError ? 'alert' : 'status'} aria-live={isError ? undefined : 'polite'} aria-busy={kind === 'loading' || undefined}>
      <span className="a-state__icon">{ICONS[kind]}</span>
      {isError ? (
        <>
          <div className="a-state__body">
            <p className="a-state__title">{title ?? defaultTitle(kind, noun)}</p>
            {resolvedText && <p className="a-state__text">{resolvedText}</p>}
          </div>
          {actions}
        </>
      ) : (
        <>
          <p className="a-state__title">{title ?? defaultTitle(kind, noun)}</p>
          {resolvedText && <p className="a-state__text">{resolvedText}</p>}
          {actions}
        </>
      )}
    </div>
  );
}

/** The same states rendered as a single full-width table row inside <tbody>. */
export function TableState({ colSpan, ...props }: AdminStateProps & { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="a-state-cell">
        <AdminState compact {...props} />
      </td>
    </tr>
  );
}

/** Placeholder bars while a block loads. */
export function Skeleton({ lines = 3, block = false }: { lines?: number; block?: boolean }) {
  if (block) return <span className="a-skeleton a-skeleton--block" aria-hidden="true" />;
  return (
    <div className="a-skeleton-stack" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="a-skeleton" style={{ width: `${100 - index * 14}%` }} />
      ))}
    </div>
  );
}
