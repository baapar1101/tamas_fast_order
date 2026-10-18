import type { ProductDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { CatalogProductCard } from './CatalogProductCard';

interface CatalogPageSheetProps {
  pageIdx: number;
  totalPages: number;
  productsLength: number;
  today: string;
  pageProducts: ProductDTO[];
}

export function CatalogPageSheet({
  pageIdx,
  totalPages,
  productsLength,
  today,
  pageProducts,
}: CatalogPageSheetProps) {
  return (
    <div
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
            تعداد کالاها: {formatNumber(productsLength)} عدد
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
        {pageProducts.map((p) => (
          <CatalogProductCard key={p.id} product={p} />
        ))}
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
}
