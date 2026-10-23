import { forwardRef } from 'react';
import type { ProductDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { groupMobilePhoneProducts } from './mobileGlassCatalogData';

interface MobileGlassCatalogProps {
  products: ProductDTO[];
  date: string;
}

function ProductTable({ products }: { products: ProductDTO[] }) {
  return (
    <table className="mobile-glass-table" data-excel-export="off">
      <thead>
        <tr>
          <th className="mobile-glass-price">قیمت</th>
          <th className="mobile-glass-color">رنگ</th>
          <th className="mobile-glass-model">مدل</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.id}>
            <td className="mobile-glass-price">{product.price > 0 ? formatNumber(product.price) : 'تماس بگیرید'}</td>
            <td className="mobile-glass-color">{product.color || product.colorEn || '—'}</td>
            <td className="mobile-glass-model">{product.model || product.title}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const MobileGlassCatalog = forwardRef<HTMLDivElement, MobileGlassCatalogProps>(function MobileGlassCatalog(
  { products, date },
  ref,
) {
  const groups = groupMobilePhoneProducts(products);
  const dualCount = groups.filter((group) => group.products.length > 30).length;
  const gridState = dualCount >= 2 ? 'two-dual' : dualCount === 1 ? 'one-dual' : 'all-single';

  return (
    <div ref={ref} className="mobile-glass-canvas" dir="rtl">
      <header className="mobile-glass-header">
        <img src="/logo.png" alt="تماس مارکت" crossOrigin="anonymous" />
        <div>
          <strong>لیست قیمت موبایل تماس مارکت</strong>
          <span>آخرین بروزرسانی: {date}</span>
        </div>
      </header>

      <div className={`mobile-glass-grid mobile-glass-grid--${gridState}`}>
        {groups.map((group) => {
          const isDual = group.products.length > 30;
          const middle = Math.ceil(group.products.length / 2);
          return (
            <section className="mobile-glass-brand" key={group.key}>
              <h2>{group.label}</h2>
              <div className={`mobile-glass-table-wrap${isDual ? ' mobile-glass-table-wrap--dual' : ''}`}>
                {isDual ? (
                  <>
                    <ProductTable products={group.products.slice(0, middle)} />
                    <ProductTable products={group.products.slice(middle)} />
                  </>
                ) : (
                  <ProductTable products={group.products} />
                )}
              </div>
            </section>
          );
        })}
      </div>

      <footer className="mobile-glass-footer">
        <div><strong>تماس مارکت</strong><span>مرجع تخصصی فروش عمده کالای دیجیتال</span></div>
        <span dir="ltr">tamasmarket.com</span>
      </footer>
    </div>
  );
});

