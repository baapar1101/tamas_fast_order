export interface ProductImageSkuRow {
  id: number;
  productId: string;
  sku: string | null;
}

/** Match an image filename to one live product, preserving the site's leading-zero codes. */
export function matchProductImageSku<T extends ProductImageSkuRow>(stem: string, products: T[]): T {
  if (!/^\d+$/.test(stem)) throw new Error(`نام فایل باید کد عددی محصول باشد: ${stem}`);

  const exact = products.filter((row) => row.productId === stem || row.sku === stem);
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) throw new Error(`کد ${stem} به چند محصول فعال اشاره می‌کند.`);

  if (!stem.startsWith('0')) {
    const prefixed = `0${stem}`;
    const matches = products.filter((row) => row.productId === prefixed || row.sku === prefixed);
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1) throw new Error(`کد ${prefixed} به چند محصول فعال اشاره می‌کند.`);
  }

  throw new Error(`محصول فعالی برای عکس ${stem} پیدا نشد.`);
}
