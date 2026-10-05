import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type {
  CreditApplicationDTO,
  ProductDTO,
  Warehouse,
} from "@tamas/shared";
import { formatNumber } from "@tamas/shared";
import { useToast } from "../components/Toast";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { cartCount, useCart } from "../store/cart";
import { AuthDialog } from "./AuthDialog";
import { CartPanel } from "./CartPanel";
import { CheckoutDialog } from "./CheckoutDialog";
import { CreditDialog } from "./CreditDialog";
import { InstallBanner } from "./InstallBanner";
import { ProductCard } from "./ProductCard";
import { createColorMap } from "./productColor";
import {
  useBootstrap,
  useDebounced,
  useProducts,
  type CatalogFilters,
  type StorefrontSlide,
} from "./hooks";
import { Icon } from "../components/Icon";
import { ThemeToggle } from "../components/ThemeToggle";
import { CrmChat } from "../components/CrmChat";
import { StoreFooter } from "./StoreFooter";
import { IncompleteProfilePopup } from "./IncompleteProfilePopup";
import { GuestPromoPopup } from "./GuestPromoPopup";
import {
  StorefrontHeader,
  MobileViews,
  HeroSlider,
  CategoryToolbar,
  Sidebar,
  MobileNavigation,
} from "./components";
import "./storefront.css";

const SORT_LABELS: Record<CatalogFilters["sort"], string> = {
  price_asc: "ارزان‌ترین",
  price_desc: "گران‌ترین",
  newest: "جدیدترین",
  title: "حروف الفبا",
};

const FALLBACK_HERO_SLIDES: StorefrontSlide[] = [
  {
    id: -1,
    title: "گوشی‌های اپل",
    imageUrl: "/assets/slides/slide-01.jpg",
    mobileImageUrl: null,
    linkUrl: "/?brand=Apple",
  },
  {
    id: -2,
    title: "گوشی‌های شیائومی",
    imageUrl: "/assets/slides/slide-02.jpg",
    mobileImageUrl: null,
    linkUrl: "/?brand=Xiaomi",
  },
  {
    id: -3,
    title: "گوشی‌های سامسونگ",
    imageUrl: "/assets/slides/slide-03.jpg",
    mobileImageUrl: null,
    linkUrl: "/?brand=Samsung",
  },
];

function ProductSkeletons({ viewMode }: { viewMode: "list" | "grid" }) {
  if (viewMode === "grid") {
    return (
      <div className="products-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="product-card">
            <div
              className="skeleton"
              style={{ width: "100%", height: 160, marginBottom: 12 }}
            />
            <div
              className="skeleton"
              style={{ height: 18, width: "75%", marginBottom: 10 }}
            />
            <div
              className="skeleton"
              style={{ height: 14, width: "40%", marginBottom: 16 }}
            />
            <div className="skeleton" style={{ height: 38, width: "100%" }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="products-list">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="product" style={{ display: "flex", gap: 14 }}>
          <div
            className="skeleton"
            style={{ width: 200, height: 200, flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div
              className="skeleton"
              style={{ height: 18, width: "70%", marginBottom: 12 }}
            />
            <div
              className="skeleton"
              style={{ height: 14, width: "40%", marginBottom: 16 }}
            />
            <div className="skeleton" style={{ height: 40, width: "100%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StorefrontPage() {
  const toast = useToast();
  const { user, complete, isAdmin, logout } = useAuth();
  const addToCart = useCart((s) => s.add);
  const lines = useCart((s) => s.lines);

  const [searchParams, setSearchParams] = useSearchParams();

  const [creditOpen, setCreditOpen] = useState(false);
  const [userCreditApp, setUserCreditApp] =
    useState<CreditApplicationDTO | null>(null);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState<string | null>(
    searchParams.get("cat") || null,
  );
  const [brands, setBrands] = useState<string[]>(
    searchParams.get("brand") ? searchParams.get("brand")!.split(",") : [],
  );
  const [promotion, setPromotion] = useState(searchParams.get("promo") === "1");
  const [creditOnly, setCreditOnly] = useState(
    searchParams.get("credit") === "1",
  );
  const [inStockOnly, setInStockOnly] = useState(
    searchParams.get("stock") !== "0",
  );
  const [sort, setSort] = useState<CatalogFilters["sort"]>(
    (searchParams.get("sort") as CatalogFilters["sort"]) || "price_asc",
  );
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [viewMode, setViewMode] = useState<"list" | "grid">(
    (searchParams.get("view") as "list" | "grid") || "grid",
  );
  const [mobileTab, setMobileTab] = useState<
    "home" | "categories" | "search" | "cart" | "profile"
  >("home");

  const brandsStr = brands.join(",");

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (search) params.set("q", search);
    else params.delete("q");
    if (category) params.set("cat", category);
    else params.delete("cat");
    if (brandsStr) params.set("brand", brandsStr);
    else params.delete("brand");
    if (promotion) params.set("promo", "1");
    else params.delete("promo");
    if (creditOnly) params.set("credit", "1");
    else params.delete("credit");
    if (!inStockOnly) params.set("stock", "0");
    else params.delete("stock");
    if (sort !== "price_asc") params.set("sort", sort);
    else params.delete("sort");
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    if (viewMode !== "grid") params.set("view", viewMode);
    else params.delete("view");

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [
    search,
    category,
    brandsStr,
    promotion,
    creditOnly,
    inStockOnly,
    sort,
    page,
    viewMode,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    const q = searchParams.get("q") || "";
    if (search !== q) setSearch(q);

    const cat = searchParams.get("cat") || null;
    if (category !== cat) setCategory(cat);

    const brandParam = searchParams.get("brand") || "";
    if (brands.join(",") !== brandParam) {
      setBrands(brandParam ? brandParam.split(",") : []);
    }

    const promo = searchParams.get("promo") === "1";
    if (promotion !== promo) setPromotion(promo);

    const credit = searchParams.get("credit") === "1";
    if (creditOnly !== credit) setCreditOnly(credit);

    const stock = searchParams.get("stock") !== "0";
    if (inStockOnly !== stock) setInStockOnly(stock);

    const s =
      (searchParams.get("sort") as CatalogFilters["sort"]) || "price_asc";
    if (sort !== s) setSort(s);

    const p = Number(searchParams.get("page")) || 1;
    if (page !== p) setPage(p);

    const v = (searchParams.get("view") as "list" | "grid") || "grid";
    if (viewMode !== v) setViewMode(v);
  }, [searchParams]);

  const [authOpen, setAuthOpen] = useState(false);
  const [authStep, setAuthStep] = useState<"phone" | "profile">("phone");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [brandsCollapsed, setBrandsCollapsed] = useState(true);

  const debouncedSearch = useDebounced(search);
  const filters: CatalogFilters = useMemo(
    () => ({
      q: debouncedSearch,
      category,
      brands,
      promotion,
      creditOnly,
      sort,
      page,
    }),
    [debouncedSearch, category, brands, promotion, creditOnly, sort, page],
  );

  const bootstrap = useBootstrap();
  const products = useProducts(filters);
  const heroSlides = bootstrap.data?.slides ?? FALLBACK_HERO_SLIDES;

  /** code/name → hex, so a variant swatch can be resolved without extra requests. */
  const colorMap = useMemo(
    () => createColorMap(bootstrap.data?.colors),
    [bootstrap.data?.colors],
  );

  /** Brands shown in sidebar narrow to the selected category. */
  const visibleBrands = useMemo(() => {
    const all = bootstrap.data?.brands ?? [];
    if (!category) return all;
    const cat = bootstrap.data?.categories.find(
      (c) => c.name === category || c.faName === category,
    );
    if (!cat || cat.brandNames.length === 0) return all;
    const allowed = new Set(cat.brandNames.map((b) => b.toLowerCase()));
    const narrowed = all.filter(
      (b) =>
        allowed.has(b.faName.toLowerCase()) ||
        allowed.has(b.name.toLowerCase()),
    );
    return narrowed.length > 0 ? narrowed : all;
  }, [bootstrap.data, category]);

  const resetPage = useCallback(() => setPage(1), []);

  const setQty = useCart((s) => s.setQty);

  const handleUpdateQty = useCallback(
    (key: string, newQty: number) => {
      if (!user) {
        setAuthStep("phone");
        setAuthOpen(true);
        return;
      }
      setQty(key, newQty);
    },
    [setQty, user],
  );

  const handleAdd = useCallback(
    (product: ProductDTO, warehouse: Warehouse) => {
      if (!user) {
        setAuthStep("phone");
        setAuthOpen(true);
        return;
      }
      const result = addToCart(product, warehouse);
      if (!result.ok) toast.error(result.message ?? "افزودن به سبد ممکن نشد.");
      else toast.ok("به سبد خرید اضافه شد.");
    },
    [addToCart, toast, user],
  );

  const openCheckout = useCallback(() => {
    if (lines.length === 0) {
      toast.error("سبد خرید شما خالی است.");
      return;
    }
    if (!user) {
      setAuthStep("phone");
      setAuthOpen(true);
      return;
    }
    if (!user.isActive) {
      toast.error("حساب همکاری شما هنوز تأیید نشده است.");
      return;
    }
    if (!complete) {
      setAuthStep("profile");
      setAuthOpen(true);
      return;
    }
    setCheckoutOpen(true);
  }, [lines.length, user, complete, toast]);

  const settings = bootstrap.data?.settings ?? {};
  const canViewPrices = Boolean(user?.isActive);
  const [promoOrange, setPromoOrange] = useState(false);

  // Switch topbar promo to orange credit banner a few seconds after login
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => {
        setPromoOrange(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setPromoOrange(false);
    }
  }, [user]);

  // Fetch user credit application status for header & profile dropdown
  useEffect(() => {
    if (!user) {
      setUserCreditApp(null);
      return;
    }
    api
      .get<{ ok: true; application: CreditApplicationDTO | null }>(
        "/credit/my-application",
      )
      .then((res) => {
        if (res.ok) setUserCreditApp(res.application);
      })
      .catch(() => {});
  }, [user, creditOpen]);

  const groups = products.data?.groups ?? [];
  const total = products.data?.total ?? 0;
  const perPage = products.data?.perPage ?? 24;
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="shell">
      <StorefrontHeader
        user={user}
        isAdmin={isAdmin}
        userCreditApp={userCreditApp}
        settings={settings}
        search={search}
        setSearch={setSearch}
        resetPage={resetPage}
        promoOrange={promoOrange}
        setCreditOpen={setCreditOpen}
        setAuthStep={setAuthStep}
        setAuthOpen={setAuthOpen}
        logout={logout}
        toast={toast}
      />

      <main className="container" data-mobile-tab={mobileTab}>
        <MobileViews
          mobileTab={mobileTab}
          setMobileTab={setMobileTab}
          categories={bootstrap.data?.categories ?? []}
          setCategory={setCategory}
          setBrands={setBrands}
          resetPage={resetPage}
          user={user}
          isAdmin={isAdmin}
          logout={logout}
          toast={toast}
          setAuthStep={setAuthStep}
          setAuthOpen={setAuthOpen}
          openCheckout={openCheckout}
          canViewPrices={canViewPrices}
        />

        {heroSlides.length > 0 && <HeroSlider slides={heroSlides} />}

        <CategoryToolbar
          categories={bootstrap.data?.categories ?? []}
          selectedCategory={category}
          onSelectCategory={(cat) => {
            setCategory(cat);
            setBrands([]);
            resetPage();
          }}
        />

        {/* 3-Column Layout Grid */}
        <div className="layout">
          {/* Sidebar (Right Column in RTL) */}
          <Sidebar
            filtersOpen={filtersOpen}
            brandsCollapsed={brandsCollapsed}
            setBrandsCollapsed={setBrandsCollapsed}
            brands={brands}
            setBrands={(brands) => {
              setBrands(brands);
              resetPage();
            }}
            visibleBrands={visibleBrands}
            resetPage={resetPage}
            inStockOnly={inStockOnly}
            setInStockOnly={setInStockOnly}
            promotion={promotion}
            setPromotion={setPromotion}
            creditOnly={creditOnly}
            setCreditOnly={setCreditOnly}
          />

          {/* Main Content (Center Column) */}
          <section className="main-content">
            <div className="toolbar">
              <div className="toolbar-head">
                <div className="toolbar-result">
                  <strong>{formatNumber(total)}</strong>
                  <span>کالا پیدا شد</span>
                </div>
                {(brands.length > 0 ||
                  category ||
                  promotion ||
                  creditOnly ||
                  search) && (
                  <button
                    type="button"
                    className="btn sm toolbar-reset"
                    onClick={() => {
                      setSearch("");
                      setCategory(null);
                      setBrands([]);
                      setPromotion(false);
                      setCreditOnly(false);
                      setInStockOnly(false);
                      resetPage();
                    }}
                  >
                    پاک‌کردن فیلترها
                  </button>
                )}
              </div>

              <div className="toolbar-controls">
                <div className="view-control">
                  <span className="toolbar-control-label">نحوه نمایش</span>
                  <div className="view-btn-group">
                    <button
                      type="button"
                      className={`view-btn${viewMode === "list" ? " active" : ""}`}
                      onClick={() => setViewMode("list")}
                    >
                      <Icon name="filter" /> لیستی (عمده)
                    </button>
                    <button
                      type="button"
                      className={`view-btn${viewMode === "grid" ? " active" : ""}`}
                      onClick={() => setViewMode("grid")}
                    >
                      <Icon name="grid" /> شبکه‌ای
                    </button>
                  </div>
                </div>

                <div className="sort-control">
                  <label htmlFor="sort">مرتب‌سازی</label>
                  <select
                    id="sort"
                    className="select sort-select"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value as CatalogFilters["sort"]);
                      resetPage();
                    }}
                  >
                    {Object.entries(SORT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {!canViewPrices && (
              <div className="price-lock-note">
                <span>
                  {user
                    ? "قیمت‌ها پس از تأیید حساب همکاری شما نمایش داده می‌شوند."
                    : "برای مشاهده قیمت‌های عمده وارد حساب همکار شوید."}
                </span>
                {!user && (
                  <button
                    type="button"
                    className="btn-lock-auth"
                    onClick={() => {
                      setAuthStep("phone");
                      setAuthOpen(true);
                    }}
                  >
                    ورود / ثبت‌نام
                  </button>
                )}
              </div>
            )}

            {products.isLoading ? (
              <ProductSkeletons viewMode={viewMode} />
            ) : products.isError ? (
              <div
                className="card"
                style={{
                  textAlign: "center",
                  color: "var(--danger)",
                  padding: 32,
                }}
              >
                دریافت کالاها ناموفق بود. صفحه را دوباره بارگذاری کنید.
              </div>
            ) : groups.length === 0 ? (
              <div
                className="card"
                style={{
                  textAlign: "center",
                  color: "var(--text-muted)",
                  padding: 48,
                }}
              >
                محصولی با این مشخصات پیدا نشد.
              </div>
            ) : (
              <>
                <div
                  className={
                    viewMode === "grid" ? "products-grid" : "products-list"
                  }
                  style={{
                    opacity: products.isFetching ? 0.65 : 1,
                    transition: "opacity .15s",
                  }}
                >
                  {groups.map((g) => (
                    <ProductCard
                      key={g.key}
                      group={g}
                      colorMap={colorMap}
                      canViewPrices={canViewPrices}
                      viewMode={viewMode}
                      cartLines={lines}
                      onAdd={handleAdd}
                      onUpdateQty={handleUpdateQty}
                      onPreview={setPreview}
                    />
                  ))}
                </div>

                {pageCount > 1 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 14,
                      marginTop: 24,
                    }}
                  >
                    <button
                      type="button"
                      className="btn"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      قبلی
                    </button>
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      صفحه {formatNumber(page)} از {formatNumber(pageCount)}
                    </span>
                    <button
                      type="button"
                      className="btn"
                      disabled={page >= pageCount}
                      onClick={() => setPage(page + 1)}
                    >
                      بعدی
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Cart Panel (Left Column) */}
          <CartPanel onCheckout={openCheckout} canViewPrices={canViewPrices} />
        </div>
      </main>

      <StoreFooter />

      <AuthDialog
        open={authOpen}
        initialStep={authStep}
        onClose={() => setAuthOpen(false)}
        onOpenCredit={() => setCreditOpen(true)}
        onReady={() => {
          if (lines.length > 0) setCheckoutOpen(true);
        }}
      />

      <IncompleteProfilePopup
        show={!!user && !complete}
        onComplete={() => {
          setAuthStep("profile");
          setAuthOpen(true);
        }}
        onLogout={async () => {
          await logout();
          toast.ok("از حساب خارج شدید.");
        }}
      />

      <GuestPromoPopup
        show={!user}
        onAuth={() => {
          setAuthStep("phone");
          setAuthOpen(true);
        }}
      />

      <CheckoutDialog
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onNeedsProfile={() => {
          setAuthStep("profile");
          setAuthOpen(true);
        }}
      />

      <CreditDialog open={creditOpen} onClose={() => setCreditOpen(false)} />

      {preview && (
        <div
          className="lightbox"
          onClick={() => setPreview(null)}
          role="presentation"
        >
          <img src={preview} alt="" />
        </div>
      )}

      <MobileNavigation
        mobileTab={mobileTab}
        setMobileTab={setMobileTab}
        lines={lines}
        user={user}
        onHomeClick={() => {
          setSearch("");
          setCategory(null);
          setBrands([]);
          setPromotion(false);
          setInStockOnly(false);
          resetPage();
        }}
      />

      {/* CRM Chat Widget */}
      <CrmChat user={user || undefined} />

      {/* PWA Install Banner */}
      <InstallBanner />
    </div>
  );
}
