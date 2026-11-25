import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrandDTO, CategoryDTO, ProductDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { Price } from '../../components/Price';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { ProductEditor, type ProductForm } from './ProductEditor';
import { ConfirmDialog } from './ConfirmDialog';
import { AdminState } from './AdminState';

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
  const [pendingDelete, setPendingDelete] = useState<ProductDTO | null>(null);

  const queryKey = ['admin', 'products', 'variants', product.productId];

  const variantsQuery = useQuery({
    queryKey,
    queryFn: () => api.get<{ items: ProductDTO[] }>('/admin/products', { parentProductId: product.productId }),
  });
  const { data, isLoading } = variantsQuery;

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
      setPendingDelete(null);
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
          <p className="a-hint">تعداد واریانت‌ها: {formatNumber(variants.length)}</p>
          <button type="button" className="a-btn a-btn--primary" onClick={() => setEditingVariant('new')}>
            افزودن واریانت جدید
          </button>
        </div>

        {isLoading ? (
          <AdminState kind="loading" />
        ) : variantsQuery.isError ? (
          <AdminState kind="error" error={variantsQuery.error} onRetry={() => variantsQuery.refetch()} />
        ) : variants.length === 0 ? (
          <AdminState kind="empty" noun="واریانت" />
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>رنگ</th>
                  <th className="a-ltr">SKU</th>
                  <th className="a-num">قیمت</th>
                  <th className="a-num">موجودی کل</th>
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
                        <div className="flex items-center gap-2 a-strong">
                          {v.colorCode && (
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: v.colorCode }} aria-hidden="true" />
                          )}
                          {v.color || 'بدون رنگ'}
                        </div>
                      </td>
                      <td className="a-ltr a-cell-sub">{v.sku || '—'}</td>
                      <td className="a-num a-strong"><Price amount={v.price} /></td>
                      <td className="a-num">
                        <span className={`a-badge ${totalStock > 0 ? 'a-badge--success' : 'a-badge--danger'}`}>
                          {formatNumber(totalStock)}
                        </span>
                      </td>
                      <td>
                        <span className={`a-badge ${v.status === 'active' ? 'a-badge--success' : 'a-badge--neutral'}`}>
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
                            onClick={() => setPendingDelete(v)}
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
      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف واریانت"
        description={pendingDelete ? <>واریانت «{pendingDelete.color || pendingDelete.title}» حذف می‌شود؛ حذف برگشت ندارد.</> : ''}
        confirmLabel="حذف"
        busy={remove.isPending}
        onConfirm={() => { if (pendingDelete) remove.mutate(pendingDelete.id); }}
        onClose={() => { if (!remove.isPending) setPendingDelete(null); }}
      />
    </Modal>
  );
}
