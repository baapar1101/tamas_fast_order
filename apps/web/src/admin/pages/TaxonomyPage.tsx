import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrandDTO, CategoryDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

export function TaxonomyPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [catName, setCatName] = useState('');
  const [brandName, setBrandName] = useState('');

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

  const categories = taxonomy.data?.categories ?? [];
  const brands = taxonomy.data?.brands ?? [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <section className="flex flex-wrap items-center justify-between gap-4 animate-fade-up">
        <div>
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">مدیریت دسته‌ها و برندها</h2>
          <p className="mt-1 text-xs text-slate-400">تعریف دسته‌بندی محصولات و برندهای سازنده</p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Categories Section */}
        <section className="glass-card p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <h3 className="text-base font-bold text-white">دسته‌بندی‌ها</h3>
            <span className="chip chip-brand">{formatNumber(categories.length)} دسته</span>
          </div>

          {/* Add Category Form */}
          <form
            className="space-y-3 bg-[#131c2e]/40 p-4 rounded-xl border border-white/[0.06]"
            onSubmit={(e) => {
              e.preventDefault();
              if (catName.trim()) addCat.mutate();
            }}
          >
            <h4 className="text-xs font-bold text-slate-300">افزودن دسته‌بندی جدید</h4>
            <div className="flex gap-2">
              <input
                className="huma-input flex-1"
                placeholder="عنوان دسته (مثلا: کالای دیجیتال)"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
              />
              <button type="submit" className="huma-btn-primary" disabled={addCat.isPending}>
                + ثبت
              </button>
            </div>
          </form>

          {/* Categories List */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors"
              >
                <div>
                  <div className="font-bold text-white text-xs">{c.faName}</div>
                  <div className="text-[10px] text-slate-500">{c.name}</div>
                </div>
                <span className="chip chip-slate">ID: #{c.id}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Brands Section */}
        <section className="glass-card p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <h3 className="text-base font-bold text-white">برندها</h3>
            <span className="chip chip-aqua">{formatNumber(brands.length)} برند</span>
          </div>

          {/* Add Brand Form */}
          <form
            className="space-y-3 bg-[#131c2e]/40 p-4 rounded-xl border border-white/[0.06]"
            onSubmit={(e) => {
              e.preventDefault();
              if (brandName.trim()) addBrand.mutate();
            }}
          >
            <h4 className="text-xs font-bold text-slate-300">افزودن برند جدید</h4>
            <div className="flex gap-2">
              <input
                className="huma-input flex-1"
                placeholder="نام برند (مثلا: انکر / ANKER)"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
              <button type="submit" className="huma-btn-primary" disabled={addBrand.isPending}>
                + ثبت
              </button>
            </div>
          </form>

          {/* Brands List */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {brands.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-colors"
              >
                <div>
                  <div className="font-bold text-white text-xs">{b.faName}</div>
                  <div className="text-[10px] text-slate-500">{b.name}</div>
                </div>
                <span className="chip chip-slate">ID: #{b.id}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
