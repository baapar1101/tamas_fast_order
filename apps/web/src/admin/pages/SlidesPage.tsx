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
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="text-xl font-bold">مدیریت بنرها (اسلایدر)</h1>
      </div>

      <div className="card max-w-2xl mb-8">
        <h2 className="text-lg font-bold mb-4">{editingId ? 'ویرایش بنر' : 'افزودن بنر جدید'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">عنوان (اختیاری)</label>
              <input
                type="text"
                className="input"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="مثال: فروش ویژه بهاره"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">لینک (اختیاری)</label>
              <input
                type="text"
                className="input"
                value={formData.linkUrl}
                onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                placeholder="https://..."
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ترتیب نمایش</label>
              <input
                type="number"
                className="input"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium">فعال باشد</span>
              </label>
            </div>
          </div>

          <div className="pt-2">
            <ImagePicker
              label="تصویر بنر"
              value={formData.imageUrl}
              kind="slide"
              onChange={(url) => setFormData({ ...formData, imageUrl: url })}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'در حال ذخیره...' : 'ذخیره بنر'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditingId(null);
                  setFormData({ title: '', imageUrl: '', linkUrl: '', sortOrder: 0, isActive: true });
                }}
              >
                انصراف
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">در حال بارگذاری...</div>
        ) : slides?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">هیچ بنری ثبت نشده است.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 text-gray-600 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium">تصویر</th>
                  <th className="px-4 py-3 font-medium">عنوان</th>
                  <th className="px-4 py-3 font-medium">لینک</th>
                  <th className="px-4 py-3 font-medium">ترتیب</th>
                  <th className="px-4 py-3 font-medium">وضعیت</th>
                  <th className="px-4 py-3 font-medium text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {slides?.map((slide) => (
                  <tr key={slide.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="w-24 h-12 bg-gray-100 rounded overflow-hidden">
                        <img 
                          src={slide.imageUrl} 
                          alt={slide.title || 'بنر'} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">{slide.title || '-'}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {slide.linkUrl ? (
                        <a href={slide.linkUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline max-w-[150px] truncate inline-block">
                          {slide.linkUrl}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3">{slide.sortOrder}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        slide.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {slide.isActive ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(slide)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1"
                        >
                          ویرایش
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('آیا از حذف این بنر اطمینان دارید؟')) {
                              deleteMutation.mutate(slide.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-800 text-sm font-medium px-2 py-1"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
