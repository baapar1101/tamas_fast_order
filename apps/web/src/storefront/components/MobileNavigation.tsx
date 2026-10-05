import { Icon } from "../../components/Icon";
import { formatNumber } from "@tamas/shared";
import type { CartLine } from "../../store/cart";
import { cartCount } from "../../store/cart";

interface MobileNavigationProps {
  mobileTab: "home" | "categories" | "search" | "cart" | "profile";
  setMobileTab: (
    tab: "home" | "categories" | "search" | "cart" | "profile",
  ) => void;
  lines: CartLine[];
  user: any; // We'll just use any for user here since we only need to check if it exists
  onHomeClick: () => void;
}

export function MobileNavigation({
  mobileTab,
  setMobileTab,
  lines,
  user,
  onHomeClick,
}: MobileNavigationProps) {
  return (
    <nav className="tabbar" aria-label="ناوبری موبایل">
      <button
        type="button"
        className={`tabbar-item ${mobileTab === "home" ? "active" : ""}`}
        onClick={() => {
          onHomeClick();
          setMobileTab("home");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        <span className="tabbar-icon">
          <Icon name="home" />
        </span>
        <span>صفحه اصلی</span>
      </button>
      <button
        type="button"
        className={`tabbar-item ${mobileTab === "categories" ? "active" : ""}`}
        onClick={() => setMobileTab("categories")}
      >
        <span className="tabbar-icon">
          <Icon name="grid" />
        </span>
        <span>دسته‌بندی‌ها</span>
      </button>
      <button
        type="button"
        className={`tabbar-item ${mobileTab === "search" ? "active" : ""}`}
        onClick={() => setMobileTab("search")}
      >
        <span className="tabbar-icon">
          <Icon name="search" />
        </span>
        <span>جستجو</span>
      </button>
      <button
        type="button"
        className={`tabbar-item ${mobileTab === "cart" ? "active" : ""}`}
        onClick={() => setMobileTab("cart")}
      >
        <span className="tabbar-icon">
          <Icon name="bag" />
          {lines.length > 0 && (
            <span className="badge-count">
              {formatNumber(cartCount(lines))}
            </span>
          )}
        </span>
        <span>سبد خرید</span>
      </button>
      <button
        type="button"
        className={`tabbar-item ${mobileTab === "profile" ? "active" : ""}`}
        onClick={() => setMobileTab("profile")}
      >
        <span className="tabbar-icon">
          <Icon name="user" />
        </span>
        <span>{user ? "حساب کاربری" : "ورود / عضویت"}</span>
      </button>
    </nav>
  );
}
