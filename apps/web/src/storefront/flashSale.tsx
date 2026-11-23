import { useEffect, useId, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNumber, type FlashSaleShowcase } from '@tamas/shared';
import { api } from '../lib/api';
import { cn } from '../components/ui/cn';
import './flashSale.css';

export const FLASH_SALE_PATH = '/flash-sale';
export const FLASH_SALE_QUERY_KEY = ['flash-sale'];

/** The daily sale, or null when the admin has it off. Shared by the home section, the page and the tabs. */
export function useFlashSale() {
  return useQuery({
    queryKey: FLASH_SALE_QUERY_KEY,
    queryFn: ({ signal }) => api.get<{ sale: FlashSaleShowcase | null }>('/catalog/flash-sale', undefined, signal),
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
    select: (data) => data.sale,
  });
}

export function pad(value: number): string {
  return formatNumber(value).padStart(2, '۰');
}

export interface SaleClock {
  hours: number;
  minutes: number;
  seconds: number;
  /** Share of the sale window still left: 1 before it starts, 0 at its end. */
  remaining: number;
}

/**
 * Ticks every second towards the sale's start (or end while it runs),
 * corrected for the gap between this device's clock and the server's, and
 * refreshes the sale when the target passes.
 */
export function useSaleClock(sale: FlashSaleShowcase): SaleClock {
  const queryClient = useQueryClient();
  const [skew] = useState(() => Date.parse(sale.serverTime) - Date.now());
  const target = Date.parse(sale.active ? sale.endsAt : sale.startsAt);
  const windowMs = Math.max(1, Date.parse(sale.endsAt) - Date.parse(sale.startsAt));
  const [now, setNow] = useState(() => Date.now() + skew);
  useEffect(() => {
    let fired = false;
    const tick = () => {
      const current = Date.now() + skew;
      setNow(current);
      if (current >= target && !fired) {
        fired = true;
        void queryClient.invalidateQueries({ queryKey: FLASH_SALE_QUERY_KEY });
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [target, skew, queryClient]);
  const left = Math.max(0, target - now);
  const total = Math.floor(left / 1000);
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    remaining: sale.active ? Math.min(1, left / windowMs) : 1,
  };
}

/**
 * An hourglass whose top bulb holds the share of the sale still left. While
 * the sale runs, a thin stream falls; before it starts, the glass waits full.
 */
export function Hourglass({ remaining, running, className }: { remaining: number; running: boolean; className?: string }) {
  const id = useId().replace(/:/g, '');
  const top = Math.max(0, Math.min(1, remaining));
  // Top bulb: sand surface drops from y=14 (full) to y=58 (empty).
  const topSurface = 14 + (1 - top) * 44;
  // Bottom bulb: the pile rises from y=110 (empty) to y=70 (full).
  const bottomSurface = 110 - (1 - top) * 40;
  return (
    <svg viewBox="0 0 80 124" className={cn('hourglass', running ? 'hourglass--running' : 'hourglass--idle', className)} role="img" aria-label={`ساعت شنی: ${formatNumber(Math.round(top * 100))}٪ از زمان فروش ویژه باقی است`}>
      <defs>
        <clipPath id={`${id}-top`}><path d="M14 10 H66 C66 34 46 46 41 60 H39 C34 46 14 34 14 10 Z" /></clipPath>
        <clipPath id={`${id}-bottom`}><path d="M39 64 H41 C46 78 66 90 66 114 H14 C14 90 34 78 39 64 Z" /></clipPath>
        <linearGradient id={`${id}-sand`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect x="6" y="2" width="68" height="8" rx="3" fill="currentColor" opacity=".9" />
      <rect x="6" y="114" width="68" height="8" rx="3" fill="currentColor" opacity=".9" />
      <path d="M14 10 H66 C66 34 46 46 41 60 H39 C34 46 14 34 14 10 Z M39 64 H41 C46 78 66 90 66 114 H14 C14 90 34 78 39 64 Z" fill="rgba(255,255,255,.14)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <g clipPath={`url(#${id}-top)`}>
        <rect className="hourglass-sand" x="0" y={topSurface} width="80" height={62 - topSurface} fill={`url(#${id}-sand)`} />
      </g>
      <g clipPath={`url(#${id}-bottom)`}>
        <path className="hourglass-sand" d={`M8 116 L8 ${bottomSurface + 6} Q40 ${bottomSurface - 6} 72 ${bottomSurface + 6} L72 116 Z`} fill={`url(#${id}-sand)`} />
      </g>
      {running && top > 0 && <rect className="hourglass-stream" x="39.25" y="58" width="1.5" height={Math.max(4, bottomSurface - 56)} fill="#fbbf24" />}
    </svg>
  );
}

/** Header pill: shown only while the admin has the sale on; counts down live when it runs. */
export function FlashSaleTab({ className }: { className?: string }) {
  const { data: sale } = useFlashSale();
  const location = useLocation();
  if (!sale) return null;
  return <FlashSaleTabLink sale={sale} current={location.pathname === FLASH_SALE_PATH} className={className} />;
}

function FlashSaleTabLink({ sale, current, className }: { sale: FlashSaleShowcase; current: boolean; className?: string }) {
  const clock = useSaleClock(sale);
  return (
    <Link
      to={FLASH_SALE_PATH}
      className={cn('flash-sale-tab', sale.active && 'flash-sale-tab--live', className)}
      aria-current={current ? 'page' : undefined}
    >
      <Hourglass remaining={clock.remaining} running={sale.active} className="flash-sale-tab-glass" />
      <span>فروش ویژه</span>
      <span className="flash-sale-tab-time" dir="ltr">
        {sale.active ? `${pad(clock.hours)}:${pad(clock.minutes)}:${pad(clock.seconds)}` : `${formatNumber(sale.startHour)}:۰۰`}
      </span>
    </Link>
  );
}
