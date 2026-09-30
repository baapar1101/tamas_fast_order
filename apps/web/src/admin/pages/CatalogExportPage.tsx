import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import type { ProductDTO, CategoryDTO, BrandDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

// Helper: load a TTF font from URL and return as base64
async function loadFontAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

// Helper: load image as base64 data URL
async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
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

  const handleGeneratePdf = async () => {
    if (products.length === 0) {
      toast.error('هیچ محصولی برای تهیه کاتالوگ یافت نشد.');
      return;
    }

    setIsGenerating(true);
    setPdfProgress(0);
    toast.ok('در حال آماده‌سازی فایل PDF، لطفاً شکیبا باشید...');

    try {
      // Load Vazirmatn fonts
      const [regularBase64, boldBase64] = await Promise.all([
        loadFontAsBase64('/fonts/Vazirmatn-Regular.ttf'),
        loadFontAsBase64('/fonts/Vazirmatn-Bold.ttf'),
      ]);

      const pdf = new jsPDF('p', 'mm', 'a4');

      // Register fonts
      pdf.addFileToVFS('Vazirmatn-Regular.ttf', regularBase64);
      pdf.addFont('Vazirmatn-Regular.ttf', 'Vazirmatn', 'normal');
      pdf.addFileToVFS('Vazirmatn-Bold.ttf', boldBase64);
      pdf.addFont('Vazirmatn-Bold.ttf', 'Vazirmatn', 'bold');

      // Page dimensions
      const PAGE_W = 210;
      const PAGE_H = 297;
      const MARGIN = 12;
      const CONTENT_W = PAGE_W - MARGIN * 2;

      // Grid: 4 columns, 5 rows = 20 products per page
      const COLS = 4;
      const ROWS = 5;
      const GAP = 4;
      const CARD_W = (CONTENT_W - (COLS - 1) * GAP) / COLS;
      const HEADER_H = 20;
      const GRID_START_Y = MARGIN + HEADER_H + 5;
      const AVAIL_H = PAGE_H - GRID_START_Y - MARGIN - 8; // leave room for footer
      const CARD_H = (AVAIL_H - (ROWS - 1) * GAP) / ROWS;
      const PER_PAGE = COLS * ROWS;
      const totalPages = Math.ceil(products.length / PER_PAGE);

      const today = new Date().toLocaleDateString('fa-IR');

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        setPdfProgress(Math.round((pageIdx / totalPages) * 100));
        if (pageIdx > 0) pdf.addPage();

        // ------- Header -------
        pdf.setFillColor(31, 41, 55); // dark
        pdf.rect(MARGIN, MARGIN, CONTENT_W, HEADER_H, 'F');

        pdf.setFont('Vazirmatn', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(255, 255, 255);
        // RTL: align right
        pdf.text('کاتالوگ محصولات تماس مارکت', PAGE_W - MARGIN - 4, MARGIN + 9, { align: 'right' });

        pdf.setFont('Vazirmatn', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(200, 200, 200);
        pdf.text(`تعداد کالاها: ${formatNumber(products.length)}`, PAGE_W - MARGIN - 4, MARGIN + 15, { align: 'right' });

        // Left side: date + page
        pdf.setFontSize(8);
        pdf.text(`تاریخ: ${today}`, MARGIN + 4, MARGIN + 9, { align: 'left' });
        pdf.text(`صفحه ${pageIdx + 1} از ${totalPages}`, MARGIN + 4, MARGIN + 15, { align: 'left' });

        // ------- Product Cards -------
        const pageProducts = products.slice(pageIdx * PER_PAGE, (pageIdx + 1) * PER_PAGE);

        for (let i = 0; i < pageProducts.length; i++) {
          const p = pageProducts[i]!;
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          // RTL: rightmost column first
          const x = PAGE_W - MARGIN - (col + 1) * CARD_W - col * GAP;
          const y = GRID_START_Y + row * (CARD_H + GAP);

          // Card background
          pdf.setFillColor(249, 250, 251);
          pdf.setDrawColor(229, 231, 235);
          pdf.roundedRect(x, y, CARD_W, CARD_H, 2, 2, 'FD');

          const innerPad = 2.5;
          const imgAreaH = CARD_H * 0.42;
          const textStartY = y + imgAreaH + innerPad;

          // Product image
          if (p.imageUrl) {
            try {
              const imgData = await loadImageAsDataUrl(p.imageUrl);
              if (imgData) {
                const imgSize = Math.min(CARD_W - innerPad * 2, imgAreaH - 2);
                const imgX = x + (CARD_W - imgSize) / 2;
                const imgY = y + (imgAreaH - imgSize) / 2;
                pdf.addImage(imgData, 'JPEG', imgX, imgY, imgSize, imgSize);
              }
            } catch {
              // skip image
            }
          }

          // Product title (RTL)
          pdf.setFont('Vazirmatn', 'bold');
          pdf.setFontSize(7);
          pdf.setTextColor(31, 41, 55);
          const titleLines = pdf.splitTextToSize(p.title || '', CARD_W - innerPad * 2);
          const maxTitleLines = 2;
          const shownTitle = titleLines.slice(0, maxTitleLines);
          pdf.text(shownTitle, x + CARD_W - innerPad, textStartY, { align: 'right', lineHeightFactor: 1.5 });

          // Brand
          const brandName = (p as any).brandFaName || (p as any).brandName || '';
          if (brandName) {
            pdf.setFont('Vazirmatn', 'normal');
            pdf.setFontSize(6);
            pdf.setTextColor(107, 114, 128);
            pdf.text(brandName, x + CARD_W - innerPad, textStartY + maxTitleLines * 3.2 + 1, { align: 'right' });
          }

          // Divider line
          const dividerY = y + CARD_H - 10;
          pdf.setDrawColor(229, 231, 235);
          pdf.line(x + innerPad, dividerY, x + CARD_W - innerPad, dividerY);

          // Price
          pdf.setFont('Vazirmatn', 'bold');
          pdf.setFontSize(7.5);
          pdf.setTextColor(14, 165, 233); // sky-500
          const priceText = p.price > 0 ? `${formatNumber(p.price)} تومان` : 'تماس بگیرید';
          pdf.text(priceText, x + CARD_W / 2, dividerY + 4.5, { align: 'center' });

          // Stock
          pdf.setFont('Vazirmatn', 'normal');
          pdf.setFontSize(6);
          if (p.stock > 0) {
            pdf.setTextColor(16, 185, 129); // green
            pdf.text('موجود', x + CARD_W / 2, dividerY + 8, { align: 'center' });
          } else {
            pdf.setTextColor(239, 68, 68); // red
            pdf.text('ناموجود', x + CARD_W / 2, dividerY + 8, { align: 'center' });
          }
        }

        // ------- Footer -------
        pdf.setFont('Vazirmatn', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(156, 163, 175);
        pdf.text('تهیه شده توسط سیستم مدیریت تماس مارکت — TamasMarket.com', PAGE_W / 2, PAGE_H - MARGIN + 2, { align: 'center' });
      }

      setPdfProgress(100);
      pdf.save(`کاتالوگ-تماس-مارکت-${today.replace(/\//g, '-')}.pdf`);
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
    </div>
  );
}
