import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

interface Attribute {
  id: string;
  name: string;
  type: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  text: 'متن ساده',
  number: 'عدد',
  boolean: 'بله / خیر',
};

export function AttributesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', type: 'text' });

  const { data: attributes, isLoading } = useQuery({
    queryKey: ['admin', 'attributes'],
    queryFn: async () => {
      const list = await api.get<Attribute[]>('/admin/attributes');
      return list;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingId) {
        return api.put(`/admin/attributes/${editingId}`, data);
      }
      return api.post('/admin/attributes', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'attributes'] });
      toast.ok('ویژگی با موفقیت ذخیره شد');
      setEditingId(null);
      setFormData({ name: '', type: 'text' });
    },
    onError: (err: any) => {
      toast.error(err.message || 'خطا در ذخیره ویژگی');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/admin/attributes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'attributes'] });
      toast.ok('ویژگی حذف شد');
    },
    onError: (err: any) => toast.error(err.message || 'خطا در حذف ویژگی'),
  });

  const handleEdit = (a: Attribute) => {
    setEditingId(a.id);
    setFormData({ name: a.name, type: a.type });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ name: '', type: 'text' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">ویژگی‌های محصول</h2>
          <p className="a-subtitle">تعریف فیلدهای سفارشی که هنگام ویرایش محصول تکمیل می‌شوند</p>
        </div>
        <div className="a-page-actions">
          <span className="a-badge a-badge--brand">{attributes?.length ?? 0} ویژگی</span>
        </div>
      </section>

      <div className="a-cols a-cols--2">
        {/* Form */}
        <section className="a-card a-col-sticky">
          <div className="a-card-head">
            <div>
              <h3 className="a-card-title">{editingId ? 'ویرایش ویژگی' : 'افزودن ویژگی جدید'}</h3>
              <p className="a-card-sub">نوع فیلد مشخص می‌کند گزینه‌ها در فرم محصول چگونه نمایش داده شوند.</p>
            </div>
            {editingId && <span className="a-badge a-badge--neutral">ID: {editingId}</span>}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="a-form-grid">
              <label className="a-field">
                <span className="a-label">نام ویژگی <span className="a-req">*</span></span>
                <input
                  type="text"
                  required
                  className="a-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثلا: حافظه داخلی"
                />
              </label>
              <label className="a-field">
                <span className="a-label">نوع فیلد <span className="a-req">*</span></span>
                <select
                  required
                  className="a-select"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="text">متن ساده</option>
                  <option value="number">عدد</option>
                  <option value="boolean">بله / خیر</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="a-btn a-btn--primary"
              >
                {saveMutation.isPending ? 'در حال ثبت...' : editingId ? 'ذخیره تغییرات' : '+ افزودن ویژگی'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="a-btn a-btn--secondary"
                >
                  انصراف از ویرایش
                </button>
              )}
            </div>
          </form>
        </section>

        {/* List */}
        <section className="a-card">
          <div className="a-card-head">
            <div>
              <h3 className="a-card-title">لیست ویژگی‌ها</h3>
              <p className="a-card-sub">پس از ثبت، گزینه موردنظر در فرم محصول ظاهر می‌شود.</p>
            </div>
          </div>

          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>نام ویژگی</th>
                  <th>نوع</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={3} className="text-center text-slate-500">در حال دریافت...</td></tr>
                ) : attributes?.length === 0 ? (
                  <tr><td colSpan={3} className="text-center text-slate-500">هیچ ویژگی یافت نشد.</td></tr>
                ) : (
                  attributes?.map((a: Attribute) => (
                    <tr key={a.id}>
                      <td className="a-strong">{a.name}</td>
                      <td>
                        <span className={`a-badge ${a.type === 'text' ? 'a-badge--neutral' : a.type === 'number' ? 'a-badge--brand' : 'a-badge--green'}`}>
                          {TYPE_LABELS[a.type] ?? a.type}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEdit(a)} className="a-btn a-btn--secondary a-btn--xs">ویرایش</button>
                          <button
                            onClick={() => {
                              if (window.confirm('آیا از حذف این ویژگی مطمئن هستید؟')) {
                                deleteMutation.mutate(a.id);
                              }
                            }}
                            className="a-btn a-btn--danger a-btn--xs"
                          >
                            حذف
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
      </div>
    </div>
  );
}