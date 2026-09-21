import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Modal } from '../components/Modal';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

interface Attribute {
  id: string;
  name: string;
  type: string;
  options?: string[];
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  text: 'متن ساده',
  number: 'عدد',
  boolean: 'بله / خیر',
  select: 'چند گزینهای',
};

export function AttributesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ name: string; type: string; options: string[] }>({
    name: '',
    type: 'text',
    options: [],
  });
  const [formOpen, setFormOpen] = useState(false);
  const [focusRow, setFocusRow] = useState(-1);

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
      setFormData({ name: '', type: 'text', options: [] });
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
    setFormData({ name: a.name, type: a.type, options: a.options ?? [] });
    setFormOpen(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ name: '', type: 'text', options: [] });
    setFormOpen(false);
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({ name: '', type: 'text', options: [] });
    setFormOpen(true);
  };

  const setOption = (idx: number, value: string) => {
    const options = [...formData.options];
    options[idx] = value;
    setFormData({ ...formData, options });
  };

  const addOption = () => {
    setFormData({ ...formData, options: [...formData.options, ''] });
    setFocusRow(formData.options.length);
  };

  const removeOption = (idx: number) => {
    const options = [...formData.options];
    options.splice(idx, 1);
    setFormData({ ...formData, options });
    setFocusRow(-1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.type === 'select') {
      const cleaned = formData.options.map((o) => o.trim()).filter(Boolean);
      if (cleaned.length === 0) {
        toast.error('برای ویژگی چندگزینه‌ای باید حداقل یک گزینه وارد کنید');
        return;
      }
      saveMutation.mutate({ ...formData, name: formData.name.trim(), options: cleaned });
      return;
    }
    saveMutation.mutate({ name: formData.name.trim(), type: formData.type, options: [] });
  };

  const previewOptions = formData.options.map((o) => o.trim()).filter(Boolean);
  const isDuplicate = (value: string, idx: number) =>
    value.trim() !== '' &&
    formData.options.some((o, i) => i !== idx && o.trim() !== '' && o.trim() === value.trim());
  const typeCounts = (attributes ?? []).reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});

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

      <Modal
        open={formOpen}
        title={
          <>
            {editingId ? 'ویرایش ویژگی' : 'افزودن ویژگی جدید'}
            {editingId && <span className="a-badge a-badge--neutral">{editingId}</span>}
          </>
        }
        onClose={handleCancel}
        wide
        busy={saveMutation.isPending}
        footer={
          <>
            <button type="button" className="a-btn a-btn--ghost" onClick={handleCancel} disabled={saveMutation.isPending}>انصراف</button>
            <button type="submit" form="attribute-form" className="a-btn a-btn--primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'در حال ذخیره…' : editingId ? 'ذخیره تغییرات' : 'افزودن ویژگی'}
            </button>
          </>
        }
      >
        <form id="attribute-form" className="a-form a-fade" onSubmit={handleSubmit}>
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
                <div className="a-segmented a-segmented--wrap" role="group" aria-label="نوع فیلد">
                  {Object.entries(TYPE_LABELS).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      className={`a-seg ${formData.type === val ? 'a-seg--on' : ''}`}
                      onClick={() => setFormData({ ...formData, type: val })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </label>
            </div>
          </section>

          {formData.type === 'select' && (
            <section className="a-card">
              <div className="a-card-head">
                <div>
                  <h3 className="a-card-title">گزینه‌ها</h3>
                  <p className="a-card-sub">این موارد به‌صورت چندگزینه‌ای در فرم محصول ظاهر می‌شوند.</p>
                </div>
                <button type="button" className="a-btn a-btn--secondary a-btn--xs" onClick={addOption}>
                  + افزودن گزینه
                </button>
              </div>

              <div className="space-y-2">
                {formData.options.length === 0 && (
                  <div className="a-empty a-empty--small">
                    <p>هنوز گزینه‌ای اضافه نشده است.</p>
                    <span>با دکمه «+ افزودن گزینه» شروع کنید؛ حداقل یک گزینه لازم است.</span>
                  </div>
                )}
                {formData.options.map((opt, idx) => (
                  <div key={idx} className="a-option-row">
                    <span className="a-badge a-badge--neutral a-option-index">{idx + 1}</span>
                    <input
                      type="text"
                      className={`a-input ${isDuplicate(opt, idx) ? 'a-input--warn' : ''}`}
                      value={opt}
                      autoFocus={idx === focusRow}
                      onChange={(e) => setOption(idx, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addOption();
                        }
                      }}
                      placeholder={`گزینه ${idx + 1} (مثلا: ۱۲۸ گیگابایت)`}
                    />
                    {isDuplicate(opt, idx) && (
                      <span className="a-option-dup">
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-3.5 w-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        تکراری
                      </span>
                    )}
                    <button
                      type="button"
                      className="a-btn a-btn--ghost a-btn--xs shrink-0"
                      onClick={() => removeOption(idx)}
                      aria-label="حذف گزینه"
                      title="حذف گزینه"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {previewOptions.length > 0 && (
                <>
                  <div className="a-option-preview-title">
                    پیش‌نمایش در فرم محصول
                    <span className="a-badge a-badge--neutral">{previewOptions.length} گزینه</span>
                  </div>
                  <div className="a-option-grid">
                    {previewOptions.map((o, i) => (
                      <label key={o + i} className="a-chip-opt">
                        <input type="checkbox" readOnly />
                        <span className="a-chip-opt-copy">
                          <strong>{o}</strong>
                          <small>گزینه {i + 1}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </form>
      </Modal>

      {/* List */}
      <section className="a-card a-container-md">
        <div className="a-card-head">
          <div>
            <h3 className="a-card-title">لیست ویژگی‌ها</h3>
            <p className="a-card-sub">پس از ثبت، گزینه موردنظر در فرم محصول ظاهر می‌شود.</p>
          </div>
          {Object.keys(TYPE_LABELS).some((t) => typeCounts[t]) && (
            <div className="a-card-actions">
              {Object.entries(TYPE_LABELS).map(([val, label]) =>
                typeCounts[val] ? (
                  <span key={val} className="a-badge a-badge--neutral">
                    {label}: {typeCounts[val]}
                  </span>
                ) : null,
              )}
            </div>
          )}
        </div>

        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>نام ویژگی</th>
                <th>نوع</th>
                <th>گزینه‌ها</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="text-center text-slate-500">در حال دریافت...</td></tr>
              ) : attributes?.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-slate-500">هیچ ویژگی یافت نشد.</td></tr>
              ) : (
                attributes?.map((a: Attribute) => (
                  <tr key={a.id}>
                    <td className="a-strong">{a.name}</td>
                    <td>
                      <span className={`a-badge ${a.type === 'text' ? 'a-badge--neutral' : a.type === 'number' ? 'a-badge--brand' : a.type === 'select' ? 'a-badge--amber' : 'a-badge--green'}`}>
                        {TYPE_LABELS[a.type] ?? a.type}
                      </span>
                    </td>
                    <td>
                      {a.type === 'select' ? (
                        a.options && a.options.length > 0 ? (
                          <div className="a-options-cell">
                            {a.options.slice(0, 3).map((opt) => (
                              <span key={opt} className="a-badge a-badge--amber">{opt}</span>
                            ))}
                            {a.options.length > 3 && (
                              <span className="a-badge a-badge--neutral">+{a.options.length - 3}</span>
                            )}
                          </div>
                        ) : (
                          <span className="a-badge a-badge--red">بدون گزینه</span>
                        )
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
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