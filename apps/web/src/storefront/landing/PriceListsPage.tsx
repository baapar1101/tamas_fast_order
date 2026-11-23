import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Lock, Search } from 'lucide-react';
import { formatMoney, formatNumber, type PriceListDTO, type PriceListSummary } from '@tamas/shared';
import { api } from '../../lib/api';
import { useAuth } from '../../store/auth';
import { cartCount, useCart } from '../../store/cart';
import { cn } from '../../components/ui/cn';
import { useInjectedStyles } from '../../components/ui/useInjectedStyles';
import { AuthDialog } from '../AuthDialog';
import { StoreFooter } from '../StoreFooter';
import { MobileAppNavigation } from '../MobileAppNavigation';
import { LandingHeader } from './LandingPage';
import { SHOP_PATH } from './shopLinks';
import landingCss from './landing.css?inline';

export const PRICE_LISTS_PATH = '/prices';

function formatMoment(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

async function downloadExcel(list: PriceListDTO) {
  const XLSX = await import('@e965/xlsx');
  const rows: unknown[][] = [['برند', 'کالا', 'رنگ', 'قیمت (تومان)', 'وضعیت']];
  for (const group of list.groups) {
    for (const row of group.rows) rows.push([group.brand, row.title, row.color ?? '', row.price ?? '', row.inStock ? 'موجود' : 'ناموجود']);
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 14 }, { wch: 48 }, { wch: 14 }, { wch: 16 }, { wch: 10 }];
  const book = XLSX.utils.book_new();
  book.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(book, sheet, 'قیمت');
  XLSX.writeFile(book, `${list.title}.xlsx`);
}

/**
 * Public price lists (mobile, original accessories, …) straight from the
 * site's current prices: a change in the panel or the Excel update shows here
 * on the next refresh (every minute while the page is open).
 */
export function PriceListsPage() {
  const ready = useInjectedStyles('landing', landingCss);
  const navigate = useNavigate();
  const { user } = useAuth();
  const lines = useCart((state) => state.lines);
  const [params, setParams] = useSearchParams();
  const [authOpen, setAuthOpen] = useState(false);
  const [search, setSearch] = useState('');

  const summaries = useQuery({
    queryKey: ['price-lists'],
    queryFn: ({ signal }) => api.get<{ lists: PriceListSummary[] }>('/catalog/price-lists', undefined, signal),
    select: (data) => data.lists,
    staleTime: 60_000,
  });
  const lists = summaries.data ?? [];
  const activeId = params.get('list') ?? lists[0]?.id ?? '';
  const list = useQuery({
    queryKey: ['price-list', activeId, user?.id ?? null],
    queryFn: ({ signal }) => api.get<{ list: PriceListDTO }>(`/catalog/price-lists/${encodeURIComponent(activeId)}`, undefined, signal),
    select: (data) => data.list,
    enabled: Boolean(activeId),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const previous = document.title;
    document.title = `${list.data?.title ?? 'لیست قیمت'} | تماس مارکت`;
    return () => { document.title = previous; };
  }, [list.data?.title]);

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = list.data?.groups ?? [];
    if (!needle) return all;
    return all
      .map((group) => ({ ...group, rows: group.rows.filter((row) => `${group.brand} ${row.title} ${row.color ?? ''}`.toLowerCase().includes(needle)) }))
      .filter((group) => group.rows.length);
  }, [list.data, search]);
  const total = (list.data?.groups ?? []).reduce((sum, group) => sum + group.rows.length, 0);

  if (!ready) return null;

  return (
    <>
      <div className="tg-root tg-store lp-page min-h-screen">
        <LandingHeader onLogin={() => setAuthOpen(true)} />
        <main>
          <section className="bg-gradient-to-l from-[#0b1220] via-[#0f2a44] to-[#0b1220] pb-8 pt-28 text-white md:pt-32">
            <div className="mx-auto max-w-5xl px-4">
              <h1 className="text-3xl font-black md:text-4xl">لیست قیمت</h1>
              <p className="mt-2 text-sm text-slate-300">
                قیمت‌ها مستقیم از سایت خوانده می‌شود و با هر تغییر قیمت به‌روز است
                {list.data?.updatedAt ? ` · آخرین تغییر: ${formatMoment(list.data.updatedAt)}` : ''}.
              </p>
              {lists.length > 1 && (
                <div className="mt-5 flex flex-wrap gap-2" role="tablist">
                  {lists.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={item.id === activeId}
                      onClick={() => { setParams({ list: item.id }); setSearch(''); }}
                      className={cn('rounded-xl px-4 py-2 text-sm font-bold transition', item.id === activeId ? 'bg-cyan-400 text-slate-950' : 'bg-white/10 text-white hover:bg-white/15')}
                    >
                      {item.title} <span className="opacity-70">({formatNumber(item.count)})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="mx-auto max-w-5xl px-4 py-6 md:py-8">
            {!summaries.isLoading && !lists.length && (
              <div className="py-16 text-center">
                <p className="text-lg font-bold text-title-50">فعلاً لیست قیمتی منتشر نشده است.</p>
                <Link to={SHOP_PATH} className="mt-4 inline-block rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-bold text-white">رفتن به فروشگاه</Link>
              </div>
            )}

            {list.data && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="relative min-w-56 flex-1">
                    <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-text-200" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={`جست‌وجو در ${formatNumber(total)} کالا…`}
                      aria-label="جست‌وجو در لیست قیمت"
                      className="w-full rounded-xl border border-base-100 bg-card-background-50 py-2.5 ps-9 pe-3 text-sm text-title-50 outline-none focus:border-primary-500"
                    />
                  </label>
                  {!list.data.pricesHidden && (
                    <button type="button" onClick={() => void downloadExcel(list.data!)} className="inline-flex items-center gap-2 rounded-xl border border-base-100 bg-card-background-50 px-4 py-2.5 text-sm font-bold text-title-50 hover:border-primary-500">
                      <Download className="size-4" /> دانلود اکسل
                    </button>
                  )}
                </div>

                {list.data.pricesHidden && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                    <span className="inline-flex items-center gap-2"><Lock className="size-4" /> قیمت‌ها فقط برای همکاران تأییدشده نمایش داده می‌شود.</span>
                    {!user && <button type="button" onClick={() => setAuthOpen(true)} className="rounded-xl bg-amber-600 px-4 py-2 font-bold text-white">ورود / ثبت‌نام همکار</button>}
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-5">
                  {groups.map((group) => (
                    <div key={group.brand} className="overflow-hidden rounded-2xl border border-base-100 bg-card-background-50">
                      <h2 className="border-b border-base-100 bg-background-soft-100/50 px-4 py-2.5 font-black text-title-50">{group.brand}</h2>
                      <table className="w-full text-sm">
                        <tbody>
                          {group.rows.map((row) => (
                            <tr key={row.productId} className="border-b border-base-100 last:border-0">
                              <td className="px-4 py-2.5">
                                <Link to={`/p/${row.productId}`} className="font-medium text-title-50 hover:text-primary-500">{row.title}</Link>
                                {row.color && <span className="ms-2 text-xs text-text-200">{row.color}</span>}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-end font-black tabular-nums text-title-50">
                                {!row.inStock ? <span className="text-xs font-medium text-text-200">ناموجود</span>
                                  : row.price == null ? <Lock className="ms-auto size-4 text-text-200" aria-label="قیمت پس از ورود" />
                                    : formatMoney(row.price)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  {!groups.length && <p className="py-10 text-center text-text-200">کالایی پیدا نشد.</p>}
                </div>
              </>
            )}
          </section>
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
        accountReturnTo={PRICE_LISTS_PATH}
        profileLabel={user ? undefined : 'ورود / عضویت'}
        onSelect={(tab) => { if (tab === 'profile' && !user) setAuthOpen(true); }}
      />
      <AuthDialog
        open={authOpen}
        initialStep="phone"
        onClose={() => setAuthOpen(false)}
        onOpenCredit={() => navigate('/account/credit', { state: { returnTo: PRICE_LISTS_PATH } })}
        onReady={() => setAuthOpen(false)}
      />
    </>
  );
}
