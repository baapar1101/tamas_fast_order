import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import html2pdf from 'html2pdf.js';
import type { ProductDTO, CategoryDTO, BrandDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

export function CatalogExportPage() {
  const toast = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [selectedBrand, setSelectedBrand] = useState<number | 'all'>('all');
  const [stockStatus, setStockStatus] = useState<'all' | 'in' | 'out'>('all');

  // Fetch reference data
  const { data: categoriesData } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api.get<{ items: CategoryDTO[] }>('/admin/categories'),
  });

  const { data: brandsData } = useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: () => api.get<{ items: BrandDTO[] }>('/admin/brands'),
  });

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
    if (!contentRef.current) return;
    if (products.length === 0) {
      toast.error('هیچ محصولی برای تهیه کاتالوگ یافت نشد.');
      return;
    }

    setIsGenerating(true);
    toast.ok('در حال ساخت PDF، لطفاً چند لحظه صبر کنید...');

    try {
      const element = contentRef.current;
      const opt: any = {
        margin: [10, 10, 10, 10], // top, left, bottom, right in mm
        filename: `کاتالوگ-تماس-مارکت-${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(opt).from(element).save();
      toast.ok('فایل PDF با موفقیت دانلود شد.');
    } catch (error) {
      console.error('PDF Generation error:', error);
      toast.error('خطا در ساخت فایل PDF');
    } finally {
      setIsGenerating(false);
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
                  {categoriesData?.items?.map((cat) => (
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
                  {brandsData?.items?.map((brand) => (
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
                    در حال ساخت...
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

      {/* 
        This is the actual element that gets captured by html2pdf. 
        It is visually hidden using absolute positioning off-screen 
        so it doesn't mess up the UI but is still fully rendered in the DOM.
      */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '210mm' }}>
        <div
          ref={contentRef}
          style={{
            width: '210mm',
            padding: '15mm',
            backgroundColor: '#ffffff',
            color: '#111827', // dark gray
            direction: 'rtl',
            fontFamily: 'Vazirmatn, sans-serif',
          }}
        >
          {/* PDF Header */}
          <div style={{ borderBottom: '3px solid #1f2937', paddingBottom: '15px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#111827', margin: '0 0 5px 0' }}>کاتالوگ محصولات تماس مارکت</h1>
              <p style={{ fontSize: '14px', color: '#4b5563', margin: 0 }}>تعداد محصول: {formatNumber(products.length)}</p>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                تاریخ: {new Date().toLocaleDateString('fa-IR')}
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280' }}>tamasmarket.com</div>
            </div>
          </div>

          {/* Products Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
            {products.map((p) => (
              <div
                key={p.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  pageBreakInside: 'avoid',
                  backgroundColor: '#f9fafb',
                }}
              >
                <div style={{ width: '100%', aspectRatio: '1', backgroundColor: '#fff', borderRadius: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.title} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} crossOrigin="anonymous" />
                  ) : (
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>بدون تصویر</span>
                  )}
                </div>
                
                <h3 style={{ fontSize: '12px', fontWeight: 800, textAlign: 'center', margin: '0 0 6px 0', color: '#1f2937', lineHeight: 1.4, maxHeight: '33px', overflow: 'hidden' }}>
                  {p.title}
                </h3>
                
                {(p.brandFaName || p.brandName) && (
                  <p style={{ fontSize: '10px', color: '#6b7280', margin: '0 0 10px 0' }}>
                    {p.brandFaName || p.brandName}
                  </p>
                )}
                
                <div style={{ marginTop: 'auto', width: '100%', borderTop: '1px solid #e5e7eb', paddingTop: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: 900, color: '#0ea5e9', marginBottom: '4px' }}>
                    {p.price > 0 ? `${formatNumber(p.price)} تومان` : 'تماس بگیرید'}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: p.stock > 0 ? '#10b981' : '#ef4444' }}>
                    {p.stock > 0 ? 'موجود' : 'ناموجود'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Footer watermark */}
          <div style={{ marginTop: '40px', paddingTop: '15px', borderTop: '1px solid #e5e7eb', textAlign: 'center', fontSize: '11px', color: '#9ca3af' }}>
            تهیه شده توسط سیستم مدیریت تماس مارکت - TamasMarket.com
          </div>
        </div>
      </div>
    </div>
  );
}
