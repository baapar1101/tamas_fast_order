import { Icon } from "../../components/Icon";

interface Category {
  id: number;
  name: string;
  faName: string;
  iconUrl: string | null;
}

interface CategoryToolbarProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export function CategoryToolbar({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryToolbarProps) {
  return (
    <div className="category-toolbar">
      <div className="categories">
        <button
          type="button"
          className={`category-chip${selectedCategory === null ? " active" : ""}`}
          onClick={() => onSelectCategory(null)}
        >
          <span className="chip-icon">
            <Icon name="grid" />
          </span>
          <span className="chip-title">همه کالاها</span>
        </button>
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
              className={`category-chip${selectedCategory === c.name ? " active" : ""}`}
              onClick={() =>
                onSelectCategory(selectedCategory === c.name ? null : c.name)
              }
            >
              {iconSrc ? (
                <img
                  className="chip-icon"
                  src={iconSrc}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <span className="chip-icon">
                  <Icon name="box" />
                </span>
              )}
              <span className="chip-title">{c.faName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
