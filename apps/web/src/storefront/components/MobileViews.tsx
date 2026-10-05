import { Link } from "react-router-dom";
import { Icon } from "../../components/Icon";
import { CartPanel } from "../CartPanel";

interface MobileViewsProps {
  mobileTab: "home" | "categories" | "search" | "cart" | "profile";
  setMobileTab: (
    tab: "home" | "categories" | "search" | "cart" | "profile",
  ) => void;
  categories: any[];
  setCategory: (category: string | null) => void;
  setBrands: (brands: string[]) => void;
  resetPage: () => void;
  user: any;
  isAdmin: boolean;
  logout: () => Promise<void>;
  toast: any;
  setAuthStep: (step: "phone" | "profile") => void;
  setAuthOpen: (open: boolean) => void;
  openCheckout: () => void;
  canViewPrices: boolean;
}

export function MobileViews({
  mobileTab,
  setMobileTab,
  categories,
  setCategory,
  setBrands,
  resetPage,
  user,
  isAdmin,
  logout,
  toast,
  setAuthStep,
  setAuthOpen,
  openCheckout,
  canViewPrices,
}: MobileViewsProps) {
  if (mobileTab === "home") return null;

  return (
    <>
      {/* Mobile-only Categories View */}
      {mobileTab === "categories" && (
        <div className="mobile-only-categories">
          <div
            style={{
              padding: "20px 16px",
              background: "var(--card)",
              borderBottom: "1px solid var(--tamas-border)",
              position: "sticky",
              top: 0,
              zIndex: 10,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "var(--tamas-fg)",
              }}
            >
              دسته‌بندی محصولات
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 12,
              padding: 16,
            }}
          >
            {categories.map((c) => {
              const iconSrc = c.iconUrl
                ? c.iconUrl.startsWith("http") || c.iconUrl.startsWith("/")
                  ? c.iconUrl
                  : c.iconUrl.startsWith("img_")
                    ? `/uploads/${c.iconUrl}`
                    : `/assets/category/${c.iconUrl}`
                : null;
              return (
                <button
                  key={c.id}
                  type="button"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                    padding: "24px 12px",
                    background: "var(--card)",
                    borderRadius: 16,
                    border: "1px solid var(--tamas-border)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
                  }}
                  onClick={() => {
                    setCategory(c.name);
                    setBrands([]);
                    resetPage();
                    setMobileTab("home");
                  }}
                >
                  {iconSrc ? (
                    <img
                      src={iconSrc}
                      alt=""
                      loading="lazy"
                      style={{ width: 48, height: 48, objectFit: "contain" }}
                    />
                  ) : (
                    <span
                      style={{ fontSize: 32, color: "var(--tamas-accent)" }}
                    >
                      <Icon name="box" />
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--tamas-fg)",
                    }}
                  >
                    {c.faName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Mobile-only Cart View */}
      {mobileTab === "cart" && (
        <div className="mobile-only-cart" style={{ paddingBottom: 100 }}>
          <CartPanel
            onCheckout={openCheckout}
            canViewPrices={canViewPrices}
            hidePrintLayout
          />
        </div>
      )}

      {/* Mobile-only Profile View */}
      {mobileTab === "profile" && (
        <div
          className="mobile-only-profile"
          style={{ padding: 16, paddingBottom: 100 }}
        >
          {user ? (
            <div
              style={{
                background: "var(--card)",
                borderRadius: 16,
                padding: 20,
                boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
                textAlign: "center",
                border: "1px solid var(--tamas-border)",
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "var(--tamas-accent)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  fontWeight: 800,
                  margin: "0 auto 16px",
                }}
              >
                {user.name?.[0] || "U"}
              </div>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "var(--tamas-fg)",
                  marginBottom: 4,
                }}
              >
                {user.name} {user.lastName}
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--tamas-muted)",
                  marginBottom: 24,
                }}
              >
                {user.phone}
              </p>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <Link
                  to="/orders"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 16,
                    background: "var(--tamas-info-bg)",
                    borderRadius: 12,
                    color: "var(--tamas-fg)",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  <Icon name="bag" /> سفارش‌های من
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 16,
                      background: "rgba(5, 150, 105, 0.1)",
                      borderRadius: 12,
                      color: "#10b981",
                      textDecoration: "none",
                      fontWeight: 600,
                    }}
                  >
                    <Icon name="grid" /> پنل مدیریت
                  </Link>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    toast.ok("از حساب خود خارج شدید.");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 16,
                    background: "rgba(225, 29, 72, 0.1)",
                    borderRadius: 12,
                    color: "var(--danger)",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Icon
                    name="chevron"
                    style={{ transform: "rotate(180deg)" }}
                  />{" "}
                  خروج از حساب
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "var(--card)",
                borderRadius: 16,
                padding: 32,
                boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
                textAlign: "center",
                marginTop: 40,
                border: "1px solid var(--tamas-border)",
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "var(--tamas-info-bg)",
                  color: "var(--tamas-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  margin: "0 auto 16px",
                }}
              >
                <Icon name="user" />
              </div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "var(--tamas-fg)",
                  marginBottom: 12,
                }}
              >
                وارد حساب کاربری شوید
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--tamas-muted)",
                  marginBottom: 24,
                  lineHeight: 1.6,
                }}
              >
                برای مشاهده قیمت‌های همکاری و ثبت سفارش، لطفاً وارد شوید.
              </p>
              <button
                type="button"
                className="btn primary w-full"
                onClick={() => {
                  setAuthStep("phone");
                  setAuthOpen(true);
                }}
              >
                ورود / ثبت‌نام
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
