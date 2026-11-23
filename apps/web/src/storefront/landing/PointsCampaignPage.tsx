import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Gift, ScrollText, Star, Trophy } from 'lucide-react';
import { formatNumber, type PointsCampaignShowcase, type ProductGroupDTO } from '@tamas/shared';
import { api } from '../../lib/api';
import { resolveImageUrl, useImageFallback } from '../../lib/images';
import { useAuth } from '../../store/auth';
import { cartCount, useCart } from '../../store/cart';
import { cn } from '../../components/ui/cn';
import { useInjectedStyles } from '../../components/ui/useInjectedStyles';
import { AuthDialog } from '../AuthDialog';
import { StoreFooter } from '../StoreFooter';
import { MobileAppNavigation } from '../MobileAppNavigation';
import { POINTS_CAMPAIGN_PATH, usePointsCampaign } from '../pointsCampaign';
import { pad } from '../flashSale';
import { LandingHeader } from './LandingPage';
import { SHOP_PATH } from './shopLinks';
import landingCss from './landing.css?inline';

const MEDALS = ['🥇', '🥈', '🥉'];

function useClock(campaign: PointsCampaignShowcase) {
  const [skew] = useState(() => Date.parse(campaign.serverTime) - Date.now());
  const [now, setNow] = useState(() => Date.now() + skew);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() + skew), 1000);
    return () => window.clearInterval(timer);
  }, [skew]);
  const target = campaign.phase === 'upcoming' ? campaign.startsAt : campaign.phase === 'running' ? campaign.endsAt : null;
  const left = target ? Math.max(0, Date.parse(target) - now) : 0;
  const total = Math.floor(left / 1000);
  return {
    target,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function Countdown({ campaign }: { campaign: PointsCampaignShowcase }) {
  const clock = useClock(campaign);
  if (!clock.target) return null;
  const parts: Array<[number, string]> = [[clock.days, 'روز'], [clock.hours, 'ساعت'], [clock.minutes, 'دقیقه'], [clock.seconds, 'ثانیه']];
  return (
    <div className="flex flex-col items-center gap-2 md:items-end">
      <span className="text-sm font-medium text-violet-100/90">{campaign.phase === 'upcoming' ? 'تا شروع کمپین' : 'تا پایان کمپین'}</span>
      <div className="flex gap-2" dir="ltr" role="timer" aria-live="off">
        {parts.map(([value, label]) => (
          <div key={label} className="grid min-w-16 place-items-center rounded-2xl border border-white/15 bg-black/25 px-3 py-2 backdrop-blur">
            <span className="text-2xl font-black tabular-nums text-white md:text-4xl">{pad(value)}</span>
            <span className="text-[11px] text-violet-100/80">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatMoment(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

/** Rows whose points went up since the last poll flash briefly. */
function useChangedRows(campaign: PointsCampaignShowcase | null | undefined): Set<string> {
  const previous = useRef(new Map<string, number>());
  const [changed, setChanged] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!campaign) return;
    const next = new Map(campaign.leaderboard.map((row) => [`${row.name}|${row.phone}`, row.points]));
    const moved = new Set([...next].filter(([key, points]) => previous.current.has(key) && previous.current.get(key) !== points).map(([key]) => key));
    previous.current = next;
    setChanged(moved);
  }, [campaign]);
  return changed;
}

function Leaderboard({ campaign }: { campaign: PointsCampaignShowcase }) {
  const changed = useChangedRows(campaign);
  return (
    <div className="rounded-3xl border border-base-100 bg-card-background-50 p-4 shadow-sm md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-black text-title-50 md:text-xl"><Trophy className="size-5 text-amber-500" /> جدول امتیازها</h2>
        {campaign.phase === 'running' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-300">
            <span className="campaign-live-dot size-2 rounded-full bg-rose-500" /> زنده · {formatNumber(campaign.participants)} شرکت‌کننده
          </span>
        )}
      </div>
      {campaign.leaderboard.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-200">
          {campaign.phase === 'upcoming' ? 'جدول با شروع کمپین و اولین سفارش‌ها پر می‌شود.' : 'هنوز کسی امتیاز نگرفته است؛ اولین نفر باشید!'}
        </p>
      ) : (
        <ol className="mt-4 flex flex-col gap-2">
          {campaign.leaderboard.map((row) => (
            <li
              key={`${row.rank}-${row.phone}`}
              className={cn(
                'flex items-center gap-3 rounded-2xl border px-3 py-2.5',
                row.rank === 1 ? 'border-amber-400/60 bg-amber-400/10' : 'border-base-100 bg-background-soft-100/40',
                changed.has(`${row.name}|${row.phone}`) && 'campaign-row-changed',
              )}
            >
              <span className="grid w-9 shrink-0 place-items-center text-lg font-black text-title-50">{MEDALS[row.rank - 1] ?? formatNumber(row.rank)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-title-50">{row.name}</span>
                <span className="block text-xs text-text-200" dir="ltr">{row.phone}</span>
              </span>
              <span className="shrink-0 rounded-xl bg-violet-600/10 px-3 py-1 text-sm font-black tabular-nums text-violet-700 dark:text-violet-300">{formatNumber(row.points)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MyStanding({ campaign, onLogin }: { campaign: PointsCampaignShowcase; onLogin: () => void }) {
  if (!campaign.me) {
    return (
      <div className="rounded-3xl border border-violet-400/30 bg-violet-600/5 p-5 text-center">
        <p className="font-bold text-title-50">برای دیدن امتیاز خودتان وارد شوید.</p>
        <button type="button" onClick={onLogin} className="mt-3 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white">ورود / ثبت‌نام همکار</button>
      </div>
    );
  }
  const leader = campaign.leaderboard[0]?.points ?? 0;
  return (
    <div className="rounded-3xl border border-violet-400/30 bg-gradient-to-l from-violet-600/10 to-fuchsia-600/10 p-5">
      <p className="text-sm text-text-200">امتیاز شما</p>
      <p className="mt-1 text-4xl font-black tabular-nums text-violet-700 dark:text-violet-300">{formatNumber(campaign.me.points)}</p>
      <p className="mt-2 text-sm text-title-50">
        {campaign.me.rank
          ? campaign.me.rank === 1 ? 'شما الان نفر اول هستید! 🎉' : `رتبهٔ شما: ${formatNumber(campaign.me.rank)} از ${formatNumber(campaign.participants)} · ${formatNumber(Math.max(0, leader - campaign.me.points))} امتیاز تا نفر اول`
          : 'با اولین سفارش پرداخت‌شده یا تحویل‌شده وارد جدول می‌شوید.'}
      </p>
      {campaign.me.points > 0 && campaign.lotteryWinners > 0 && (
        <p className="mt-1 text-xs text-text-200">در قرعه‌کشی، هر امتیاز یک شانس است: شما {formatNumber(campaign.me.points)} شانس دارید.</p>
      )}
    </div>
  );
}

function CampaignProducts() {
  const query = useQuery({
    queryKey: ['catalog', 'campaign-products'],
    queryFn: ({ signal }) => api.get<{ groups: ProductGroupDTO[]; total: number }>('/catalog/products', { campaignPoints: true, perPage: 24, sort: 'featured' }, signal),
    staleTime: 60_000,
  });
  const groups = query.data?.groups ?? [];
  if (!groups.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-12" aria-labelledby="campaign-products-title">
      <h2 id="campaign-products-title" className="mb-4 flex items-center gap-2 text-xl font-black text-title-50"><Star className="size-5 text-violet-500" /> کالاهای امتیازدار</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 xl:grid-cols-6">
        {groups.map((group) => {
          const product = group.variants[0]!;
          const points = Math.max(...group.variants.map((variant) => variant.campaignPoints ?? 0));
          return (
            <Link key={group.key} to={`/p/${product.productId}`} className="group flex flex-col overflow-hidden rounded-2xl border border-base-100 bg-card-background-50 transition hover:-translate-y-1 hover:border-violet-400 hover:shadow-xl">
              <div className="relative m-2 overflow-hidden rounded-xl bg-white">
                <span className="absolute start-2 top-2 z-[1] rounded-full bg-gradient-to-l from-violet-700 to-fuchsia-600 px-2.5 py-1 text-xs font-black text-amber-100">★ {formatNumber(points)} امتیاز</span>
                <img src={resolveImageUrl(group.imageUrl ?? product.imageUrl)} alt={group.title} loading="lazy" onError={useImageFallback} className="aspect-square w-full object-contain p-4 transition duration-300 group-hover:scale-105" />
              </div>
              <h3 className="line-clamp-2 px-4 pb-4 text-sm font-bold leading-6 text-title-50">{group.title}</h3>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The points campaign page (for example «یلدای تماس مارکت»): prizes, a live
 * leaderboard, the customer's own standing, the rules and the products that
 * earn points; after the draw, the winners.
 */
export function PointsCampaignPage() {
  const ready = useInjectedStyles('landing', landingCss);
  const navigate = useNavigate();
  const { user } = useAuth();
  const lines = useCart((state) => state.lines);
  const { data: campaign, isLoading } = usePointsCampaign();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    const previous = document.title;
    document.title = `${campaign?.title ?? 'کمپین امتیاز'} | تماس مارکت`;
    return () => { document.title = previous; };
  }, [campaign?.title]);

  if (!ready) return null;

  return (
    <>
      <div className="tg-root tg-store lp-page min-h-screen">
        <LandingHeader onLogin={() => setAuthOpen(true)} />
        <main>
          <section className="relative overflow-hidden bg-gradient-to-l from-[#3b0764] via-[#581c87] to-[#7f1d1d] pb-10 pt-28 text-white md:pb-14 md:pt-32">
            <div className="pointer-events-none absolute -end-24 -top-24 size-96 rounded-full bg-fuchsia-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -start-20 size-80 rounded-full bg-rose-500/20 blur-3xl" />
            <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 text-center md:flex-row md:justify-between md:text-start">
              <div className="flex flex-col items-center md:items-start">
                {campaign && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                    {campaign.phase === 'running' ? <><span className="campaign-live-dot size-2 rounded-full bg-amber-300" /> در حال برگزاری</>
                      : campaign.phase === 'upcoming' ? `شروع: ${formatMoment(campaign.startsAt)}`
                        : campaign.phase === 'ended' ? 'کمپین به پایان رسید' : 'به‌زودی'}
                  </span>
                )}
                <h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">{campaign?.title ?? 'کمپین امتیاز'}</h1>
                {campaign?.subtitle && <p className="mt-3 max-w-xl text-sm leading-7 text-violet-50/90 md:text-base">{campaign.subtitle}</p>}
                {campaign?.endsAt && campaign.phase !== 'ended' && (
                  <p className="mt-2 text-sm text-violet-100/80">پایان: {formatMoment(campaign.endsAt)}</p>
                )}
              </div>
              {campaign && <Countdown campaign={campaign} />}
            </div>
          </section>

          {isLoading && <p className="py-16 text-center text-text-200">در حال بارگذاری…</p>}
          {!isLoading && !campaign && (
            <div className="mx-auto max-w-md py-16 text-center">
              <p className="text-lg font-bold text-title-50">کمپینی در حال برگزاری نیست.</p>
              <Link to={SHOP_PATH} className="mt-4 inline-block rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-bold text-white">رفتن به فروشگاه</Link>
            </div>
          )}

          {campaign && (
            <>
              <section className="mx-auto grid max-w-7xl gap-4 px-4 py-8 md:grid-cols-3 md:py-10">
                <div className="rounded-3xl border border-amber-400/40 bg-amber-400/10 p-5">
                  <Trophy className="size-8 text-amber-500" />
                  <h2 className="mt-2 font-black text-title-50">جایزهٔ نفر اول، بدون قرعه‌کشی</h2>
                  <p className="mt-1 text-sm leading-7 text-text-100">{campaign.firstPrize || 'به‌زودی اعلام می‌شود'}</p>
                </div>
                <div className="rounded-3xl border border-fuchsia-400/40 bg-fuchsia-500/10 p-5">
                  <Gift className="size-8 text-fuchsia-500" />
                  <h2 className="mt-2 font-black text-title-50">
                    قرعه‌کشی بین همه{campaign.lotteryWinners > 0 ? ` (${formatNumber(campaign.lotteryWinners)} برنده)` : ''}
                  </h2>
                  <p className="mt-1 text-sm leading-7 text-text-100">{campaign.lotteryPrize || 'به‌زودی اعلام می‌شود'} · هر امتیاز یک شانس</p>
                </div>
                <MyStanding campaign={campaign} onLogin={() => setAuthOpen(true)} />
              </section>

              {campaign.winners && (
                <section className="mx-auto max-w-7xl px-4 pb-8" aria-labelledby="winners-title">
                  <div className="rounded-3xl border border-amber-400/50 bg-gradient-to-l from-amber-400/15 to-fuchsia-500/10 p-5 md:p-6">
                    <h2 id="winners-title" className="text-xl font-black text-title-50">🎉 برندگان</h2>
                    <ul className="mt-3 grid gap-2 md:grid-cols-2">
                      {campaign.winners.map((winner) => (
                        <li key={`${winner.kind}-${winner.phone}`} className="flex items-center justify-between gap-3 rounded-2xl bg-card-background-50 px-4 py-3">
                          <span>
                            <strong className="text-title-50">{winner.name}</strong>
                            <span className="ms-2 text-xs text-text-200" dir="ltr">{winner.phone}</span>
                          </span>
                          <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
                            {winner.kind === 'first' ? 'نفر اول' : 'برندهٔ قرعه‌کشی'} · {formatNumber(winner.points)} امتیاز
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-10 lg:grid-cols-[2fr_1fr]">
                <Leaderboard campaign={campaign} />
                <div className="rounded-3xl border border-base-100 bg-card-background-50 p-4 md:p-6">
                  <h2 className="flex items-center gap-2 text-lg font-black text-title-50"><ScrollText className="size-5 text-violet-500" /> قوانین</h2>
                  <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm leading-7 text-text-100">
                    {campaign.rules.map((rule) => <li key={rule}>{rule}</li>)}
                  </ol>
                  <Link to={SHOP_PATH} className="mt-5 block rounded-xl bg-violet-600 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-violet-700">خرید و جمع کردن امتیاز</Link>
                </div>
              </section>

              {campaign.phase !== 'ended' && <CampaignProducts />}
            </>
          )}
        </main>
      </div>

      <StoreFooter />
      <div className="landing-tabbar-spacer" aria-hidden="true" />

      <MobileAppNavigation
        activeTab="home"
        cartItemCount={cartCount(lines)}
        links={{
          home: '/',
          categories: `${SHOP_PATH}?tab=categories`,
          search: `${SHOP_PATH}?tab=search`,
          cart: `${SHOP_PATH}?tab=cart`,
          ...(user ? { profile: '/account' } : {}),
        }}
        accountReturnTo={POINTS_CAMPAIGN_PATH}
        profileLabel={user ? undefined : 'ورود / عضویت'}
        onSelect={(tab) => { if (tab === 'profile' && !user) setAuthOpen(true); }}
      />

      <AuthDialog
        open={authOpen}
        initialStep="phone"
        onClose={() => setAuthOpen(false)}
        onOpenCredit={() => navigate('/account/credit', { state: { returnTo: POINTS_CAMPAIGN_PATH } })}
        onReady={() => setAuthOpen(false)}
      />
    </>
  );
}
