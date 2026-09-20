import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { ImagePicker } from '../components/ImagePicker';

interface Slide {
  id: number;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function SlidesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    imageUrl: '',
    linkUrl: '',
    sortOrder: 0,
    isActive: true,
  });

  const { data: slides, isLoading } = useQuery<Slide[]>({
    queryKey: ['admin', 'slides'],
    queryFn: () => api.get('/admin/slides'),
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      if (editingId) {
        return api.put(`/admin/slides/${editingId}`, data);
      }
      return api.post('/admin/slides', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'slides'] });
      toast.ok(editingId ? 'بنر بروز شد' : 'بنر اضافه شد');
      setEditingId(null);
      setFormData({ title: '', imageUrl: '', linkUrl: '', sortOrder: 0, isActive: true });
      setFormOpen(false);
    },
    onError: (err: any) => toast.error(err.message || 'خطا در ذخیره بنر'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/admin/slides/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'slides'] });
      toast.ok('بنر حذف شد');
    },
    onError: (err: any) => toast.error(err.message || 'خطا در حذف بنر'),
  });

  function handleEdit(slide: Slide) {
    setEditingId(slide.id);
    setFormData({
      title: slide.title || '',
      imageUrl: slide.imageUrl,
      linkUrl: slide.linkUrl || '',
      sortOrder: slide.sortOrder,
      isActive: slide.isActive,
    });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancel() {
    setEditingId(null);
    setFormData({ title: '', imageUrl: '', linkUrl: '', sortOrder: 0, isActive: true });
    setFormOpen(false);
  }

  function handleCreate() {
    setEditingId(null);
    setFormData({ title: '', imageUrl: '', linkUrl: '', sortOrder: 0, isActive: true });
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.imageUrl) {
      toast.error('تصویر بنر الزامی است');
      return;
    }
    saveMutation.mutate(formData);
  }

  return (
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">مدیریت بنرها (اسلایدر)</h2>
          <p className="a-subtitle">مدیریت بنرهای نمایشی اسلایدر فروشگاه</p>
        </div>
        <div className="a-page-actions">
          <button type="button" className="a-btn a-btn--primary" onClick={handleCreate}>+ افزودن بنر</button>
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
            {editingId ? 'ویرایش بنر' : 'افزودن بنر جدید'}
            {editingId && <span className="a-badge a-badge--neutral">#{editingId}</span>}
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
            <h3 className="a-card-title">جزئیات بنر</h3>
          </div>
          <div className="a-form-grid">
            <div className="a-field">
              <label className="a-label">عنوان (اختیاری)</label>
              <input
                type="text"
                className="a-input"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="مثال: فروش ویژه بهاره"
              />
            </div>
            <div className="a-field">
              <label className="a-label">لینک (اختیاری)</label>
              <input
                type="text"
                className="a-input"
                value={formData.linkUrl}
                onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                placeholder="https://..."
                dir="ltr"
              />
            </div>
            <div className="a-field">
              <label className="a-label">ترتیب نمایش</label>
              <input
                type="number"
                className="a-input"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
        </section>

        <section className="a-card">
          <div className="a-card-head">
            <h3 className="a-card-title">تصویر بنر</h3>
          </div>
          <p className="a-card-sub">تصویر شاخص بنر؛ حداقل برای نمایش در اسلایدر الزامی است.</p>
          <ImagePicker
            label="تصویر بنر"
            value={formData.imageUrl}
            kind="slide"
            onChange={(url) => setFormData({ ...formData, imageUrl: url })}
          />
        </section>

        <section className="a-card">
          <div className="a-card-head">
            <h3 className="a-card-title">وضعیت نمایش</h3>
          </div>
          <div className="a-option-row">
            <div className="a-option-copy">
              <div className="a-option-title">فعال باشد</div>
              <div className="a-option-desc">بنرهای غیرفعال در اسلایدر نمایش داده نمی‌شوند</div>
            </div>
            <label className="a-switch">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span className="a-switch-track"><span className="a-switch-thumb" /></span>
            </label>
          </div>
        </section>

        <div className="a-form-foot">
          <button type="submit" className="a-btn a-btn--primary a-btn--lg" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'در حال ذخیره...' : 'ذخیره بنر'}
          </button>
        </div>
      </form>
        </>
      )}

      <section className="a-card a-card--flush">
        {isLoading ? (
          <div className="a-empty">در حال بارگذاری...</div>
        ) : slides?.length === 0 ? (
          <div className="a-empty">هیچ بنری ثبت نشده است.</div>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>تصویر</th>
                  <th>عنوان</th>
                  <th>لینک</th>
                  <th>ترتیب</th>
                  <th>وضعیت</th>
                  <th className="text-left">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {slides?.map((slide) => (
                  <tr key={slide.id}>
                    <td>
                      <span className="a-media-thumb inline-flex">
                        <img
                          src={slide.imageUrl}
                          alt={slide.title || 'بنر'}
                          className="h-full w-full object-cover"
                        />
                      </span>
                    </td>
                    <td className="font-bold text-white">{slide.title || '-'}</td>
                    <td dir="ltr">
                      {slide.linkUrl ? (
                        <a href={slide.linkUrl} target="_blank" rel="noreferrer" className="a-link a-truncate inline-block max-w-[150px] align-bottom">
                          {slide.linkUrl}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{slide.sortOrder}</td>
                    <td>
                      <span className={`chip ${slide.isActive ? 'chip-brand' : 'chip-slate'}`}>
                        {slide.isActive ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td className="text-left">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(slide)}
                          className="a-icon-btn a-icon-btn--info"
                          title="ویرایش"
                        >
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('آیا از حذف این بنر اطمینان دارید؟')) {
                              deleteMutation.mutate(slide.id);
                            }
                          }}
                          className="a-icon-btn a-icon-btn--danger"
                          title="حذف"
                        >
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-4 w-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}