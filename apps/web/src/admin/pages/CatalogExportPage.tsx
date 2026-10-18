import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProductDTO, CategoryDTO, BrandDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { AnimatedDropdown } from '../components/AnimatedDropdown';
import { CatalogPageSheet } from '../components/CatalogPageSheet';

// Convert image URL to Data URL for html2canvas reliability
async function loadImageAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function CatalogExportPage() {
  const toast = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [selectedBrand, setSelectedBrand] = useState<number | 'all'>('all');
  const [stockStatus, setStockStatus] = useState<'all' | 'in' | 'out'>('all');

  const printContainerRef = useRef<HTMLDivElement | null>(null);

  const taxonomy = useQuery({
    queryKey: ['admin', 'taxonomy'],
    queryFn: () => api.get<{ categories: CategoryDTO[]; brands: BrandDTO[] }>('/admin/taxonomy'),
    staleTime: 5 * 60_000,
  });

  const taxonomyData: any = taxonomy.data;
  const categories = taxonomyData?.categories ?? taxonomyData?.data?.categories ?? [];
  const brands = taxonomyData?.brands ?? taxonomyData?.data?.brands ?? [];

  // Fetch products based on filters
  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['admin', 'products', 'catalog-export', selectedCategory, selectedBrand, stockStatus],
    queryFn: () =>
      api.get<{ items: ProductDTO[] }>('/admin/products', {
        categoryId: selectedCategory === 'all' ? undefined : selectedCategory,
        brandId: selectedBrand === 'all' ? undefined : selectedBrand,
        stock: stockStatus,
        status: 'active',
        page: 1,
        perPage: 5000,
      }),
  });

  const responseData: any = productsData;
  const products: ProductDTO[] = Array.isArray(responseData?.items)
    ? responseData.items
    : Array.isArray(responseData?.data?.items)
      ? responseData.data.items
      : Array.isArray(responseData)
        ? responseData
        : [];

  const ITEMS_PER_PAGE = 20; // 4 columns x 5 rows
  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);
  const today = new Date().toLocaleDateString('fa-IR');

  const handleGeneratePdf = () => {
    if (products.length === 0) {
      toast.error('هیچ محصولی برای تهیه کاتالوگ یافت نشد.');
      return;
    }
    toast.ok('لطفاً در پنجره باز شده، گزینه Save as PDF را انتخاب کنید.');
    setTimeout(() => {
      window.print();
    }, 500);
  };

  return (
    <div className="a-page a-fade space-y-6">
      <header className="a-page-head">
        <div>
          <h1 className="a-title-mega-sm flex items-center gap-2">
            <span>📄</span>
            <span>خروجی کاتالوگ PDF</span>
          </h1>
          <p className="a-subtitle">دریافت لیست محصولات به صورت کاتالوگ چاپی استاندارد A4 با فونت فارسی اصیل</p>
        </div>
      </header>

      {/* Control Panel */}
      <section className="a-card">
        <div className="a-card-head">
          <h3 className="a-card-title flex items-center gap-2">
            <span>🎛️</span>
            <span>تنظیمات و فیلترها</span>
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-bold text-[var(--a-t1)] mb-2">دسته‌بندی</label>
              <AnimatedDropdown
                options={[
                  { value: 'all', label: 'همه دسته‌بندی‌ها' },
                  ...categories.map((c: any) => ({ value: String(c.id), label: c.title })),
                ]}
                value={String(selectedCategory)}
                onChange={(val) => setSelectedCategory(val === 'all' ? 'all' : Number(val))}
                placeholder="انتخاب دسته‌بندی"
              />
            </div>

            {/* Brand Filter */}
            <div>
              <label className="block text-sm font-bold text-[var(--a-t1)] mb-2">برند</label>
              <AnimatedDropdown
                options={[
                  { value: 'all', label: 'همه برندها' },
                  ...brands.map((b: any) => ({ value: String(b.id), label: b.faName || b.name })),
                ]}
                value={String(selectedBrand)}
                onChange={(val) => setSelectedBrand(val === 'all' ? 'all' : Number(val))}
                placeholder="انتخاب برند"
              />
            </div>

            {/* Stock Filter */}
            <div>
              <label className="block text-sm font-bold text-[var(--a-t1)] mb-2">وضعیت موجودی</label>
              <AnimatedDropdown
                options={[
                  { value: 'all', label: 'همه (موجود و ناموجود)' },
                  { value: 'in', label: 'فقط موجودها' },
                  { value: 'out', label: 'فقط ناموجودها' },
                ]}
                value={stockStatus}
                onChange={(val: any) => setStockStatus(val)}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-[var(--a-border)] gap-4">
            <div className="text-sm text-[var(--a-t2)]">
              تعداد کالاهای یافت‌شده:{' '}
              <strong className="text-[var(--a-t1)] text-base mx-1">
                {isLoadingProducts ? '...' : formatNumber(products.length)}
              </strong>{' '}
              عدد ({formatNumber(totalPages)} صفحه A4)
            </div>
            <button
              className="a-btn a-btn--primary px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"
              onClick={handleGeneratePdf}
              disabled={isGenerating || isLoadingProducts || products.length === 0}
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>در حال ساخت کاتالوگ ({pdfProgress}٪)</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span>دانلود کاتالوگ PDF (اصلاح‌شده)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Catalog Render & Live Preview Container */}
      <section className="a-card overflow-hidden">
        <div className="a-card-head flex items-center justify-between">
          <h3 className="a-card-title flex items-center gap-2">
            <span>👁️</span>
            <span>پیش‌نمایش صفحات کاتالوگ</span>
          </h3>
          <span className="text-xs text-[var(--a-muted)]">ابعاد استاندارد A4 چاپی</span>
        </div>

        <div className="p-6 bg-[var(--a-bg)] overflow-x-auto">
          {isLoadingProducts ? (
            <div className="p-12 text-center text-[var(--a-muted)] flex flex-col items-center justify-center gap-2">
              <div className="animate-spin text-2xl">⏳</div>
              <div>در حال بارگذاری لیست محصولات...</div>
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center text-[var(--a-muted)]">
              هیچ محصولی با فیلترهای انتخابی یافت نشد.
            </div>
          ) : (
            <div ref={printContainerRef} className="flex flex-col gap-10 items-center">
              {Array.from({ length: totalPages }).map((_, pageIdx) => {
                const pageProducts = products.slice(pageIdx * ITEMS_PER_PAGE, (pageIdx + 1) * ITEMS_PER_PAGE);

                return (
                  <CatalogPageSheet
                    key={pageIdx}
                    pageIdx={pageIdx}
                    totalPages={totalPages}
                    productsLength={products.length}
                    today={today}
                    pageProducts={pageProducts}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
