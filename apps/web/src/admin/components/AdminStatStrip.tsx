import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { formatNumber, type DashboardStats } from '@tamas/shared';
import { Price } from '../../components/Price';
import { api } from '../../lib/api';

export type StatStripKind = 'users' | 'products' | 'orders';

interface Card {
  label: string;
  tone: 'emerald' | 'cyan' | 'amber' | 'rose';
  icon: string;
  render: (s: DashboardStats) => ReactNode;
  sub?: (s: DashboardStats) => string;
}

const CARDS: Record<StatStripKind, Card[]> = {
  users: [
    { label: 'کل کاربران', tone: 'emerald', icon: 'users', render: (s) => formatNumber(s.userCount), sub: (s) => `${formatNumber(s.activeProductCount)} محصول` },
    { label: 'کاربران جدید (۳۰ روز)', tone: 'cyan', icon: 'spark', render: (s) => formatNumber(s.newUser30) },
    { label: 'کاربران فعال', tone: 'amber', icon: 'check', render: (s) => formatNumber(Math.max(0, s.userCount - s.pendingUserCount)) },
    { label: 'در انتظار فعال‌سازی', tone: 'rose', icon: 'clock', render: (s) => formatNumber(s.pendingUserCount) },
  ],
  products: [
    { label: 'کل محصولات', tone: 'emerald', icon: 'cube', render: (s) => formatNumber(s.productCount) },
    { label: 'محصولات فعال', tone: 'cyan', icon: 'check', render: (s) => formatNumber(s.activeProductCount) },
    { label: 'ناموجود', tone: 'rose', icon: 'x', render: (s) => formatNumber(s.outOfStockCount) },
    { label: 'افزوده‌شده (۳۰ روز)', tone: 'amber', icon: 'plus', render: (s) => formatNumber(s.newProduct30) },
  ],
  orders: [
    { label: 'کل سفارش‌ها', tone: 'emerald', icon: 'bag', render: (s) => formatNumber(s.orderCount) },
    { label: 'سفارش‌های جدید', tone: 'amber', icon: 'inbox', render: (s) => formatNumber(s.newOrderCount) },
    { label: 'درآمد کل', tone: 'cyan', icon: 'coin', render: (s) => <Price amount={s.revenueTotal} /> },
    { label: 'درآمد ۳۰ روز اخیر', tone: 'rose', icon: 'trend', render: (s) => <Price amount={s.revenueLast30Days} /> },
  ],
};

const ICONS: Record<string, string> = {
  users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  spark: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
  check: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  clock: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  cube: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  x: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  plus: 'M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
  bag: 'M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z',
  inbox: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
  coin: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  trend: 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28-5.941',
};

export function AdminStatStrip({ kind }: { kind: StatStripKind }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard-stats'],
    queryFn: async () => {
      const res = await api.get<{ ok: boolean; stats: DashboardStats }>('/admin/stats');
      return res.stats;
    },
    staleTime: 30_000,
  });

  return (
    <section className={`a-stat-strip a-stat-strip--${kind}`} aria-label="آمار">
      {CARDS[kind].map((card) => {
        const value = data ? card.render(data) : null;
        return (
          <article key={card.label} className={`a-stat-card a-stat-card--${card.tone}`}>
            <span className="a-stat-card-ico">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONS[card.icon]} />
              </svg>
            </span>
            <div className="a-stat-card-copy">
              <strong className="a-stat-card-value">
                {isLoading || value === null ? '…' : value}
              </strong>
              <span className="a-stat-card-label">{card.label}</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}