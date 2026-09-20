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
  const [formOpen, setFormOpen] = useState(false);

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
      setFormOpen(false);
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
    setFormOpen(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ name: '', type: 'text' });
    setFormOpen(false);
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({ name: '', type: 'text' });
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
          <h2 className="a-title">ویژگی‌های محصول</h2>
          <p className="a-subtitle">تعریف فیلدهای سفارشی که هنگام ویرایش محصول تکمیل می‌شوند</p>
        </div>
        <div className="a-page-actions">
          <button type="button" className="a-btn a-btn--primary" onClick={handleCreate}>+ افزودن ویژگی</button>
          <span className="a-badge a-badge--brand">{attributes?.length ?? 0} ویژگی</span>
        </div>
      </section>

      {formOpen && (
        <>
      {/* Reference-style create form: header card + stacked sections + save footer */}
      <form className="a-form a-fade" onSubmit={handleSubmit}>
        <div className="a-form-head">
          <button type="button" className="a-form-back" onClick={handleCancel} aria-label="بازگشت" title="بازگشت">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
          <div className="a-form-title">
            {editingId ? 'ویرایش ویژگی' : 'افزودن ویژگی جدید'}
            {editingId && <span className="a-badge a-badge--neutral">{editingId}</span>}
          </div>
          <div className="a-form-actions">
            {editingId && (
              <button type="button" className="a-btn a-btn--ghost" onClick={handleCancel}>انصراف</button>
            )}
            <button type="submit" className="a-btn a-btn--primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
          </div>
        </div>

        <section className="a-card">
          <div className="a-card-head">
            <h3 className="a-card-title">اطلاعات ویژگی</h3>
          </div>
          <p className="a-card-sub">نوع فیلد مشخص می‌کند گزینه‌ها در فرم محصول چگونه نمایش داده شوند.</p>
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
        </section>

        <div className="a-form-foot">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="a-btn a-btn--primary a-btn--lg"
          >
            {saveMutation.isPending ? 'در حال ثبت...' : editingId ? 'ذخیره تغییرات' : '+ افزودن ویژگی'}
          </button>
        </div>
      </form>
        </>
      )}

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
  );
}