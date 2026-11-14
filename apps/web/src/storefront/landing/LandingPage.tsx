import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CreditCard,
  Headset,
  LayoutGrid,
  Lock,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Truck,
  User,
  Warehouse,
  Zap,
} from 'lucide-react';
import {
  formatMoney,
  formatNumber,
  type BrandDTO,
  type CategoryDTO,
  type LandingBenefitIcon,
  type LandingConfig,
  type LandingSection,
  type ProductGroupDTO,
} from '@tamas/shared';
import { api } from '../../lib/api';
import { resolveImageUrl, useImageFallback } from '../../lib/images';
import { useAuth } from '../../store/auth';
import { cartCount, useCart } from '../../store/cart';
import { useToast } from '../../components/Toast';
import { ThemeToggle } from '../../components/ThemeToggle';
import { CrmChat } from '../../components/CrmChat';
import { cn } from '../../components/ui/cn';
import { useInjectedStyles } from '../../components/ui/useInjectedStyles';
import { AuthDialog } from '../AuthDialog';
import { StoreFooter } from '../StoreFooter';
import { IncompleteProfilePopup } from '../IncompleteProfilePopup';
import { MobileAppNavigation } from '../MobileAppNavigation';
import { useBootstrap, type StorefrontSlide } from '../hooks';
import { visibleCampaignSlides } from '../goldenCampaign';
import { FlipWords, GlowCard, Marquee, Reveal, SpotCard, TiltFrame } from './effects';
import { SHOP_PATH, featuredQuery, featuredShopHref, shopHref, shopSearchHref } from './shopLinks';
import landingCss from './landing.css?inline';
import { FlashSaleSection } from './FlashSaleSection';

type Section<T extends LandingSection['type']> = Extract<LandingSection, { type: T }>;

/** Same rules the catalog uses for category and brand artwork. */
function artSrc(value: string | null, folder: 'category' | 'brand'): string | null {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('/')) return value;
  if (value.startsWith('img_')) return `/uploads/${value}`;
  return `/assets/${folder}/${value}`;
}

function SlideLink({ slide, className, children, tabIndex }: { slide: StorefrontSlide; className?: string; children: ReactNode; tabIndex?: number }) {
  const label = slide.title || 'مشاهدهٔ بنر';
  if (!slide.linkUrl) return <div className={className}>{children}</div>;
  if (/^https?:\/\//i.test(slide.linkUrl)) {
    return <a href={slide.linkUrl} target="_blank" rel="noreferrer" className={className} aria-label={label} tabIndex={tabIndex}>{children}</a>;
  }
  return <Link to={shopHref(slide.linkUrl)} className={className} aria-label={label} tabIndex={tabIndex}>{children}</Link>;
}

function SlidePicture({ slide, eager }: { slide: StorefrontSlide; eager: boolean }) {
  return (
    <picture>
      {slide.mobileImageUrl && <source media="(max-width: 768px)" srcSet={slide.mobileImageUrl} />}
      <img
        src={slide.imageUrl}
        alt={slide.title || 'بنر فروشگاه'}
        className="block h-auto w-full"
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
      />
    </picture>
  );
}

/** The wholesale button: a light runs around its border. */
function WholesaleButton({ label, size = 'md', className }: { label: string; size?: 'md' | 'lg'; className?: string }) {
  return (
    <Link to={SHOP_PATH} className={cn('lp-moving-border group shadow-[0_0_40px_-8px_rgba(34,211,238,.55)]', className)}>
      <span
        className={cn(
          'flex w-full items-center justify-center gap-3 bg-[#06121c] font-extrabold text-white transition group-hover:bg-[#0a1c2a]',
          size === 'lg' ? 'whitespace-nowrap px-5 py-4 text-base sm:px-8 sm:py-5 sm:text-lg md:text-xl' : 'whitespace-nowrap px-6 py-3.5 text-base',
        )}
      >
        <ShoppingBag className={size === 'lg' ? 'size-6' : 'size-5'} />
        {label}
        <ArrowLeft className="size-5 transition group-hover:-translate-x-1" />
      </span>
    </Link>
  );
}

function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  if (!title && !subtitle) return null;
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {title && <h2 className="text-2xl font-black text-title-50 md:text-4xl">{title}</h2>}
        {subtitle && <p className="mt-2 text-text-100 md:text-lg">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header and hero

function LandingHeader({ config, onLogin }: { config: LandingConfig; onLogin: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const items = useCart((state) => cartCount(state.lines));
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    // On narrow screens <body> scrolls instead of the window.
    const onScroll = () => setScrolled(Math.max(window.scrollY, document.body.scrollTop) > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
  }, []);

  const anchors = config.sections
    .filter((section) => section.enabled && ['featured', 'categories', 'benefits', 'steps'].includes(section.type))
    .slice(0, 4)
    .map((section) => ({ id: section.id, label: { featured: 'محصولات ویژه', categories: 'دسته‌بندی‌ها', benefits: 'چرا تماس مارکت', steps: 'نحوهٔ سفارش' }[section.type as 'featured' | 'categories' | 'benefits' | 'steps'] }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    navigate(shopSearchHref({ q: query.trim() || undefined }));
  };

  return (
    <header
      data-theme="dark"
      className={cn(
        'tg-store fixed inset-x-0 top-0 z-[60] transition-all duration-300',
        scrolled ? 'border-b border-white/10 bg-[#070c14]/80 py-2 shadow-lg backdrop-blur-xl' : 'bg-transparent py-4',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="تماس مارکت">
          <img src="/logo.png" alt="تماس مارکت" className="h-9 w-auto brightness-0 invert md:h-10" />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="بخش‌های صفحه">
          {anchors.map((anchor) => (
            <a key={anchor.id} href={`#${anchor.id}`} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white">{anchor.label}</a>
          ))}
        </nav>
        <form onSubmit={submit} role="search" className="relative ms-auto hidden max-w-xs flex-1 md:block">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجوی کالا، برند یا مدل…"
            aria-label="جست‌وجوی کالا"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 ps-9 pe-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/15"
          />
        </form>
        <div className="ms-auto flex items-center gap-2 md:ms-0">
          <div className="hidden sm:block"><ThemeToggle /></div>
          <Link to={`${SHOP_PATH}#cart`} className="relative hidden size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10 md:flex" aria-label="سبد خرید">
            <ShoppingCart className="size-5" />
            {items > 0 && <span className="absolute -top-1.5 -end-1.5 grid min-w-5 place-items-center rounded-full bg-cyan-400 px-1 text-[11px] font-bold text-slate-950">{formatNumber(items)}</span>}
          </Link>
          {user ? (
            <Link to="/account" className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 sm:flex">
              <User className="size-4" /> {`${user.name || 'حساب'} ${user.lastName || ''}`.trim()}
            </Link>
          ) : (
            <button type="button" onClick={onLogin} className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 sm:flex">
              <User className="size-4" /> ورود همکار
            </button>
          )}
          <Link to={SHOP_PATH} className="lp-moving-border shrink-0">
            <span className="flex items-center gap-2 bg-[#06121c] px-4 py-2.5 text-sm font-extrabold text-white"><Store className="size-4" /> خرید عمده</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function BannerShowcase({ slides }: { slides: StorefrontSlide[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, slides.length - 1)));
    if (slides.length < 2 || paused) return undefined;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 5500);
    return () => window.clearInterval(timer);
  }, [slides.length, paused]);
  if (slides.length === 0) return null;

  return (
    <div className="relative mx-auto mt-14 max-w-6xl" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
      <div className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 rounded-full bg-cyan-500/20 blur-3xl" />
      <TiltFrame>
        <GlowCard className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)] backdrop-blur md:p-3">
          <section className="relative grid overflow-hidden rounded-[1.25rem]" aria-roledescription="carousel" aria-label="بنرهای فروشگاه">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                className={cn('col-start-1 row-start-1 transition-opacity duration-700', index === active ? 'opacity-100' : 'pointer-events-none opacity-0')}
                aria-hidden={index !== active}
              >
                <SlideLink slide={slide} className="block" tabIndex={index === active ? 0 : -1}>
                  <SlidePicture slide={slide} eager={index === 0} />
                </SlideLink>
              </div>
            ))}
          </section>
        </GlowCard>
      </TiltFrame>
      {slides.length > 1 && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <button type="button" aria-label="بنر قبلی" onClick={() => setActive((active - 1 + slides.length) % slides.length)} className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"><ChevronRight className="size-5" /></button>
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`نمایش بنر ${formatNumber(index + 1)}`}
              aria-current={index === active ? 'true' : undefined}
              onClick={() => setActive(index)}
              className={cn('h-2 rounded-full transition-all', index === active ? 'w-8 bg-cyan-400' : 'w-2 bg-white/30 hover:bg-white/50')}
            />
          ))}
          <button type="button" aria-label="بنر بعدی" onClick={() => setActive((active + 1) % slides.length)} className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"><ChevronLeft className="size-5" /></button>
        </div>
      )}
    </div>
  );
}

function Hero({ config, slides, categories, brandsCount, onLogin }: { config: LandingConfig; slides: StorefrontSlide[]; categories: CategoryDTO[]; brandsCount: number; onLogin: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { hero } = config;

  return (
    <section data-theme="dark" className="tg-store relative overflow-hidden bg-[#070c14] pb-16 pt-28 md:pb-24 md:pt-36">
      <div className="lp-grid pointer-events-none absolute inset-0" />
      <div className="lp-beam animate-lp-drift -top-24 -start-40 bg-[radial-gradient(closest-side,#0b8ca2,transparent)]" />
      <div className="lp-beam animate-lp-drift-rev -top-10 -end-48 bg-[radial-gradient(closest-side,#22d3ee,transparent)] opacity-35" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#070c14] to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4">
        <Reveal className="mx-auto max-w-4xl text-center">
          {hero.badge && (
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-1.5 text-sm font-medium text-cyan-200">
              <span className="lp-pulse size-2 rounded-full bg-cyan-400" />
              {hero.badge}
            </span>
          )}
          <h1 className="mt-6 text-4xl font-black leading-[1.35] text-white md:text-6xl md:leading-[1.3]">
            {hero.titleBefore}{' '}
            <span className="block md:inline"><FlipWords words={hero.rotatingWords} className="lp-gradient-text" /></span>
            {hero.titleAfter && <><br className="hidden md:block" /> {hero.titleAfter}</>}
          </h1>
          {hero.subtitle && <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">{hero.subtitle}</p>}

          <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <WholesaleButton label={hero.primaryLabel} size="lg" />
            {!user ? (
              <button type="button" onClick={onLogin} className="rounded-2xl border border-white/15 bg-white/5 px-7 py-5 text-base font-bold text-white transition hover:border-white/30 hover:bg-white/10">
                {hero.secondaryLabel}
              </button>
            ) : user.isActive ? (
              <Link to="/account" className="rounded-2xl border border-white/15 bg-white/5 px-7 py-5 text-base font-bold text-white transition hover:bg-white/10">حساب کاربری من</Link>
            ) : (
              <span className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-5 py-4 text-sm font-medium text-amber-200">حساب همکاری شما در انتظار تأیید است</span>
            )}
          </div>

          <form
            role="search"
            className="relative mx-auto mt-8 max-w-xl md:hidden"
            onSubmit={(event) => { event.preventDefault(); navigate(shopSearchHref({ q: query.trim() || undefined })); }}
          >
            <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجوی کالا، برند یا مدل…"
              aria-label="جست‌وجوی کالا"
              enterKeyHint="search"
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 ps-12 pe-4 text-white outline-none placeholder:text-slate-400 focus:border-cyan-400/60"
            />
          </form>

          {categories.length > 0 && (
            <div className="lp-hide-scrollbar mt-7 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:justify-center">
              {categories.slice(0, 7).map((category) => (
                <Link key={category.id} to={shopSearchHref({ cat: category.name })} className="shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-cyan-400/40 hover:text-white">
                  {category.faName}
                </Link>
              ))}
            </div>
          )}

          <dl className="mx-auto mt-8 flex max-w-lg justify-center gap-8 text-center">
            {categories.length > 0 && <div><dt className="text-xs text-slate-400">دسته‌بندی</dt><dd className="text-xl font-black text-white">{formatNumber(categories.length)}</dd></div>}
            {brandsCount > 0 && <div><dt className="text-xs text-slate-400">برند</dt><dd className="text-xl font-black text-white">{formatNumber(brandsCount)}</dd></div>}
            <div><dt className="text-xs text-slate-400">انبار</dt><dd className="text-xl font-black text-white">کرمان و تهران</dd></div>
          </dl>
        </Reveal>

        {hero.showSlides && <BannerShowcase slides={slides} />}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sections

function WholesaleSectionView({ section, categoriesCount, brandsCount, onLogin }: { section: Section<'wholesale'>; categoriesCount: number; brandsCount: number; onLogin: () => void }) {
  const { user } = useAuth();
  return (
    <section id={section.id} className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 md:py-20">
      <Reveal>
        <GlowCard className="overflow-hidden rounded-[2rem] border border-base-100 bg-card-background-50 shadow-xl">
          <div className="pointer-events-none absolute -end-24 -top-24 size-80 rounded-full bg-primary-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -start-16 size-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative grid gap-10 p-7 md:grid-cols-[1.25fr_1fr] md:p-12">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-sm font-bold text-primary-500"><Store className="size-4" /> بخش خرید عمده</span>
              <h2 className="mt-4 text-3xl font-black leading-tight text-title-50 md:text-5xl">{section.title}</h2>
              {section.text && <p className="mt-4 text-base leading-8 text-text-100 md:text-lg">{section.text}</p>}
              {section.points.length > 0 && (
                <ul className="mt-6 grid gap-3">
                  {section.points.map((point) => (
                    <li key={point} className="flex items-center gap-3 font-medium text-text-50">
                      <CircleCheck className="size-5 shrink-0 text-primary-500" /> {point}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-col justify-center gap-5">
              <WholesaleButton label={section.buttonLabel} size="lg" className="w-full" />
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl border border-base-100 bg-background-soft-50 p-4"><div className="text-2xl font-black text-title-50">{formatNumber(categoriesCount)}</div><div className="text-xs text-text-100">دسته‌بندی</div></div>
                <div className="rounded-2xl border border-base-100 bg-background-soft-50 p-4"><div className="text-2xl font-black text-title-50">{formatNumber(brandsCount)}</div><div className="text-xs text-text-100">برند</div></div>
                <div className="rounded-2xl border border-base-100 bg-background-soft-50 p-4"><div className="text-2xl font-black text-title-50">{formatNumber(2)}</div><div className="text-xs text-text-100">انبار</div></div>
              </div>
              {!user && (
                <button type="button" onClick={onLogin} className="flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium text-primary-500 transition hover:bg-primary-50">
                  <Lock className="size-4" /> برای دیدن قیمت‌های همکاری وارد شوید
                </button>
              )}
            </div>
          </div>
        </GlowCard>
      </Reveal>
    </section>
  );
}

interface ProductsResponse { groups: ProductGroupDTO[] }

function FeaturedCard({ group, canViewPrices }: { group: ProductGroupDTO; canViewPrices: boolean }) {
  const first = group.variants[0];
  if (!first) return null;
  const brand = first.brandFaName || first.brandName;
  const prices = group.variants.map((variant) => variant.price).filter((price) => price > 0);
  const varies = new Set(prices).size > 1;
  return (
    <GlowCard className="h-full rounded-2xl border border-base-100 bg-card-background-50 transition duration-200 hover:-translate-y-1 hover:shadow-xl">
      <Link to={`/p/${first.productId}`} className="flex h-full flex-col">
        <div className="relative m-2 overflow-hidden rounded-xl bg-white">
          {group.promotion && <span className="absolute start-2 top-2 z-[1] inline-flex items-center gap-1 rounded-full bg-gradient-to-l from-orange-500 to-rose-500 px-2.5 py-1 text-[11px] font-bold text-white"><Sparkles className="size-3" /> پیشنهاد ویژه</span>}
          <img
            src={resolveImageUrl(group.imageUrl)}
            alt={group.title}
            loading="lazy"
            onError={useImageFallback}
            className="aspect-square w-full object-contain p-4 transition duration-300 hover:scale-105"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-1">
          {brand && <span className="text-xs font-medium text-primary-500">{brand}</span>}
          <h3 className="line-clamp-2 text-sm font-bold leading-6 text-title-50">{group.title}</h3>
          {group.variants.length > 1 && <span className="text-xs text-text-200">{formatNumber(group.variants.length)} تنوع</span>}
          <div className="mt-auto flex items-center justify-between gap-2 pt-3">
            {canViewPrices && prices.length > 0 ? (
              <span className="text-sm font-black text-title-50">{varies && <small className="font-normal text-text-100">از </small>}{formatMoney(Math.min(...prices))}</span>
            ) : (
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-background-soft-100 px-2 py-1.5 text-[11px] font-medium text-text-100 sm:gap-1.5 sm:px-2.5 sm:text-xs"><Lock className="size-3.5" /> قیمت همکاری</span>
            )}
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary-500 text-white sm:size-9"><ArrowLeft className="size-4" /></span>
          </div>
        </div>
      </Link>
    </GlowCard>
  );
}

function FeaturedSectionView({ section, canViewPrices }: { section: Section<'featured'>; canViewPrices: boolean }) {
  const params = featuredQuery(section);
  const query = useQuery({
    queryKey: ['landing-featured', params],
    queryFn: ({ signal }) => api.get<ProductsResponse>('/catalog/products', { ...params }, signal),
    staleTime: 60_000,
  });
  const groups = (query.data?.groups ?? []).filter((group) => group.variants.length > 0).slice(0, section.limit);
  if (query.isError || (query.isSuccess && groups.length === 0)) return null;

  return (
    <section id={section.id} className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14">
      <Reveal>
        <SectionHeading
          title={section.title}
          subtitle={section.subtitle}
          action={<Link to={featuredShopHref(section)} className="inline-flex items-center gap-1.5 rounded-xl border border-base-300 px-4 py-2 text-sm font-bold text-title-50 transition hover:border-primary-500 hover:text-primary-500">مشاهدهٔ همه <ArrowLeft className="size-4" /></Link>}
        />
      </Reveal>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
        {query.isLoading
          ? Array.from({ length: Math.min(section.limit, 8) }, (_, index) => (
            <div key={index} className="animate-pulse rounded-2xl border border-base-100 bg-card-background-50 p-2">
              <div className="aspect-square rounded-xl bg-background-soft-100" />
              <div className="mt-3 h-4 w-4/5 rounded bg-background-soft-100" />
              <div className="mt-2 h-4 w-1/2 rounded bg-background-soft-100" />
            </div>
          ))
          : groups.map((group, index) => (
            <Reveal key={group.key} delay={Math.min(index, 7) * 0.04} className="h-full">
              <FeaturedCard group={group} canViewPrices={canViewPrices} />
            </Reveal>
          ))}
      </div>
    </section>
  );
}

/**
 * Grid spans for the small category cards so rows have no holes: two per row
 * on phones, and beside the large card then four per row on wider screens.
 */
function categorySpan(index: number, total: number): string {
  const small = total - 1;
  const position = index - 1;
  const classes: string[] = [];
  if (small % 2 === 1 && position === small - 1) classes.push('col-span-2');
  if (small > 4) {
    const tail = small - 4;
    const remainder = tail % 4;
    const tailIndex = position - 4;
    const lastRowStart = tail - remainder;
    if (tailIndex >= lastRowStart && remainder > 0) {
      if (remainder === 1) classes.push('md:col-span-4');
      else if (remainder === 2) classes.push('md:col-span-2');
      else if (tailIndex === lastRowStart) classes.push('md:col-span-2');
      else classes.push('md:col-span-1');
    } else if (classes.length) classes.push('md:col-span-1');
  } else if (small < 4 && position === small - 1) {
    classes.push(small === 1 ? 'md:col-span-2 md:row-span-2' : small === 2 ? 'md:row-span-2' : 'md:col-span-2');
  } else if (classes.length) classes.push('md:col-span-1');
  return classes.join(' ');
}

/** Every Tamas Market category as a plain text link, right under the hero. */
function CategoryDirectory({ categories }: { categories: CategoryDTO[] }) {
  if (categories.length === 0) return null;
  return (
    <section id="all-categories" aria-labelledby="all-categories-title" className="mx-auto max-w-7xl scroll-mt-24 px-4 pt-12">
      <div className="rounded-3xl border border-base-100 bg-card-background-50 p-5 md:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="all-categories-title" className="text-xl font-black text-title-50 md:text-2xl">دسته‌بندی‌های تماس مارکت</h2>
          <Link to={SHOP_PATH} className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-500">همهٔ کالاها <ArrowLeft className="size-4" /></Link>
        </div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                to={shopSearchHref({ cat: category.name })}
                className="group flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-text-50 transition hover:bg-primary-50 hover:text-primary-500 md:text-[15px]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-primary-500/60 transition group-hover:bg-primary-500" aria-hidden="true" />
                  <span className="truncate font-medium">{category.faName}</span>
                </span>
                {category.productCount != null && category.productCount > 0 && <span className="shrink-0 text-xs text-text-100">{formatNumber(category.productCount)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CategoriesSectionView({ section, categories }: { section: Section<'categories'>; categories: CategoryDTO[] }) {
  const list = categories.slice(0, section.limit);
  if (list.length === 0) return null;
  return (
    <section id={section.id} className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14">
      <Reveal><SectionHeading title={section.title} subtitle={section.subtitle} action={<Link to={SHOP_PATH} className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-500">همهٔ کالاها <ArrowLeft className="size-4" /></Link>} /></Reveal>
      <div className="grid auto-rows-[150px] grid-cols-2 gap-3 md:auto-rows-[170px] md:grid-cols-4 md:gap-4">
        {list.map((category, index) => {
          const icon = artSrc(category.iconUrl, 'category');
          const big = index === 0;
          return (
            <Reveal key={category.id} delay={index * 0.04} className={cn(big ? 'col-span-2 row-span-2' : categorySpan(index, list.length))}>
              <Link to={shopSearchHref({ cat: category.name })} className="block h-full">
                <SpotCard className={cn('group flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-base-100 bg-card-background-50 p-5 transition hover:border-primary-400 hover:shadow-lg', big && 'p-7')}>
                  <div className={cn('grid place-items-center rounded-2xl bg-background-soft-50', big ? 'size-24' : 'size-14')}>
                    {icon ? <img src={icon} alt="" loading="lazy" className={cn('object-contain transition duration-300 group-hover:scale-110', big ? 'size-16' : 'size-9')} /> : <LayoutGrid className="size-7 text-primary-500" />}
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <h3 className={cn('font-black text-title-50', big ? 'text-2xl md:text-3xl' : 'text-base')}>{category.faName}</h3>
                      {category.productCount != null && category.productCount > 0 && <p className="text-xs text-text-100">{formatNumber(category.productCount)} کالا</p>}
                    </div>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-50 text-primary-500 transition group-hover:bg-primary-500 group-hover:text-white"><ArrowLeft className="size-4" /></span>
                  </div>
                </SpotCard>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function BannersSectionView({ section, slides }: { section: Section<'banners'>; slides: StorefrontSlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  if (slides.length === 0) return null;
  // RTL: moving towards the next card scrolls left (negative).
  const scroll = (direction: 1 | -1) => trackRef.current?.scrollBy({ left: -direction * trackRef.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <section id={section.id} className="scroll-mt-24 py-14">
      <div className="mx-auto max-w-7xl px-4">
        <Reveal>
          <SectionHeading
            title={section.title}
            subtitle={section.subtitle}
            action={slides.length > 1 ? (
              <div className="flex gap-2">
                <button type="button" aria-label="قبلی" onClick={() => scroll(-1)} className="grid size-10 place-items-center rounded-full border border-base-300 text-title-50 transition hover:border-primary-500 hover:text-primary-500"><ChevronRight className="size-5" /></button>
                <button type="button" aria-label="بعدی" onClick={() => scroll(1)} className="grid size-10 place-items-center rounded-full border border-base-300 text-title-50 transition hover:border-primary-500 hover:text-primary-500"><ChevronLeft className="size-5" /></button>
              </div>
            ) : undefined}
          />
        </Reveal>
      </div>
      <div ref={trackRef} className="lp-hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:px-[max(1rem,calc((100vw-80rem)/2+1rem))]">
        {slides.map((slide) => (
          <div key={slide.id} className="w-[86%] shrink-0 snap-center md:w-[62%] lg:w-[48%]">
            <GlowCard className="overflow-hidden rounded-3xl border border-base-100 bg-card-background-50 p-1.5 shadow-lg transition hover:-translate-y-1 hover:shadow-2xl">
              <SlideLink slide={slide} className="block overflow-hidden rounded-[1.25rem]">
                <SlidePicture slide={slide} eager={false} />
              </SlideLink>
            </GlowCard>
          </div>
        ))}
      </div>
    </section>
  );
}

const BENEFIT_ICONS: Record<LandingBenefitIcon, typeof Warehouse> = {
  warehouse: Warehouse,
  price: BadgePercent,
  credit: CreditCard,
  speed: Zap,
  support: Headset,
  shield: ShieldCheck,
  truck: Truck,
  sparkles: Sparkles,
};

function BenefitsSectionView({ section }: { section: Section<'benefits'> }) {
  if (section.items.length === 0) return null;
  return (
    <section id={section.id} className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14">
      <Reveal><SectionHeading title={section.title} subtitle={section.subtitle} /></Reveal>
      <div className={cn('grid gap-4 md:grid-cols-2', section.items.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
        {section.items.map((item, index) => {
          const Icon = BENEFIT_ICONS[item.icon];
          return (
            <Reveal key={`${item.title}-${index}`} delay={index * 0.06} className="h-full">
              <SpotCard className="h-full overflow-hidden rounded-2xl border border-base-100 bg-card-background-50 p-6 transition hover:border-primary-400">
                <span className="grid size-12 place-items-center rounded-xl bg-gradient-to-br from-primary-500 to-cyan-400 text-white shadow-lg shadow-primary-500/25"><Icon className="size-6" /></span>
                <h3 className="mt-5 text-lg font-black text-title-50">{item.title}</h3>
                {item.text && <p className="mt-2 text-sm leading-7 text-text-100">{item.text}</p>}
              </SpotCard>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function BrandsSectionView({ section, brands }: { section: Section<'brands'>; brands: BrandDTO[] }) {
  if (brands.length === 0) return null;
  const items = brands.slice(0, 40).map((brand) => {
    const icon = artSrc(brand.iconUrl, 'brand');
    return (
      <Link key={brand.id} to={shopSearchHref({ brand: brand.name })} className="flex h-20 min-w-44 items-center gap-3 rounded-2xl border border-base-100 bg-card-background-50 px-4 text-start transition hover:-translate-y-0.5 hover:border-primary-400 hover:shadow-lg">
        {icon && <img src={icon} alt="" loading="lazy" className="size-12 shrink-0 rounded-xl object-contain" />}
        <span className="flex flex-col">
          <span className="text-sm font-black text-title-50">{brand.faName || brand.name}</span>
          {brand.faName && brand.name && brand.faName !== brand.name && <span className="text-xs text-text-200" dir="ltr">{brand.name}</span>}
        </span>
      </Link>
    );
  });
  return (
    <section id={section.id} className="scroll-mt-24 py-14">
      <div className="mx-auto max-w-7xl px-4"><Reveal><SectionHeading title={section.title} /></Reveal></div>
      <Marquee seconds={Math.max(25, brands.length * 3)}>{items}</Marquee>
    </section>
  );
}

function StepsSectionView({ section }: { section: Section<'steps'> }) {
  if (section.items.length === 0) return null;
  return (
    <section id={section.id} className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14">
      <Reveal><SectionHeading title={section.title} /></Reveal>
      <div className="relative grid gap-6 md:grid-cols-3">
        <div className="pointer-events-none absolute inset-x-[16%] top-8 hidden h-px bg-gradient-to-l from-transparent via-primary-500 to-transparent md:block" />
        {section.items.map((item, index) => (
          <Reveal key={`${item.title}-${index}`} delay={index * 0.12} className="relative text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-primary-400/40 bg-card-background-50 text-2xl font-black text-primary-500 shadow-lg shadow-primary-500/15">{formatNumber(index + 1)}</div>
            <h3 className="mt-5 text-lg font-black text-title-50">{item.title}</h3>
            {item.text && <p className="mx-auto mt-2 max-w-xs text-sm leading-7 text-text-100">{item.text}</p>}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function CtaSectionView({ section }: { section: Section<'cta'> }) {
  return (
    <section id={section.id} className="scroll-mt-24 px-4 py-14">
      <div data-theme="dark" className="tg-store relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#070c14] px-6 py-20 text-center md:py-28">
        <div className="lp-lamp pointer-events-none absolute inset-x-0 top-0 h-72" />
        <div className="pointer-events-none absolute inset-x-[20%] top-0 h-px bg-gradient-to-l from-transparent via-cyan-300 to-transparent" />
        <div className="pointer-events-none absolute inset-x-[30%] top-0 h-10 bg-cyan-400/30 blur-2xl" />
        <div className="lp-grid pointer-events-none absolute inset-0 opacity-50" />
        <Reveal className="relative">
          <h2 className="mx-auto max-w-3xl text-3xl font-black leading-tight text-white md:text-5xl">{section.title}</h2>
          {section.text && <p className="mx-auto mt-5 max-w-2xl leading-8 text-slate-300 md:text-lg">{section.text}</p>}
          <div className="mt-9 flex justify-center"><WholesaleButton label={section.buttonLabel} size="lg" /></div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/** The home page: hero, then the sections the admin turned on, in their order. */
export function LandingPage({ config }: { config: LandingConfig }) {
  const ready = useInjectedStyles('landing', landingCss);
  const navigate = useNavigate();
  const toast = useToast();
  const { user, complete, logout } = useAuth();
  const lines = useCart((state) => state.lines);
  const bootstrap = useBootstrap();
  const [authOpen, setAuthOpen] = useState(false);
  const [authStep, setAuthStep] = useState<'phone' | 'profile'>('phone');

  const slides = useMemo(() => visibleCampaignSlides(bootstrap.data?.slides ?? [], Date.now()), [bootstrap.data?.slides]);
  const categories = bootstrap.data?.categories ?? [];
  const brands = bootstrap.data?.brands ?? [];
  const canViewPrices = Boolean(user?.isActive);
  const openLogin = () => { setAuthStep('phone'); setAuthOpen(true); };

  useEffect(() => {
    const previous = document.title;
    document.title = `${bootstrap.data?.settings.store_name || 'تماس مارکت'} | خرید عمدهٔ کالای دیجیتال`;
    return () => { document.title = previous; };
  }, [bootstrap.data?.settings.store_name]);

  if (!ready) return null;

  return (
    <>
      <div className="tg-root tg-store lp-page min-h-screen">
        <LandingHeader config={config} onLogin={openLogin} />
        <main>
          <Hero config={config} slides={slides} categories={categories} brandsCount={brands.length} onLogin={openLogin} />
          <FlashSaleSection canViewPrices={canViewPrices} />
          <CategoryDirectory categories={categories} />
          {config.sections.filter((section) => section.enabled).map((section) => {
            switch (section.type) {
              case 'wholesale': return <WholesaleSectionView key={section.id} section={section} categoriesCount={categories.length} brandsCount={brands.length} onLogin={openLogin} />;
              case 'featured': return <FeaturedSectionView key={section.id} section={section} canViewPrices={canViewPrices} />;
              case 'categories': return <CategoriesSectionView key={section.id} section={section} categories={categories} />;
              case 'banners': return <BannersSectionView key={section.id} section={section} slides={slides} />;
              case 'benefits': return <BenefitsSectionView key={section.id} section={section} />;
              case 'brands': return <BrandsSectionView key={section.id} section={section} brands={brands} />;
              case 'steps': return <StepsSectionView key={section.id} section={section} />;
              case 'cta': return <CtaSectionView key={section.id} section={section} />;
            }
          })}
        </main>
      </div>

      <StoreFooter />
      <div className="landing-tabbar-spacer" aria-hidden="true" />

      <MobileAppNavigation
        activeTab="home"
        cartItemCount={cartCount(lines)}
        links={{
          categories: `${SHOP_PATH}?tab=categories`,
          search: `${SHOP_PATH}?tab=search`,
          cart: `${SHOP_PATH}?tab=cart`,
          ...(user ? { profile: '/account' } : {}),
        }}
        accountReturnTo="/"
        profileLabel={user ? undefined : 'ورود / عضویت'}
        onSelect={(tab) => {
          if (tab === 'profile' && !user) openLogin();
          if (tab === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <AuthDialog
        open={authOpen}
        initialStep={authStep}
        onClose={() => setAuthOpen(false)}
        onOpenCredit={() => navigate('/account/credit', { state: { returnTo: '/' } })}
        onReady={() => navigate(lines.length > 0 ? `${SHOP_PATH}#cart` : SHOP_PATH)}
      />
      <IncompleteProfilePopup
        show={!!user && !complete}
        onComplete={() => { setAuthStep('profile'); setAuthOpen(true); }}
        onLogout={async () => { await logout(); toast.ok('از حساب خارج شدید.'); }}
      />
      <CrmChat user={user || undefined} />
    </>
  );
}
