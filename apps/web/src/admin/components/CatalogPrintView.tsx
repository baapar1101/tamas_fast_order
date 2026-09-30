import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProductDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { api } from '../../lib/api';

interface CatalogPrintViewProps {
  query: Record<string, any>;
  onClose: () => void;
}

export function CatalogPrintView({ query, onClose }: CatalogPrintViewProps) {
  // Fetch all products matching the query up to 5000 items
  const fullQuery = { ...query, page: 1, perPage: 5000 };
  
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'products', 'catalog-print', fullQuery],
    queryFn: () => api.get<{ items: ProductDTO[] }>('/admin/products', fullQuery),
  });

  useEffect(() => {
    if (data && !isLoading) {
      // Small delay to let images render before triggering print
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [data, isLoading]);

  // Listen to afterprint event to close the view automatically
  useEffect(() => {
    const handleAfterPrint = () => {
      onClose();
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [onClose]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-lg font-bold text-gray-700">در حال آماده‌سازی کاتالوگ...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center">
        <p className="text-red-500 font-bold mb-4">خطا در دریافت اطلاعات</p>
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">بازگشت</button>
      </div>
    );
  }

  const items = Array.isArray(data.items) ? data.items : [];

  return (
    <div className="fixed inset-0 z-[9999] bg-white overflow-y-auto print:static print:bg-transparent print:overflow-visible text-right" dir="rtl">
      {/* Hide close button when printing */}
      <div className="p-4 bg-gray-100 border-b print:hidden flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div>
          <h2 className="font-bold text-lg">پیش‌نمایش کاتالوگ</h2>
          <p className="text-sm text-gray-600">برای ذخیره به صورت PDF، در پنجره پرینت گزینه Save as PDF را انتخاب کنید.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-4 py-2 bg-brand text-white rounded font-medium shadow">پرینت / ذخیره PDF</button>
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded font-medium hover:bg-gray-300">بستن</button>
        </div>
      </div>

      <div className="p-8 max-w-[1000px] mx-auto bg-white">
        <header className="mb-8 border-b-2 border-gray-800 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-2">کاتالوگ محصولات</h1>
            <p className="text-gray-600">تعداد کالا: {formatNumber(items.length)} عدد</p>
          </div>
          <div className="text-left text-sm text-gray-500">
            تاریخ خروجی: {new Date().toLocaleDateString('fa-IR')}
          </div>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
          {items.map(product => (
            <div key={product.id} className="border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center break-inside-avoid shadow-sm print:shadow-none">
              <div className="w-full aspect-square bg-gray-50 rounded mb-3 flex items-center justify-center overflow-hidden">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.title} className="max-w-full max-h-full object-contain" />
                ) : (
                  <span className="text-gray-300 text-sm">بدون تصویر</span>
                )}
              </div>
              <h3 className="font-bold text-gray-800 text-sm mb-1 leading-tight line-clamp-2">{product.title}</h3>
              {(product.brandFaName || product.brandName) && (
                <p className="text-xs text-gray-500 mb-2">{product.brandFaName || product.brandName}</p>
              )}
              <div className="mt-auto pt-3 border-t w-full border-gray-100 flex flex-col gap-1">
                <span className="font-black text-brand text-lg">
                  {product.price > 0 ? `${formatNumber(product.price)} تومان` : 'تماس بگیرید'}
                </span>
                {product.stock > 0 ? (
                  <span className="text-xs text-green-600 font-medium">موجود</span>
                ) : (
                  <span className="text-xs text-red-500 font-medium">ناموجود</span>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {items.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            هیچ محصولی با این فیلترها یافت نشد.
          </div>
        )}
      </div>
    </div>
  );
}
