import { Link } from 'react-router-dom';
import { formatNumber } from '@tamas/shared';
import { Icon } from '../components/Icon';

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
  activeTab: MobileAppTab;
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
  return (
    <nav className="tabbar" aria-label="ناوبری اصلی فروشگاه">
      {ITEMS.map((item) => {
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
      })}
    </nav>
  );
}
