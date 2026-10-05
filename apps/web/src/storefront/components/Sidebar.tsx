import { Icon } from "../../components/Icon";

interface SidebarProps {
  filtersOpen: boolean;
  brandsCollapsed: boolean;
  setBrandsCollapsed: (collapsed: boolean) => void;
  brands: string[];
  setBrands: (brands: string[]) => void;
  visibleBrands: any[];
  resetPage: () => void;
  inStockOnly: boolean;
  setInStockOnly: (stock: boolean) => void;
  promotion: boolean;
  setPromotion: (promo: boolean) => void;
  creditOnly: boolean;
  setCreditOnly: (credit: boolean) => void;
}

export function Sidebar({
  filtersOpen,
  brandsCollapsed,
  setBrandsCollapsed,
  brands,
  setBrands,
  visibleBrands,
  resetPage,
  inStockOnly,
  setInStockOnly,
  promotion,
  setPromotion,
  creditOnly,
  setCreditOnly,
}: SidebarProps) {
  return (
    <aside className={`sidebar${filtersOpen ? " open" : ""}`}>
      <div className="sidebar-body">
        <div
          className="side-title accordion-title"
          onClick={() => setBrandsCollapsed(!brandsCollapsed)}
          style={{ cursor: "pointer", userSelect: "none" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            برندها
            <Icon
              name="chevron"
              className="accordion-chevron"
              style={{
                transform: brandsCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                transition: "transform 0.25s ease",
                fontSize: 14,
              }}
            />
          </span>
          {brands.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setBrands([]);
              }}
              style={{
                fontSize: 12,
                color: "var(--tamas-accent)",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              همه (پاک‌سازی)
            </button>
          )}
        </div>
        <div
          className={`brand-icons-wrapper${brandsCollapsed ? " collapsed" : ""}`}
        >
          <div className="brand-icons">
            {visibleBrands.map((b) => {
              const on = brands.includes(b.name);
              const iconSrc = b.iconUrl
                ? b.iconUrl.startsWith("http") || b.iconUrl.startsWith("/")
                  ? b.iconUrl
                  : b.iconUrl.startsWith("img_")
                    ? `/uploads/${b.iconUrl}`
                    : `/assets/brand/${b.iconUrl}`
                : null;
              return (
                <button
                  key={b.id}
                  type="button"
                  className={`brand-icon-btn${on ? " active" : ""}`}
                  onClick={() => {
                    setBrands(
                      on
                        ? brands.filter((x) => x !== b.name)
                        : [...brands, b.name],
                    );
                    resetPage();
                  }}
                >
                  {iconSrc ? (
                    <img src={iconSrc} alt={b.faName} loading="lazy" />
                  ) : (
                    <Icon name="mobile" style={{ fontSize: 16 }} />
                  )}
                  <span className="brand-name">{b.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="side-title" style={{ marginTop: 20 }}>
          فیلترهای سریع
        </div>
        <div className="switch-row">
          <span>فقط کالاهای موجود</span>
          <button
            type="button"
            className={`switch${inStockOnly ? " on" : ""}`}
            onClick={() => setInStockOnly(!inStockOnly)}
          >
            <i />
          </button>
        </div>
        <div className="switch-row">
          <span>پیشنهاد ویژه</span>
          <button
            type="button"
            className={`switch${promotion ? " on" : ""}`}
            onClick={() => {
              setPromotion(!promotion);
              resetPage();
            }}
          >
            <i />
          </button>
        </div>
        <div className="switch-row">
          <span>تسویه چکی و اعتباری</span>
          <button
            type="button"
            className={`switch${creditOnly ? " on" : ""}`}
            onClick={() => {
              setCreditOnly(!creditOnly);
              resetPage();
            }}
          >
            <i />
          </button>
        </div>
      </div>
    </aside>
  );
}
