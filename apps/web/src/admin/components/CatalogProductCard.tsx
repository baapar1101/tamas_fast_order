import type { ProductDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';

interface CatalogProductCardProps {
  product: ProductDTO;
}

export function CatalogProductCard({ product }: CatalogProductCardProps) {
  const brandLabel = (product as any).brandFaName || (product as any).brandName || '';
  const isAvailable = product.stock > 0 || (product as any).kermanStock > 0 || (product as any).tehranStock > 0;

  return (
    <div
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
          src={product.imageUrl || '/logo.png'}
          alt={product.title}
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
            minHeight: '26px',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            direction: 'rtl',
            textAlign: 'right',
          }}
        >
          {product.title}
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
          {product.price > 0 ? `${formatNumber(product.price)} تومان` : 'تماس بگیرید'}
        </div>
        <div
          style={{
            fontSize: '8.5px',
            fontWeight: 'bold',
            marginTop: '1px',
            color: isAvailable ? '#16a34a' : '#dc2626',
          }}
        >
          {isAvailable ? 'موجود' : 'ناموجود'}
        </div>
      </div>
    </div>
  );
}
