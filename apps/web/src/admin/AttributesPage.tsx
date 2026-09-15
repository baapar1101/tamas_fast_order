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
    <div className="space-y-6 max-w-4xl">
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-white mb-6">{editingId ? 'ویرایش ویژگی' : 'افزودن ویژگی جدید'}</h2>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">نام ویژگی</label>
            <input
              type="text"
              required
              className="huma-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="مثلا: حافظه داخلی"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">نوع فیلد</label>
            <select
              required
              className="huma-input"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="text">متن ساده</option>
              <option value="number">عدد</option>
              <option value="boolean">بله / خیر</option>
            </select>
          </div>
          
          <div className="md:col-span-2 flex gap-3 mt-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="huma-btn-primary px-8"
            >
              {saveMutation.isPending ? 'در حال ثبت...' : 'ذخیره ویژگی'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                className="huma-btn-secondary px-8"
              >
                انصراف
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/[0.06]">
          <h2 className="text-lg font-bold text-white">لیست ویژگی‌ها</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right text-slate-300">
            <thead className="bg-[#131c2e] text-xs text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">نام ویژگی</th>
                <th className="px-4 py-3 font-medium">نوع</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {isLoading ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">در حال دریافت...</td></tr>
              ) : attributes?.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">هیچ ویژگی یافت نشد.</td></tr>
              ) : (
                attributes?.map((a: Attribute) => (
                  <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-bold text-white">{a.name}</td>
                    <td className="px-4 py-3">
                      {a.type === 'text' ? 'متن ساده' : a.type === 'number' ? 'عدد' : a.type === 'boolean' ? 'بله / خیر' : a.type}
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(a)}
                        className="text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        ویرایش
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('آیا از حذف این ویژگی مطمئن هستید؟')) {
                            deleteMutation.mutate(a.id);
                          }
                        }}
                        className="text-rose-400 hover:text-rose-300 transition-colors"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
