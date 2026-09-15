import type { BrandDTO, CategoryDTO, ColorDTO, ProductDTO, ProductGroupDTO } from '@tamas/shared';
import type { BootstrapData, CatalogFilters } from './hooks';

// Inline fallback snapshot from legacy/catalog_backup.json
import fallbackJson from '../../../../legacy/catalog_backup.json';

interface RawCategory {
  category_name?: string;
  category_fa_name?: string;
  icon_url?: string;
  Brand?: string;
}

interface RawBrand {
  brand_name?: string;
  brand_fa_name?: string;
  icon_url?: string;
}

interface RawColor {
  color_name?: string;
  color_fa_name?: string;
  color_code?: string;
}

interface RawProduct {
  product_id?: string | null;
  title?: string | null;
  model?: string | null;
  Category?: string | null;
  Brand?: string | null;
  category?: string | null;
  brand?: string | null;
  color?: string | null;
  color_en?: string | null;
  color_code?: string | null;
  price?: number | string | null;
  old_price?: number | string | null;
  kerman_stock?: number | string | null;
  tehran_stock?: number | string | null;
  stock?: number | string | null;
  image_url?: string | null;
  sell_type?: string | null;
  warranty?: string | null;
  promotion?: boolean | string | null;
  sku?: string | null;
}

const data = (fallbackJson as unknown as { catalog?: typeof fallbackJson }).catalog ?? fallbackJson;

export const fallbackCategories: CategoryDTO[] = ((data.categories as RawCategory[]) ?? []).map((c, i) => ({
  id: i + 1,
  name: c.category_name || '',
  faName: c.category_fa_name || c.category_name || '',
  iconUrl: c.icon_url || null,
  sortOrder: i,
  brandNames: (c.Brand || '').split(/[,،;|]+/).map((s) => s.trim()).filter(Boolean),
}));

export const fallbackBrands: BrandDTO[] = ((data.brands as RawBrand[]) ?? []).map((b, i) => ({
  id: i + 1,
  name: b.brand_name || '',
  faName: b.brand_fa_name || b.brand_name || '',
  iconUrl: b.icon_url || null,
  sortOrder: i,
}));

export const fallbackColors: ColorDTO[] = ((data.colors as RawColor[]) ?? []).map((c, i) => ({
  id: i + 1,
  name: c.color_name || null,
  faName: c.color_fa_name || c.color_name || null,
  code: c.color_code || '#00768f',
}));

export const fallbackSettings: Record<string, string> = {
  store_name: 'تماس مارکت',
  store_tagline: 'مرجع تخصصی فروش عمده کالای دیجیتال',
  support_phone: '034-32220000',
  store_address: 'کرمان، خیابان شریعتی، مجتمع دیجیتال تماس',
};

export function getFallbackBootstrap(): BootstrapData {
  return {
    categories: fallbackCategories,
    brands: fallbackBrands,
    colors: fallbackColors,
    settings: fallbackSettings,
  };
}

function parseNum(v: unknown): number {
  if (typeof v === 'number') return v;
  const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'بله';
}

const rawProducts = ((data.products as unknown as RawProduct[]) ?? []).filter(
  (product) => Boolean(product.product_id || product.sku),
);

const allProducts: ProductDTO[] = rawProducts.map<ProductDTO>((p, i) => {
  const price = parseNum(p.price);
  const oldPrice = parseNum(p.old_price);
  const kermanStock = parseNum(p.kerman_stock);
  const tehranStock = parseNum(p.tehran_stock);
  const stock = parseNum(p.stock) || kermanStock + tehranStock;

  return {
    id: i + 1,
    productId: p.product_id || `P-${i + 1}`,
    sku: p.sku || p.product_id || `SKU-${i + 1}`,
    title: p.title || p.model || 'محصول بدون عنوان',
    model: p.model || p.title || '',
    categoryName: p.category || p.Category || null,
    categoryFaName: p.category || p.Category || null,
    brandName: p.brand || p.Brand || null,
    brandFaName: p.brand || p.Brand || null,
    parentProductId: null,
    otherStocks: {},
    color: p.color || null,
    colorEn: p.color_en || null,
    colorCode: p.color_code || null,
    price,
    oldPrice: oldPrice > price ? oldPrice : null,
    discount: oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0,
    stock,
    kermanStock,
    tehranStock,
    warranty: p.warranty || null,
    sellType: p.sell_type || 'نقدی',
    seller: 'تماس مارکت',
    promotion: parseBool(p.promotion),
    status: 'active',
    subTitle: null,
    description: null,
    keywords: null,
    slug: null,
    ribbon: null,
    type: 'physical',
    weight: 0,
    dimensions: null,
    tracking: true,
    imageUrl: p.image_url || '/logo.png',
    gallery: [],
    attributes: [],
    sortOrder: i,
    updatedAt: new Date().toISOString(),
  };
}).filter((product) =>
  product.price > 0 && (product.stock > 0 || product.kermanStock > 0 || product.tehranStock > 0),
);

// Group products by title/model
const groupedMap = new Map<string, ProductDTO[]>();
for (const p of allProducts) {
  const key = (p.title || p.model || p.productId).trim();
  const list = groupedMap.get(key) ?? [];
  list.push(p);
  groupedMap.set(key, list);
}

const allGroups: ProductGroupDTO[] = Array.from(groupedMap.entries()).map(([key, variants]) => {
  const first = variants[0]!;
  const prices = variants.map((v) => v.price).filter((p) => p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  return {
    key,
    title: first.title,
    imageUrl: first.imageUrl,
    promotion: variants.some((v) => v.promotion),
    minPrice,
    variants,
  };
});

export function getFallbackProducts(filters: CatalogFilters): {
  groups: ProductGroupDTO[];
  total: number;
  page: number;
  perPage: number;
} {
  let filtered = allGroups;

  if (filters.q) {
    const q = filters.q.toLowerCase();
    filtered = filtered.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.variants.some(
          (v) =>
            (v.model || '').toLowerCase().includes(q) ||
            (v.brandName || '').toLowerCase().includes(q) ||
            (v.sku || '').toLowerCase().includes(q),
        ),
    );
  }

  if (filters.category) {
    const cat = filters.category.toLowerCase();
    filtered = filtered.filter((g) =>
      g.variants.some((v) => (v.categoryFaName || '').toLowerCase() === cat || (v.categoryName || '').toLowerCase() === cat),
    );
  }

  if (filters.brands && filters.brands.length > 0) {
    const bSet = new Set(filters.brands.map((b) => b.toLowerCase()));
    filtered = filtered.filter((g) =>
      g.variants.some((v) => bSet.has((v.brandFaName || '').toLowerCase()) || bSet.has((v.brandName || '').toLowerCase())),
    );
  }

  if (filters.promotion) {
    filtered = filtered.filter((g) => g.promotion);
  }

  // Sort
  filtered = [...filtered].sort((a, b) => {
    const priceA = a.minPrice;
    const priceB = b.minPrice;
    if (filters.sort === 'price_asc') return priceA - priceB;
    if (filters.sort === 'price_desc') return priceB - priceA;
    if (filters.sort === 'title') return a.title.localeCompare(b.title, 'fa');
    return 0;
  });

  const total = filtered.length;
  const perPage = 24;
  const page = Math.max(1, filters.page);
  const start = (page - 1) * perPage;
  const pageGroups = filtered.slice(start, start + perPage);

  return {
    groups: pageGroups,
    total,
    page,
    perPage,
  };
}
