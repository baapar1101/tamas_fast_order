import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { ProductDTO, CategoryDTO, BrandDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

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

  const handleGeneratePdf = async () => {
    if (products.length === 0) {
      toast.error('هیچ محصولی برای تهیه کاتالوگ یافت نشد.');
      return;
    }

    const container = printContainerRef.current;
    if (!container) {
      toast.error('خطا در دسترسی به کانتینر چاپ.');
      return;
    }

    setIsGenerating(true);
    setPdfProgress(5);
    toast.ok('در حال پردازش کاتالوگ و رندر فونت‌های فارسی...');

    try {
      const pageElements = container.querySelectorAll<HTMLElement>('.pdf-page-sheet');
      if (pageElements.length === 0) {
        throw new Error('صفحات کاتالوگ ایجاد نشدند.');
      }

      const pdf = new jsPDF('p', 'mm', 'a4');

      for (let idx = 0; idx < pageElements.length; idx++) {
        const pageEl = pageElements[idx]!;
        setPdfProgress(Math.round(15 + (idx / pageElements.length) * 75));

        // Render page HTML element to canvas with high DPI scale
        const canvas = await html2canvas(pageEl, {
          scale: 2.2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (idx > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }

      setPdfProgress(98);
      pdf.save(`کاتالوگ-تماس-مارکت-${today.replace(/\//g, '-')}.pdf`);
      toast.ok('فایل PDF کاتالوگ با موفقیت و فونت کاملاً سالم دانلود شد.');
    } catch (error: any) {
      console.error('PDF Generation error:', error);
      toast.error('خطا در ساخت فایل PDF: ' + (error.message || 'ناشناخته'));
    } finally {
      setIsGenerating(false);
      setPdfProgress(0);
    }
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

      {/* Control Card */}
      <section className="a-card">
        <div className="a-card-head">
          <h3 className="a-card-title">فیلترهای صدور کاتالوگ</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Category Filter */}
            <div>
              <label className="a-label">دسته‌بندی</label>
              <select
                className="a-input"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">همه دسته‌بندی‌ها</option>
                {categories.map((cat: CategoryDTO) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.faName || cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand Filter */}
            <div>
              <label className="a-label">برند</label>
              <select
                className="a-input"
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">همه برندها</option>
                {brands.map((brand: BrandDTO) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.faName || brand.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Stock Filter */}
            <div>
              <label className="a-label">وضعیت موجودی</label>
              <select
                className="a-input"
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value as any)}
              >
                <option value="all">همه موارد</option>
                <option value="in">فقط موجود</option>
                <option value="out">فقط ناموجود</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-[var(--a-border)] pt-6 gap-4">
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
                  <div
                    key={pageIdx}
                    className="pdf-page-sheet shadow-2xl rounded-sm"
                    style={{
                      width: '210mm',
                      height: '297mm',
                      padding: '12mm',
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box',
                      fontFamily: "'Vazirmatn', 'Peyda', sans-serif",
                      direction: 'rtl',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      color: '#0f172a',
                    }}
                  >
                    {/* Header */}
                    <div style={{
                      backgroundColor: '#1f2937',
                      color: '#ffffff',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                    }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold', letterSpacing: '-0.3px' }}>
                          کاتالوگ محصولات تماس مارکت
                        </h2>
                        <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>
                          تعداد کالاها: {formatNumber(products.length)} عدد
                        </div>
                      </div>
                      <div style={{ textAlign: 'left', fontSize: '10px', opacity: 0.9, lineHeight: 1.4 }}>
                        <div>تاریخ: {today}</div>
                        <div>صفحه {pageIdx + 1} از {totalPages}</div>
                      </div>
                    </div>

                    {/* Products Grid 4x5 */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gridTemplateRows: 'repeat(5, 1fr)',
                      gap: '8px',
                      flex: 1,
                    }}>
                      {pageProducts.map((p) => {
                        const brandLabel = (p as any).brandFaName || (p as any).brandName || '';
                        return (
                          <div
                            key={p.id}
                            style={{
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              padding: '6px 8px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              boxSizing: 'border-box',
                              overflow: 'hidden',
                            }}
                          >
                            {/* Thumbnail Image */}
                            <div style={{
                              height: '70px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              backgroundColor: '#ffffff',
                              borderRadius: '6px',
                              padding: '2px',
                            }}>
                              <img
                                src={p.imageUrl || '/logo.png'}
                                alt={p.title}
                                style={{ maxHeight: '66px', maxWidth: '100%', objectFit: 'contain' }}
                                crossOrigin="anonymous"
                              />
                            </div>

                            {/* Title & Brand */}
                            <div style={{ marginTop: '4px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                              <div
                                style={{
                                  fontSize: '9.5px',
                                  fontWeight: 'bold',
                                  color: '#1e293b',
                                  lineHeight: 1.35,
                                  height: '26px',
                                  overflow: 'hidden',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  direction: 'rtl',
                                  textAlign: 'right',
                                }}
                              >
                                {p.title}
                              </div>
                              {brandLabel && (
                                <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px', textAlign: 'right' }}>
                                  {brandLabel}
                                </div>
                              )}
                            </div>

                            {/* Divider & Price */}
                            <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '4px', marginTop: '2px', textAlign: 'center' }}>
                              <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#0284c7', direction: 'rtl' }}>
                                {p.price > 0 ? `${formatNumber(p.price)} تومان` : 'تماس بگیرید'}
                              </div>
                              <div
                                style={{
                                  fontSize: '8.5px',
                                  fontWeight: 'bold',
                                  marginTop: '1px',
                                  color: p.stock > 0 || p.kermanStock > 0 || p.tehranStock > 0 ? '#16a34a' : '#dc2626',
                                }}
                              >
                                {p.stock > 0 || p.kermanStock > 0 || p.tehranStock > 0 ? 'موجود' : 'ناموجود'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer */}
                    <div style={{
                      marginTop: '8px',
                      paddingTop: '6px',
                      borderTop: '1px solid #e2e8f0',
                      textAlign: 'center',
                      fontSize: '8.5px',
                      color: '#94a3b8',
                    }}>
                      تهیه شده توسط سیستم مدیریت تماس مارکت — TamasMarket.com
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
