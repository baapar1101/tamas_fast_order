import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { ProductDTO, CategoryDTO, BrandDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

export function CatalogExportPage() {
  const toast = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [selectedBrand, setSelectedBrand] = useState<number | 'all'>('all');
  const [stockStatus, setStockStatus] = useState<'all' | 'in' | 'out'>('all');

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
        status: 'active', // Only active products for catalog
        page: 1,
        perPage: 5000,
      }),
  });

  const products = Array.isArray(productsData?.items) ? productsData.items : [];

  const handleGeneratePdf = async () => {
    if (products.length === 0) {
      toast.error('هیچ محصولی برای تهیه کاتالوگ یافت نشد.');
      return;
    }

    setIsGenerating(true);
    setPdfProgress(0);
    toast.ok('در حال آماده‌سازی فایل PDF، لطفاً شکیبا باشید...');

    try {
      const PRODUCTS_PER_PAGE = 20; // 4 columns * 5 rows
      const totalPages = Math.ceil(products.length / PRODUCTS_PER_PAGE);
      const pdf = new jsPDF('p', 'mm', 'a4');

      for (let i = 0; i < totalPages; i++) {
        setPdfProgress(Math.round(((i) / totalPages) * 100));
        const pageEl = document.getElementById(`pdf-page-${i}`);
        if (!pageEl) continue;

        // Render to canvas
        const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true, logging: false });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }

      setPdfProgress(100);
      pdf.save(`کاتالوگ-تماس-مارکت-${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.pdf`);
      toast.ok('فایل PDF با موفقیت دانلود شد.');
    } catch (error) {
      console.error('PDF Generation error:', error);
      toast.error('خطا در ساخت فایل PDF');
    } finally {
      setIsGenerating(false);
      setPdfProgress(0);
    }
  };

  return (
    <div className="a-page a-fade">
      <header className="a-page-head">
        <div>
          <h1 className="a-title-mega-sm">خروجی کاتالوگ PDF</h1>
          <p className="a-subtitle">دریافت لیست محصولات به صورت کاتالوگ زیبا و آماده چاپ</p>
        </div>
      </header>

      <div className="admin-page-grid" style={{ gridTemplateColumns: '1fr' }}>
        <section className="a-card">
          <div className="a-card-head">
            <h3 className="a-card-title">تنظیمات کاتالوگ</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

            <div className="flex items-center justify-between border-t border-[var(--a-border)] pt-6">
              <div className="text-sm text-[var(--a-t2)]">
                تعداد کالاهای یافت شده:{' '}
                <strong className="text-[var(--a-t1)] text-base mx-1">
                  {isLoadingProducts ? '...' : formatNumber(products.length)}
                </strong>{' '}
                عدد
              </div>
              <button
                className="a-btn a-btn--primary"
                onClick={handleGeneratePdf}
                disabled={isGenerating || isLoadingProducts || products.length === 0}
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2" />
                    در حال ساخت ({pdfProgress}%)
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5 ml-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.8"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    دانلود کاتالوگ PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Hidden container for rendering individual pages */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '210mm' }}>
        {Array.from({ length: Math.max(1, Math.ceil(products.length / 20)) }).map((_, i) => {
          const pageProducts = products.slice(i * 20, (i + 1) * 20);
          return (
            <div
              key={i}
              id={`pdf-page-${i}`}
              style={{
                width: '210mm',
                height: '297mm', // strict A4 height
                padding: '15mm',
                backgroundColor: '#ffffff',
                color: '#111827',
                direction: 'rtl',
                fontFamily: 'Vazirmatn, sans-serif',
                boxSizing: 'border-box',
                position: 'relative',
              }}
            >
              {/* PDF Header */}
              <div style={{ borderBottom: '3px solid #1f2937', paddingBottom: '15px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#111827', margin: '0 0 5px 0' }}>کاتالوگ محصولات تماس مارکت</h1>
                  <p style={{ fontSize: '14px', color: '#4b5563', margin: 0 }}>تعداد کل کالاها: {formatNumber(products.length)}</p>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                    تاریخ: {new Date().toLocaleDateString('fa-IR')}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>صفحه {i + 1} از {Math.ceil(products.length / 20)}</div>
                </div>
              </div>

              {/* Products Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
                {pageProducts.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      backgroundColor: '#f9fafb',
                      height: '46mm', // approximate height for 5 rows
                    }}
                  >
                    <div style={{ width: '100%', height: '22mm', backgroundColor: '#fff', borderRadius: '8px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.title} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} crossOrigin="anonymous" />
                      ) : (
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>بدون تصویر</span>
                      )}
                    </div>
                    
                    <h3 style={{ fontSize: '10px', fontWeight: 800, textAlign: 'center', margin: '0 0 4px 0', color: '#1f2937', lineHeight: 1.4, maxHeight: '28px', overflow: 'hidden' }}>
                      {p.title}
                    </h3>
                    
                    {(p.brandFaName || p.brandName) && (
                      <p style={{ fontSize: '9px', color: '#6b7280', margin: '0 0 6px 0' }}>
                        {p.brandFaName || p.brandName}
                      </p>
                    )}
                    
                    <div style={{ marginTop: 'auto', width: '100%', borderTop: '1px solid #e5e7eb', paddingTop: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: 900, color: '#0ea5e9', marginBottom: '2px' }}>
                        {p.price > 0 ? `${formatNumber(p.price)} تومان` : 'تماس بگیرید'}
                      </div>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: p.stock > 0 ? '#10b981' : '#ef4444' }}>
                        {p.stock > 0 ? 'موجود' : 'ناموجود'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
