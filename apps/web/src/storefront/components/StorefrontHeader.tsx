import { Link } from "react-router-dom";
import type { CreditApplicationDTO } from "@tamas/shared";
import { Icon } from "../../components/Icon";
import { ThemeToggle } from "../../components/ThemeToggle";

interface StorefrontHeaderProps {
  user: any;
  isAdmin: boolean;
  userCreditApp: CreditApplicationDTO | null;
  settings: any;
  search: string;
  setSearch: (search: string) => void;
  resetPage: () => void;
  promoOrange: boolean;
  setCreditOpen: (open: boolean) => void;
  setAuthStep: (step: "phone" | "profile") => void;
  setAuthOpen: (open: boolean) => void;
  logout: () => Promise<void>;
  toast: any;
}

export function StorefrontHeader({
  user,
  isAdmin,
  userCreditApp,
  settings,
  search,
  setSearch,
  resetPage,
  promoOrange,
  setCreditOpen,
  setAuthStep,
  setAuthOpen,
  logout,
  toast,
}: StorefrontHeaderProps) {
  return (
    <header className="topbar">
      {/* Top promo strip */}
      <div className={`topbar-promo${promoOrange ? " promo-orange" : ""}`}>
        <div className="promo-sheen" aria-hidden="true" />
        <div className="promo-inner">
          <div className="promo-copy">
            <strong className="promo-title">
              {promoOrange
                ? "رشد کسب‌وکار خود را با اعتبار ما تسریع کنید!"
                : "با هم، سریع‌تر و بهتر رشد می‌کنیم!"}
            </strong>
            <span className="promo-text">
              {promoOrange
                ? "برای خرید کالاهای پرگردش، نیازی به پرداخت نقدی ندارید، فایل اعتباری خود را بسازید و با خرید چکی یا اعتبار هفتگی، بدون پرداخت نقدی موجودی فروشگاهتان را تأمین کنید."
                : "همکاری با ما از چیزی که فکرش رو می‌کنید راحت‌تره. با ثبت‌نام در پنل همکاران، بلافاصله به قیمت‌های ویژه، تامین مطمئن و پشتیبانی اختصاصی دسترسی پیدا کنید."}
            </span>
          </div>
          <button
            type="button"
            className="promo-cta"
            onClick={() => {
              if (user) {
                setCreditOpen(true);
              } else {
                setAuthStep("phone");
                setAuthOpen(true);
              }
            }}
          >
            {promoOrange ? "ایجاد فایل اعتباری" : "ثبت‌نام در چند ثانیه"}
          </button>
        </div>
      </div>

      {/* Topbar Header */}
      <div className="topbar-inner">
        <Link to="/" className="logo">
          <img src="/logo.png" alt={settings.store_name || "تماس مارکت"} />
          <span className="logo-tagline">
            {settings.store_tagline || "مرجع تخصصی فروش عمده کالای دیجیتال"}
          </span>
        </Link>

        <div className="search-wrapper">
          <span className="search-icon" aria-hidden>
            <Icon name="search" />
          </span>
          <input
            type="search"
            className="search-input"
            placeholder="جستجو بر اساس نام محصول، مدل، برند..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            aria-label="جستجو"
          />
          {search && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearch("")}
              aria-label="پاک کردن جستجو"
            >
              ✕
            </button>
          )}
          <span className="search-shortcut">Ctrl + /</span>
        </div>

        <div className="user-actions">
          <ThemeToggle />
          <button
            type="button"
            className="btn btn-icon-only"
            onClick={() =>
              document
                .getElementById("cart")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            title="علاقه‌مندی‌ها"
          >
            <Icon name="heart" />
          </button>
          {user ? (
            <div
              className="profile-dropdown-wrapper"
              style={{ position: "relative" }}
            >
              <button
                type="button"
                className="btn primary"
                onClick={(e) => {
                  const dropdown = e.currentTarget
                    .nextElementSibling as HTMLElement;
                  if (dropdown)
                    dropdown.style.display =
                      dropdown.style.display === "flex" ? "none" : "flex";
                }}
              >
                <Icon name="user" />
                <span>{`${user.name || "حساب"} ${user.lastName}`.trim()}</span>
              </button>
              <div
                className="profile-dropdown-menu"
                style={{
                  display: "none",
                  position: "absolute",
                  top: "110%",
                  left: 0,
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  boxShadow: "var(--shadow-lg)",
                  minWidth: "180px",
                  padding: "8px",
                  zIndex: 100,
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <Link
                  to="/orders"
                  style={{
                    display: "block",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    color: "var(--text)",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  <Icon name="bag" style={{ marginInlineEnd: 8 }} /> سفارش‌های
                  من
                </Link>
                <Link
                  to="/wallet"
                  style={{
                    display: "block",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    color: "var(--tamas-accent)",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                >
                  <span style={{ marginInlineEnd: 8 }}>◈</span> کیف پول من
                </Link>
                <button
                  type="button"
                  onClick={() => setCreditOpen(true)}
                  style={{
                    width: "100%",
                    textAlign: "right",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    color: "var(--tamas-accent)",
                    backgroundColor: "transparent",
                    border: "none",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    💳 پرونده اعتباری
                  </span>
                  {userCreditApp && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: "12px",
                        backgroundColor:
                          userCreditApp.status === "active"
                            ? "#dcfce7"
                            : userCreditApp.status === "action_required"
                              ? "#fee2e2"
                              : "#fef3c7",
                        color:
                          userCreditApp.status === "active"
                            ? "#15803d"
                            : userCreditApp.status === "action_required"
                              ? "#dc2626"
                              : "#d97706",
                      }}
                    >
                      ●{" "}
                      {userCreditApp.status === "active"
                        ? "تأیید شده"
                        : userCreditApp.status === "action_required"
                          ? "رد شده"
                          : "در حال بررسی"}
                    </span>
                  )}
                </button>
                {isAdmin && (
                  <Link
                    to="/admin"
                    style={{
                      display: "block",
                      padding: "10px 16px",
                      borderRadius: "8px",
                      color: "var(--tamas-admin-emerald)",
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    <Icon name="grid" style={{ marginInlineEnd: 8 }} /> پنل
                    مدیریت
                  </Link>
                )}
                <div
                  style={{
                    height: "1px",
                    backgroundColor: "var(--border)",
                    margin: "4px 0",
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    toast.ok("از حساب خود خارج شدید.");
                  }}
                  style={{
                    width: "100%",
                    textAlign: "right",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    color: "var(--danger)",
                    backgroundColor: "transparent",
                    border: "none",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Icon
                    name="chevron"
                    style={{ marginInlineEnd: 8, transform: "rotate(180deg)" }}
                  />{" "}
                  خروج از حساب
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setAuthStep("phone");
                setAuthOpen(true);
              }}
            >
              <Icon name="user" />
              <span>ورود / ثبت‌نام همکار</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
