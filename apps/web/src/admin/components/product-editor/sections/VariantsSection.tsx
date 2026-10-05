import type { ProductDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import type { ProductForm } from '../types';
import { ProductAccordionSection } from '../ProductAccordionSection';
import { Price } from '../../../../components/Price';

interface Props {
  product: ProductDTO | null;
  form: ProductForm;
  variants: ProductDTO[];
  variantsLoading: boolean;
  onManageVariants?: (product: ProductDTO) => void;
}

export function VariantsSection({ product, form, variants, variantsLoading, onManageVariants }: Props) {
  if (form.parentProductId) {
    return null;
  }

  return (
    <ProductAccordionSection
      id="pe-variants-section"
      title="تنوع محصول (Variants)"
      description="رنگ‌ها و تنوع‌های وابسته به این محصول"
      summary={!product ? 'پس از ذخیره فعال می‌شود' : variants.length ? `${formatNumber(variants.length)} تنوع` : 'بدون تنوع'}
    >
      <div className="pe-accordion-actions">
        {product && onManageVariants && (
          <button type="button" className="a-btn a-btn--info a-btn--sm" onClick={() => onManageVariants(product)}>
            + افزودن تنوع
          </button>
        )}
      </div>

      {!product ? (
        <div className="a-amber-box">ابتدا اطلاعات محصول را ذخیره کنید تا امکان افزودن تنوع فراهم شود.</div>
      ) : variantsLoading ? (
        <div className="animate-pulse p-4 text-center a-muted">در حال بارگذاری تنوع‌ها...</div>
      ) : variants.length === 0 ? (
        <div className="a-empty">هیچ تنوعی ثبت نشده است.</div>
      ) : (
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>رنگ / تنوع</th>
                <th>قیمت (تومان)</th>
                <th>موجودی</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {variants.map(v => {
                const totalStock = v.kermanStock + v.tehranStock > 0 ? v.kermanStock + v.tehranStock : v.stock;
                return (
                  <tr key={v.id}>
                    <td>
                      <div className="a-strong flex items-center gap-2">
                        {v.colorCode && (
                          <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: v.colorCode }} />
                        )}
                        {v.color || 'بدون نام'}
                      </div>
                    </td>
                    <td><Price amount={v.price} /></td>
                    <td>
                      <span className={`a-badge ${totalStock > 0 ? 'a-badge--green' : 'a-badge--red'}`}>
                        {formatNumber(totalStock)}
                      </span>
                    </td>
                    <td>
                      <span className={`a-badge ${v.status === 'active' ? 'a-badge--green' : 'a-badge--neutral'}`}>
                        {v.status === 'active' ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td>
                      <button type="button" className="a-link" onClick={() => onManageVariants?.(product!)}>ویرایش</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ProductAccordionSection>
  );
}
