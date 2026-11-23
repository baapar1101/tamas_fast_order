import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { formatNumber } from '@tamas/shared';
import { useAuth } from '../../store/auth';
import { cartCount, useCart } from '../../store/cart';
import { useInjectedStyles } from '../../components/ui/useInjectedStyles';
import { AuthDialog } from '../AuthDialog';
import { StoreFooter } from '../StoreFooter';
import { MobileAppNavigation } from '../MobileAppNavigation';
import { useFlashSale } from '../flashSale';
import { LandingHeader } from './LandingPage';
import { SaleCard, SaleCountdown, SaleStatusBadge, isSoldOut, saleItemsInOrder } from './FlashSaleSection';
import { SHOP_PATH } from './shopLinks';
import landingCss from './landing.css?inline';

/**
 * «۴ ساعت فروش با پَ مَ سود»: the daily sale on its own page, reached from
 * the sale tab in the header and the phone tab bar. A large hourglass drains
 * through the sale window; before the start it waits full.
 */
export function FlashSalePage() {
  const ready = useInjectedStyles('landing', landingCss);
  const navigate = useNavigate();
  const { user } = useAuth();
  const lines = useCart((state) => state.lines);
  const { data: sale, isLoading } = useFlashSale();
  const [authOpen, setAuthOpen] = useState(false);
  const canViewPrices = Boolean(user?.isActive);

  useEffect(() => {
    const previous = document.title;
    document.title = `${sale?.title ?? 'فروش ویژه'} | تماس مارکت`;
    return () => { document.title = previous; };
  }, [sale?.title]);

  if (!ready) return null;
  const items = sale ? saleItemsInOrder(sale) : [];
  const available = items.filter((item) => !isSoldOut(item)).length;

  return (
    <>
      <div className="tg-root tg-store lp-page min-h-screen">
        <LandingHeader onLogin={() => setAuthOpen(true)} />
        <main>
          <section className="relative overflow-hidden bg-gradient-to-l from-[#f05a28] via-[#e2401f] to-[#7f1d1d] pb-10 pt-28 text-white md:pb-14 md:pt-32">
            <div className="pointer-events-none absolute -end-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -start-20 size-80 rounded-full bg-yellow-300/10 blur-3xl" />
            <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 text-center md:flex-row md:justify-between md:text-start">
              <div className="flex flex-col items-center md:items-start">
                {sale && <SaleStatusBadge sale={sale} />}
                <h1 className="mt-4 flex items-center gap-2 text-3xl font-black md:text-5xl">
                  <Zap className="size-8 fill-yellow-300 text-yellow-300 md:size-11" />
                  {sale?.title ?? 'فروش ویژهٔ روزانه'}
                </h1>
                {sale?.subtitle && <p className="mt-3 max-w-xl text-sm leading-7 text-orange-50/90 md:text-base">{sale.subtitle}</p>}
                {sale && (
                  <p className="mt-3 text-sm text-orange-50/80">
                    {formatNumber(available)} کالا با کف قیمت، هر روز ساعت {formatNumber(sale.startHour)} تا {formatNumber(sale.endHour)}
                  </p>
                )}
              </div>
              {sale && <SaleCountdown key={`${sale.active}:${sale.startsAt}`} sale={sale} large />}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-8 md:py-12" aria-label="کالاهای فروش ویژه">
            {isLoading && <p className="py-16 text-center text-text-200">در حال بارگذاری…</p>}
            {!isLoading && !sale && (
              <div className="mx-auto max-w-md py-16 text-center">
                <p className="text-lg font-bold text-title-50">فروش ویژه فعلاً برگزار نمی‌شود.</p>
                <Link to={SHOP_PATH} className="mt-4 inline-block rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-bold text-white">رفتن به فروشگاه</Link>
              </div>
            )}
            {sale && !canViewPrices && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-300/40 bg-orange-50 p-4 text-sm text-orange-900 dark:bg-orange-950/30 dark:text-orange-100">
                <span>قیمت‌های فروش ویژه فقط برای همکاران تأییدشده نمایش داده می‌شود.</span>
                {!user && (
                  <button type="button" onClick={() => setAuthOpen(true)} className="rounded-xl bg-orange-600 px-4 py-2 font-bold text-white">ورود / ثبت‌نام همکار</button>
                )}
              </div>
            )}
            {sale && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                {items.map((item) => (
                  <SaleCard key={item.product.productId} item={item} active={sale.active} startHour={sale.startHour} canViewPrices={canViewPrices} />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      <StoreFooter />
      <div className="landing-tabbar-spacer" aria-hidden="true" />

      <MobileAppNavigation
        activeTab="sale"
        cartItemCount={cartCount(lines)}
        links={{
          home: '/',
          categories: `${SHOP_PATH}?tab=categories`,
          search: `${SHOP_PATH}?tab=search`,
          cart: `${SHOP_PATH}?tab=cart`,
          ...(user ? { profile: '/account' } : {}),
        }}
        accountReturnTo="/flash-sale"
        profileLabel={user ? undefined : 'ورود / عضویت'}
        onSelect={(tab) => { if (tab === 'profile' && !user) setAuthOpen(true); }}
      />

      <AuthDialog
        open={authOpen}
        initialStep="phone"
        onClose={() => setAuthOpen(false)}
        onOpenCredit={() => navigate('/account/credit', { state: { returnTo: '/flash-sale' } })}
        onReady={() => setAuthOpen(false)}
      />
    </>
  );
}
