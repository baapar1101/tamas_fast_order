import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrandDTO, CategoryDTO, ProductDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { Price } from '../../components/Price';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { ProductEditor, type ProductForm } from './ProductEditor';

interface Props {
  product: ProductDTO;
  categories: CategoryDTO[];
  brands: BrandDTO[];
  onClose: () => void;
}

export function VariantsEditor({ product, categories, brands, onClose }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const [editingVariant, setEditingVariant] = useState<ProductDTO | 'new' | null>(null);

  const queryKey = ['admin', 'products', 'variants', product.productId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => api.get<{ items: ProductDTO[] }>('/admin/products', { parentProductId: product.productId }),
  });

  const save = useMutation({
    mutationFn: async ({ id, body }: { id: number | null; body: ProductForm }) =>
      id == null ? api.post('/admin/products', body) : api.patch(`/admin/products/${id}`, body),
    onSuccess: () => {
      toast.ok('واریانت ذخیره شد.');
      setEditingVariant(null);
      void qc.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/admin/products/${id}`),
    onSuccess: () => {
      toast.ok('واریانت حذف شد.');
      void qc.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (editingVariant) {
    const isNew = editingVariant === 'new';
    const template: ProductDTO = isNew
      ? {
          ...product,
          id: 0,
          productId: `${product.productId}-${Date.now().toString().slice(-4)}`,
          title: `واریانت ${product.title}`,
          color: '',
          colorCode: '',
          colorEn: '',
          parentProductId: product.productId,
        }
      : editingVariant;

    return (
      <ProductEditor
        product={isNew ? null : template}
        template={isNew ? template : undefined}
        categories={categories}
        brands={brands}
        busy={save.isPending}
        onClose={() => setEditingVariant(null)}
        onSave={(form) => save.mutate({ id: isNew ? null : editingVariant.id, body: { ...form, parentProductId: product.productId } })}
      />
    );
  }

  const variants = data?.items ?? [];

  return (
    <Modal open title={`مدیریت واریانت‌ها: ${product.title}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-sm text-slate-400">تعداد واریانت‌ها: {variants.length}</p>
          <button type="button" className="a-btn a-btn--primary" onClick={() => setEditingVariant('new')}>
            افزودن واریانت جدید
          </button>
        </div>

        {isLoading ? (
          <div className="animate-pulse p-4 text-center">در حال بارگذاری...</div>
        ) : variants.length === 0 ? (
          <div className="p-8 text-center text-slate-500 glass-card">هیچ واریانتی یافت نشد.</div>
        ) : (
          <div className="huma-table-container">
            <table className="huma-table">
              <thead>
                <tr>
                  <th>رنگ</th>
                  <th>SKU</th>
                  <th>قیمت</th>
                  <th>موجودی کل</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => {
                  const totalStock = v.kermanStock + v.tehranStock > 0 ? v.kermanStock + v.tehranStock : v.stock;
                  return (
                    <tr key={v.id}>
                      <td>
                        <div className="flex items-center gap-2 font-bold text-white">
                          {v.colorCode && (
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: v.colorCode }} />
                          )}
                          {v.color || 'بدون رنگ'}
                        </div>
                      </td>
                      <td className="text-xs text-slate-400" dir="ltr">{v.sku || '-'}</td>
                      <td className="font-bold text-emerald-300"><Price amount={v.price} /></td>
                      <td>
                        <span className={`chip ${totalStock > 0 ? 'chip-brand' : 'chip-rose'}`}>
                          {formatNumber(totalStock)}
                        </span>
                      </td>
                      <td>
                        <span className={`chip ${v.status === 'active' ? 'chip-brand' : 'chip-slate'}`}>
                          {v.status === 'active' ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="a-btn a-btn--secondary a-btn--xs"
                            onClick={() => setEditingVariant(v)}
                          >
                            ویرایش
                          </button>
                          <button
                            type="button"
                            className="a-btn a-btn--danger a-btn--xs"
                            onClick={() => {
                              if (confirm('واریانت حذف شود؟')) remove.mutate(v.id);
                            }}
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
