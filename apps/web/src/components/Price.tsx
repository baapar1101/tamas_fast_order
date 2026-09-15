import { formatNumber } from '@tamas/shared';

export function Price({ amount, className = '' }: { amount: number | null | undefined; className?: string }) {
  if (amount == null) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {formatNumber(amount)}
      <img src="/toman.svg" alt="تومان" style={{ width: '1em', height: '1em', verticalAlign: 'middle', opacity: 0.8 }} />
    </span>
  );
}
