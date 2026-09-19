import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

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

  const { data: warehouses, isLoading } = useQuery({
    queryKey: ['admin', 'warehouses'],
    queryFn: async () => {
      const list = await api.get<Warehouse[]>('/admin/warehouses');
      return list;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingId) {
        return api.put(`/admin/warehouses/${editingId}`, data);
      }
      return api.post('/admin/warehouses', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'warehouses'] });
      toast.ok(editingId ? 'انبار بروز شد' : 'انبار اضافه شد');
      setEditingId(null);
      setFormData({ code: '', name: '', location: '', isActive: true });
    },
    onError: (err: any) => {
      toast.error(err.message || 'خطا در ذخیره انبار');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/admin/warehouses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'warehouses'] });
      toast.ok('انبار حذف شد');
    },
    onError: (err: any) => toast.error(err.message || 'خطا در حذف انبار'),
  });

  const handleEdit = (w: Warehouse) => {
    setEditingId(w.id);
    setFormData({ code: w.code, name: w.name, location: w.location || '', isActive: w.isActive });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ code: '', name: '', location: '', isActive: true });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold text-white mb-6">{editingId ? 'ویرایش انبار' : 'افزودن انبار جدید'}</h2>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">کد انبار (انگلیسی)</label>
            <input
              type="text"
              required
              className="huma-input"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="مثلا: kerman"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">نام انبار</label>
            <input
              type="text"
              required
              className="huma-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="مثلا: انبار مرکزی کرمان"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">موقعیت / شهر</label>
            <input
              type="text"
              className="huma-input"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded text-emerald-500 bg-slate-800 border-slate-700"
              />
              <span className="text-sm font-medium text-slate-300">انبار فعال است</span>
            </label>
          </div>
          <div className="md:col-span-2 flex gap-3 mt-2">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="huma-btn-primary px-8"
            >
              {saveMutation.isPending ? 'در حال ثبت...' : 'ذخیره انبار'}
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
          <h2 className="text-lg font-bold text-white">لیست انبارها</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right text-slate-300">
            <thead className="bg-[#131c2e] text-xs text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">کد</th>
                <th className="px-4 py-3 font-medium">نام</th>
                <th className="px-4 py-3 font-medium">موقعیت</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {isLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">در حال دریافت...</td></tr>
              ) : warehouses?.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">هیچ انباری یافت نشد.</td></tr>
              ) : (
                warehouses?.map((w: Warehouse) => (
                  <tr key={w.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-mono text-emerald-400" dir="ltr">{w.code}</td>
                    <td className="px-4 py-3 font-bold text-white">{w.name}</td>
                    <td className="px-4 py-3">{w.location || '-'}</td>
                    <td className="px-4 py-3">
                      {w.isActive ? (
                        <span className="chip chip-brand bg-emerald-500/10 text-emerald-400 border-emerald-500/20">فعال</span>
                      ) : (
                        <span className="chip bg-slate-500/10 text-slate-400 border-slate-500/20">غیرفعال</span>
                      )}
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(w)}
                        className="text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        ویرایش
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('آیا از حذف این انبار مطمئن هستید؟ موجودی کالاها در این انبار از بین خواهد رفت.')) {
                            deleteMutation.mutate(w.id);
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
