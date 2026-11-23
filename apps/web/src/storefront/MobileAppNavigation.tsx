import { Link } from 'react-router-dom';
import { formatNumber, type FlashSaleShowcase } from '@tamas/shared';
import { Icon } from '../components/Icon';
import { FLASH_SALE_PATH, Hourglass, pad, useFlashSale, useSaleClock } from './flashSale';

export type MobileAppTab = 'home' | 'categories' | 'search' | 'cart' | 'profile';

type TabLinks = Partial<Record<MobileAppTab, string>>;

const ITEMS: Array<{ tab: MobileAppTab; label: string; icon: 'home' | 'grid' | 'search' | 'bag' | 'user' }> = [
  { tab: 'home', label: 'صفحه اصلی', icon: 'home' },
  { tab: 'categories', label: 'دسته‌بندی‌ها', icon: 'grid' },
  { tab: 'search', label: 'جستجو', icon: 'search' },
  { tab: 'cart', label: 'سبد خرید', icon: 'bag' },
  { tab: 'profile', label: 'حساب کاربری', icon: 'user' },
];

interface MobileAppNavigationProps {
  /** 'sale' marks the daily sale page, whose tab shows only while the sale is on. */
  activeTab: MobileAppTab | 'sale';
  cartItemCount?: number;
  links?: TabLinks;
  accountReturnTo?: string;
  profileLabel?: string;
  onSelect?: (tab: MobileAppTab) => void;
}

function TabContent({ tab, label, icon, cartItemCount }: (typeof ITEMS)[number] & { cartItemCount: number }) {
  return (
    <>
      <span className="tabbar-icon">
        <Icon name={icon} />
        {tab === 'cart' && cartItemCount > 0 ? (
          <span className="badge-count">{formatNumber(cartItemCount)}</span>
        ) : null}
      </span>
      <span>{label}</span>
    </>
  );
}

export function MobileAppNavigation({
  activeTab,
  cartItemCount = 0,
  links,
  accountReturnTo,
  profileLabel,
  onSelect,
}: MobileAppNavigationProps) {
  const { data: sale } = useFlashSale();
  return (
    <nav className="tabbar" aria-label="ناوبری اصلی فروشگاه">
      {ITEMS.flatMap((item) => {
        // The daily sale sits in the middle of the bar while the admin has it on.
        const saleTab = item.tab === 'search' && sale
          ? [<SaleTabItem key="sale" sale={sale} active={activeTab === 'sale'} />]
          : [];
        return [...saleTab, renderItem(item)];
      })}
    </nav>
  );

  function renderItem(item: (typeof ITEMS)[number]) {
        const displayedItem = item.tab === 'profile' && profileLabel ? { ...item, label: profileLabel } : item;
        const active = activeTab === item.tab;
        const className = `tabbar-item${active ? ' active' : ''}`;
        const href = links?.[item.tab];

        if (href) {
          return (
            <Link
              key={item.tab}
              to={href}
              state={item.tab === 'profile' && accountReturnTo ? { returnTo: accountReturnTo } : undefined}
              className={className}
              aria-current={active ? 'page' : undefined}
            >
              <TabContent {...displayedItem} cartItemCount={cartItemCount} />
            </Link>
          );
        }

        return (
          <button
            key={item.tab}
            type="button"
            className={className}
            aria-pressed={active}
            onClick={() => onSelect?.(item.tab)}
          >
            <TabContent {...displayedItem} cartItemCount={cartItemCount} />
          </button>
        );
  }
}

function SaleTabItem({ sale, active }: { sale: FlashSaleShowcase; active: boolean }) {
  const clock = useSaleClock(sale);
  return (
    <Link to={FLASH_SALE_PATH} className={`tabbar-item tabbar-item--sale${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
      <span className="tabbar-icon">
        <Hourglass remaining={clock.remaining} running={sale.active} />
      </span>
      <span>{sale.active ? `${pad(clock.hours)}:${pad(clock.minutes)}` : 'فروش ویژه'}</span>
    </Link>
  );
}
