import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrandDTO, CategoryDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AdminState } from '../components/AdminState';

type TaxonomyKind = 'cat' | 'brand';
interface TaxonomyTarget { kind: TaxonomyKind; id: number; faName: string }

export function TaxonomyPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [catName, setCatName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<TaxonomyTarget | null>(null);
  const [renaming, setRenaming] = useState<(TaxonomyTarget & { value: string }) | null>(null);

  const taxonomy = useQuery({
    queryKey: ['admin', 'taxonomy'],
    queryFn: () => api.get<{ categories: CategoryDTO[]; brands: BrandDTO[] }>('/admin/taxonomy'),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin', 'taxonomy'] });

  const addCat = useMutation({
    mutationFn: () => api.post('/admin/categories', { faName: catName }),
    onSuccess: () => {
      toast.ok('دسته‌بندی جدید ثبت شد.');
      setCatName('');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addBrand = useMutation({
    mutationFn: () => api.post('/admin/brands', { faName: brandName }),
    onSuccess: () => {
      toast.ok('برند جدید ثبت شد.');
      setBrandName('');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteCat = useMutation({
    mutationFn: (id: number) => api.del(`/admin/categories/${id}`),
    onSuccess: () => {
      toast.ok('دسته‌بندی حذف شد.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editCat = useMutation({
    mutationFn: ({ id, faName }: { id: number; faName: string }) => api.patch(`/admin/categories/${id}`, { faName }),
    onSuccess: () => {
      toast.ok('دسته‌بندی ویرایش شد.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteBrand = useMutation({
    mutationFn: (id: number) => api.del(`/admin/brands/${id}`),
    onSuccess: () => {
      toast.ok('برند حذف شد.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editBrand = useMutation({
    mutationFn: ({ id, faName }: { id: number; faName: string }) => api.patch(`/admin/brands/${id}`, { faName }),
    onSuccess: () => {
      toast.ok('برند ویرایش شد.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renamePending = editCat.isPending || editBrand.isPending;
  const submitRename = () => {
    if (!renaming) return;
    const newName = renaming.value.trim();
    if (!newName || newName === renaming.faName) {
      setRenaming(null);
      return;
    }
    const done = { onSuccess: () => setRenaming(null) };
    if (renaming.kind === 'brand') editBrand.mutate({ id: renaming.id, faName: newName }, done);
    else editCat.mutate({ id: renaming.id, faName: newName }, done);
  };

  const categories = taxonomy.data?.categories ?? [];
  const brands = taxonomy.data?.brands ?? [];

  return (
    <div className="a-page a-fade">
      {/* Page Header */}
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">مدیریت دسته‌ها و برندها</h2>
          <p className="a-subtitle">تعریف، ویرایش و پاکسازی دسته‌بندی محصولات و برندهای سازنده</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Categories Section */}
        <section className="a-card">
          <div className="a-card-head">
            <h3 className="a-card-title">دسته‌بندی‌ها</h3>
            <span className="chip chip-brand">{formatNumber(categories.length)} دسته</span>
          </div>

          {/* Add Category Form */}
          <form
            className="a-inline-add"
            onSubmit={(e) => {
              e.preventDefault();
              if (catName.trim()) addCat.mutate();
            }}
          >
            <h4 className="a-option-title">افزودن دسته‌بندی جدید</h4>
            <div className="flex gap-2">
              <input
                className="a-input a-grow"
                placeholder="عنوان دسته (مثلاً: کالای دیجیتال)"
                aria-label="عنوان دستهٔ جدید"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
              />
              <button type="submit" className="a-btn a-btn--primary" disabled={addCat.isPending} aria-busy={addCat.isPending || undefined}>
                {addCat.isPending ? 'در حال ثبت…' : '+ ثبت'}
              </button>
            </div>
          </form>

          {/* Categories List */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {taxonomy.isLoading && <AdminState compact kind="loading" />}
            {taxonomy.isError && <AdminState compact kind="error" error={taxonomy.error} onRetry={() => void taxonomy.refetch()} />}
            {taxonomy.isSuccess && categories.length === 0 && <AdminState compact kind="empty" noun="دسته‌بندی" />}
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-xl a-soft-row"
              >
                <div>
                  <div className="font-bold text-xs a-strong a-title-fallback">{c.faName}</div>
                  <div className="a-cell-sub a-ltr">{c.name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="chip chip-slate">ID: #{c.id}</span>
                  <button
                    type="button"
                    className="a-icon-btn a-icon-btn--sm a-icon-btn--info"
                    title="ویرایش دسته"
                    aria-label={`ویرایش دسته‌بندی «${c.faName}»`}
                    onClick={() => setRenaming({ kind: 'cat', id: c.id, faName: c.faName, value: c.faName })}
                  >
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="a-icon-btn a-icon-btn--sm a-icon-btn--danger"
                    title="حذف دسته"
                    aria-label={`حذف دسته‌بندی «${c.faName}»`}
                    onClick={() => setPendingDelete({ kind: 'cat', id: c.id, faName: c.faName })}
                  >
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Brands Section */}
        <section className="a-card">
          <div className="a-card-head">
            <h3 className="a-card-title">برندها</h3>
            <span className="chip chip-aqua">{formatNumber(brands.length)} برند</span>
          </div>

          {/* Add Brand Form */}
          <form
            className="a-inline-add"
            onSubmit={(e) => {
              e.preventDefault();
              if (brandName.trim()) addBrand.mutate();
            }}
          >
            <h4 className="a-option-title">افزودن برند جدید</h4>
            <div className="flex gap-2">
              <input
                className="a-input a-grow"
                placeholder="نام برند (مثلاً: انکر / ANKER)"
                aria-label="نام برند جدید"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
              <button type="submit" className="a-btn a-btn--primary" disabled={addBrand.isPending} aria-busy={addBrand.isPending || undefined}>
                {addBrand.isPending ? 'در حال ثبت…' : '+ ثبت'}
              </button>
            </div>
          </form>

          {/* Brands List */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {taxonomy.isLoading && <AdminState compact kind="loading" />}
            {taxonomy.isError && <AdminState compact kind="error" error={taxonomy.error} onRetry={() => void taxonomy.refetch()} />}
            {taxonomy.isSuccess && brands.length === 0 && <AdminState compact kind="empty" noun="برند" />}
            {brands.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3 rounded-xl a-soft-row"
              >
                <div>
                  <div className="font-bold text-xs a-strong a-title-fallback">{b.faName}</div>
                  <div className="a-cell-sub a-ltr">{b.name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="chip chip-slate">ID: #{b.id}</span>
                  <button
                    type="button"
                    className="a-icon-btn a-icon-btn--sm a-icon-btn--info"
                    title="ویرایش برند"
                    aria-label={`ویرایش برند «${b.faName}»`}
                    onClick={() => setRenaming({ kind: 'brand', id: b.id, faName: b.faName, value: b.faName })}
                  >
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="a-icon-btn a-icon-btn--sm a-icon-btn--danger"
                    title="حذف برند"
                    aria-label={`حذف برند «${b.faName}»`}
                    onClick={() => setPendingDelete({ kind: 'brand', id: b.id, faName: b.faName })}
                  >
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Modal
        open={renaming !== null}
        size="sm"
        title={renaming?.kind === 'brand' ? 'ویرایش نام برند' : 'ویرایش عنوان دسته‌بندی'}
        onClose={() => setRenaming(null)}
        busy={renamePending}
        footer={
          <>
            <button type="submit" form="taxonomy-rename-form" className="a-btn a-btn--primary" disabled={renamePending} aria-busy={renamePending || undefined}>
              {renamePending ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
            <button type="button" className="a-btn a-btn--secondary" onClick={() => setRenaming(null)} disabled={renamePending}>انصراف</button>
          </>
        }
      >
        <form id="taxonomy-rename-form" onSubmit={(event) => { event.preventDefault(); submitRename(); }}>
          <label className="a-field">
            <span className="a-label">{renaming?.kind === 'brand' ? 'نام جدید برند' : 'عنوان جدید دسته‌بندی'}</span>
            <input
              className="a-input"
              autoFocus
              value={renaming?.value ?? ''}
              onChange={(event) => setRenaming((current) => (current ? { ...current, value: event.target.value } : current))}
            />
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.kind === 'brand' ? 'حذف برند' : 'حذف دسته‌بندی'}
        description={pendingDelete ? `${pendingDelete.kind === 'brand' ? 'برند' : 'دسته‌بندی'} «${pendingDelete.faName}» حذف می‌شود؛ حذف برگشت ندارد.` : ''}
        confirmLabel="حذف"
        busy={deleteCat.isPending || deleteBrand.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          const done = { onSuccess: () => setPendingDelete(null) };
          if (pendingDelete.kind === 'brand') deleteBrand.mutate(pendingDelete.id, done);
          else deleteCat.mutate(pendingDelete.id, done);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}