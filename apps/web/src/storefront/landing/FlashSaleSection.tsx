import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Lock, Zap } from 'lucide-react';
import { formatMoney, formatNumber, type FlashSaleShowcase } from '@tamas/shared';
import { api } from '../../lib/api';
import { resolveImageUrl, useImageFallback } from '../../lib/images';
import { cn } from '../../components/ui/cn';
import { Reveal } from './effects';

const QUERY_KEY = ['flash-sale'];

function pad(value: number): string {
  return formatNumber(value).padStart(2, '۰');
}

/** Seconds left until `target`, corrected for the gap between this device's clock and the server's. */
function useCountdown(target: string, serverTime: string, onDone: () => void) {
  const [skew] = useState(() => Date.parse(serverTime) - Date.now());
  const [left, setLeft] = useState(() => Math.max(0, Date.parse(target) - (Date.now() + skew)));
  useEffect(() => {
    const tick = () => {
      const next = Math.max(0, Date.parse(target) - (Date.now() + skew));
      setLeft(next);
      if (next === 0) onDone();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
    // onDone is a refetch and changes identity every render; the target decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, skew]);
  const total = Math.floor(left / 1000);
  return { hours: Math.floor(total / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

function Countdown({ sale }: { sale: FlashSaleShowcase }) {
  const queryClient = useQueryClient();
  const { hours, minutes, seconds } = useCountdown(
    sale.active ? sale.endsAt : sale.startsAt,
    sale.serverTime,
    () => void queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  );
  const parts: Array<[number, string]> = [[hours, 'ساعت'], [minutes, 'دقیقه'], [seconds, 'ثانیه']];
  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <span className="text-sm font-medium text-orange-100/90">{sale.active ? 'تا پایان فروش ویژه' : `تا شروع، ساعت ${formatNumber(sale.startHour)}`}</span>
      <div className="flex gap-2" dir="ltr" role="timer" aria-live="off">
        {parts.map(([value, label]) => (
          <div key={label} className="grid min-w-16 place-items-center rounded-2xl border border-white/15 bg-black/25 px-3 py-2 backdrop-blur">
            <span className="text-2xl font-black tabular-nums text-white md:text-3xl">{pad(value)}</span>
            <span className="text-[11px] text-orange-100/80">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SaleCard({ item, active, startHour, canViewPrices }: { item: FlashSaleShowcase['items'][number]; active: boolean; startHour: number; canViewPrices: boolean }) {
  const { product } = item;
  const soldOut = product.stock <= 0 && product.kermanStock <= 0 && product.tehranStock <= 0;
  return (
    <Link to={`/p/${product.productId}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-base-100 bg-card-background-50 transition hover:-translate-y-1 hover:border-orange-400 hover:shadow-xl">
      <div className="relative m-2 overflow-hidden rounded-xl bg-white">
        <span className="absolute start-2 top-2 z-[1] rounded-full bg-gradient-to-l from-orange-500 to-rose-500 px-2.5 py-1 text-xs font-black text-white">
          {formatNumber(item.percent)}٪ تخفیف
        </span>
        {soldOut && <span className="absolute inset-x-2 bottom-2 z-[1] rounded-lg bg-black/70 py-1 text-center text-xs font-bold text-white">تمام شد</span>}
        <img
          src={resolveImageUrl(product.imageUrl)}
          alt={product.title}
          loading="lazy"
          onError={useImageFallback}
          className={cn('aspect-square w-full object-contain p-4 transition duration-300 group-hover:scale-105', soldOut && 'opacity-50')}
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-1">
        <h3 className="line-clamp-2 text-sm font-bold leading-6 text-title-50">{product.title}</h3>
        {product.color && <span className="text-xs text-text-200">{product.color}</span>}
        <div className="mt-auto pt-2">
          {canViewPrices ? (
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-black text-orange-600 dark:text-orange-400">{formatMoney(item.salePrice)}</span>
              <span className="text-xs text-text-200 line-through">{formatMoney(item.regularPrice)}</span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg bg-background-soft-100 px-2 py-1.5 text-xs font-medium text-text-100"><Lock className="size-3.5" /> قیمت همکاری</span>
          )}
          {!active && <p className="mt-1 text-[11px] text-text-200">این قیمت از ساعت {formatNumber(startHour)} فعال می‌شود</p>}
        </div>
      </div>
    </Link>
  );
}

/**
 * The daily timed sale: hidden when the admin has it off; otherwise shows a
 * countdown to the start or the end and the listed products.
 */
export function FlashSaleSection({ canViewPrices }: { canViewPrices: boolean }) {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: ({ signal }) => api.get<{ sale: FlashSaleShowcase | null }>('/catalog/flash-sale', undefined, signal),
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
  });
  const sale = query.data?.sale;
  if (!sale) return null;

  return (
    <section id="flash-sale" aria-labelledby="flash-sale-title" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-12">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-[#f05a28] via-[#e2401f] to-[#9f1239] p-5 text-white shadow-[0_30px_80px_-30px_rgba(240,90,40,.7)] md:p-8">
          <div className="pointer-events-none absolute -end-16 -top-20 size-72 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                {sale.active ? <><span className="lp-pulse size-2 rounded-full bg-yellow-300" /> در حال برگزاری</> : <><Clock className="size-3.5" /> هر روز ساعت {formatNumber(sale.startHour)} تا {formatNumber(sale.endHour)}</>}
              </span>
              <h2 id="flash-sale-title" className="mt-3 flex items-center gap-2 text-2xl font-black md:text-4xl">
                <Zap className="size-7 fill-yellow-300 text-yellow-300 md:size-9" />
                {sale.title}
              </h2>
              {sale.subtitle && <p className="mt-2 max-w-xl text-sm leading-7 text-orange-50/90 md:text-base">{sale.subtitle}</p>}
            </div>
            <Countdown key={`${sale.active}:${sale.startsAt}`} sale={sale} />
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-6">
            {sale.items.map((item) => (
              <SaleCard key={item.product.productId} item={item} active={sale.active} startHour={sale.startHour} canViewPrices={canViewPrices} />
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
