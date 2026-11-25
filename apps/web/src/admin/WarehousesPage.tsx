import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { TableState } from './components/AdminState';

interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string | null;
  isActive: boolean;
  createdAt: string;
}

export function WarehousesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ code: '', name: '', location: '', isActive: true });
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Warehouse | null>(null);

  const warehousesQuery = useQuery({
    queryKey: ['admin', 'warehouses'],
    queryFn: async () => {
      const list = await api.get<Warehouse[]>('/admin/warehouses');
      return list;
    },
  });
  const { data: warehouses, isLoading } = warehousesQuery;

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingId) {
        return api.put(`/admin/warehouses/${editingId}`, data);
      }
      return api.post('/admin/warehouses', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'warehouses'] });
      toast.ok(editingId ? 'انبار به‌روز شد.' : 'انبار اضافه شد.');
      setEditingId(null);
      setFormData({ code: '', name: '', location: '', isActive: true });
      setFormOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'انبار ذخیره نشد؛ دوباره تلاش کنید.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/admin/warehouses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'warehouses'] });
      toast.ok('انبار حذف شد.');
      setPendingDelete(null);
    },
    onError: (err: any) => toast.error(err.message || 'انبار حذف نشد؛ دوباره تلاش کنید.'),
  });

  const handleEdit = (w: Warehouse) => {
    setEditingId(w.id);
    setFormData({ code: w.code, name: w.name, location: w.location || '', isActive: w.isActive });
    setFormOpen(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ code: '', name: '', location: '', isActive: true });
    setFormOpen(false);
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({ code: '', name: '', location: '', isActive: true });
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">مدیریت انبارها</h2>
          <p className="a-subtitle">تعریف و مدیریت انبارهای نگهداری موجودی کالا.</p>
        </div>
        <div className="a-page-actions">
          <button type="button" className="a-btn a-btn--primary" onClick={handleCreate}>+ افزودن انبار</button>
        </div>
      </section>

      <Modal
        open={formOpen}
        title={
          <>
            {editingId ? 'ویرایش انبار' : 'افزودن انبار جدید'}
            {editingId && <span className="a-badge a-badge--neutral">{editingId}</span>}
          </>
        }
        onClose={handleCancel}
        busy={saveMutation.isPending}
        footer={
          <>
            <button type="button" className="a-btn a-btn--ghost" onClick={handleCancel} disabled={saveMutation.isPending}>انصراف</button>
            <button type="submit" form="warehouse-form" className="a-btn a-btn--primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'در حال ذخیره…' : editingId ? 'ذخیرهٔ تغییرات' : 'ثبت انبار'}
            </button>
          </>
        }
      >
        <form id="warehouse-form" className="a-form a-form--standard a-fade" onSubmit={handleSubmit}>
          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">مشخصات انبار</h3>
            </div>
            <div className="a-form-grid">
              <div className="a-field">
                <label className="a-label">کد انبار (انگلیسی)</label>
                <input
                  type="text"
                  required
                  className="a-input"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="مثلاً: kerman"
                  dir="ltr"
                />
              </div>
              <div className="a-field">
                <label className="a-label">نام انبار</label>
                <input
                  type="text"
                  required
                  className="a-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثلاً: انبار مرکزی کرمان"
                />
              </div>
              <div className="a-field">
                <label className="a-label">موقعیت / شهر</label>
                <input
                  type="text"
                  className="a-input"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">وضعیت انبار</h3>
            </div>
            <div className="a-option-row">
              <div className="a-option-copy">
                <div className="a-option-title">انبار فعال است</div>
                <div className="a-option-desc">انبارهای غیرفعال در فرم‌ها نمایش داده نمی‌شوند.</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.isActive}
                aria-label="انبار فعال است"
                className="a-switch"
                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
              />
            </div>
          </section>
        </form>
      </Modal>

      {/* List */}
      <section className="a-card a-card--flush a-container-md">
        <div className="a-card-head a-card-head--px">
          <h3 className="a-card-title">فهرست انبارها</h3>
        </div>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>کد</th>
                <th>نام</th>
                <th>موقعیت</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableState colSpan={5} kind="loading" />
              ) : warehousesQuery.isError ? (
                <TableState colSpan={5} kind="error" error={warehousesQuery.error} onRetry={() => warehousesQuery.refetch()} />
              ) : warehouses?.length === 0 ? (
                <TableState colSpan={5} kind="empty" noun="انبار" />
              ) : (
                warehouses?.map((w: Warehouse) => (
                  <tr key={w.id}>
                    <td className="a-mono a-ltr">{w.code}</td>
                    <td className="a-strong">{w.name}</td>
                    <td>{w.location || '—'}</td>
                    <td>
                      {w.isActive ? (
                        <span className="a-badge a-badge--success">فعال</span>
                      ) : (
                        <span className="a-badge a-badge--neutral">غیرفعال</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(w)}
                          className="a-icon-btn a-icon-btn--info"
                          title="ویرایش"
                          aria-label={`ویرایش انبار ${w.name}`}
                        >
                          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(w)}
                          className="a-icon-btn a-icon-btn--danger"
                          title="حذف"
                          aria-label={`حذف انبار ${w.name}`}
                        >
                          <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="حذف انبار"
        description={pendingDelete ? <>انبار «{pendingDelete.name}» حذف می‌شود و موجودی کالاها در این انبار از بین می‌رود؛ حذف برگشت ندارد.</> : ''}
        confirmLabel="حذف"
        busy={deleteMutation.isPending}
        onConfirm={() => { if (pendingDelete) deleteMutation.mutate(pendingDelete.id); }}
        onClose={() => { if (!deleteMutation.isPending) setPendingDelete(null); }}
      />
    </div>
  );
}
