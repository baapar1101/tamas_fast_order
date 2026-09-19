import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrandDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { ImagePicker } from '../components/ImagePicker';

interface BrandForm {
  name: string;
  faName: string;
  iconUrl: string;
  sortOrder: number;
}

const EMPTY_FORM: BrandForm = { name: '', faName: '', iconUrl: '', sortOrder: 0 };

export function BrandsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BrandForm>(EMPTY_FORM);
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: () => api.get<{ brands: BrandDTO[] }>('/admin/brands'),
  });

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, name: form.name.trim(), faName: form.faName.trim(), iconUrl: form.iconUrl.trim() || null };
      return editingId === null ? api.post('/admin/brands', body) : api.patch(`/admin/brands/${editingId}`, body);
    },
    onSuccess: () => {
      toast.ok(editingId === null ? 'برند جدید ثبت شد.' : 'اطلاعات برند ذخیره شد.');
      resetForm();
      void qc.invalidateQueries({ queryKey: ['admin', 'brands'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'taxonomy'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/admin/brands/${id}`),
    onSuccess: () => {
      toast.ok('برند حذف شد.');
      if (editingId !== null) resetForm();
      void qc.invalidateQueries({ queryKey: ['admin', 'brands'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'taxonomy'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const brands = query.data?.brands ?? [];
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return brands;
    return brands.filter((brand) => `${brand.faName} ${brand.name}`.toLowerCase().includes(needle));
  }, [brands, search]);

  const edit = (brand: BrandDTO) => {
    setEditingId(brand.id);
    setForm({ name: brand.name, faName: brand.faName, iconUrl: brand.iconUrl ?? '', sortOrder: brand.sortOrder });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 taxonomy-page">
      <section className="flex flex-wrap items-center justify-between gap-4 animate-fade-up">
        <div>
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">مدیریت برندها</h2>
          <p className="mt-1 text-xs text-slate-400">ثبت نام فارسی و انگلیسی، لوگو و ترتیب نمایش برندها</p>
        </div>
        <span className="chip chip-aqua">{formatNumber(brands.length)} برند</span>
      </section>

      <div className="taxonomy-layout">
        <section className="glass-card p-6 taxonomy-form-card">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <h3 className="text-base font-bold text-white">{editingId === null ? 'افزودن برند جدید' : 'ویرایش برند'}</h3>
            {editingId !== null && <span className="chip chip-slate">ID: #{editingId}</span>}
          </div>

          <form
            className="taxonomy-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!form.name.trim() || !form.faName.trim()) {
                toast.error('نام فارسی و انگلیسی را وارد کنید.');
                return;
              }
              save.mutate();
            }}
          >
            <div className="taxonomy-fields-grid">
              <label className="taxonomy-field">
                <span>نام فارسی *</span>
                <input className="huma-input" value={form.faName} onChange={(e) => setForm({ ...form, faName: e.target.value })} placeholder="مثلاً انکر" />
              </label>
              <label className="taxonomy-field">
                <span>نام انگلیسی *</span>
                <input className="huma-input" dir="ltr" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ANKER" />
              </label>
              <label className="taxonomy-field">
                <span>ترتیب نمایش</span>
                <input className="huma-input" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
              </label>
            </div>

            <ImagePicker label="لوگو / تصویر برند" value={form.iconUrl} kind="brand" onChange={(iconUrl) => setForm({ ...form, iconUrl })} />

            <div className="taxonomy-form-actions">
              <button type="submit" className="huma-btn-primary" disabled={save.isPending}>{save.isPending ? 'در حال ذخیره…' : editingId === null ? '+ ثبت برند' : 'ذخیره تغییرات'}</button>
              {editingId !== null && <button type="button" className="huma-btn-secondary" onClick={resetForm}>انصراف از ویرایش</button>}
            </div>
          </form>
        </section>

        <section className="glass-card p-6 taxonomy-list-card">
          <div className="taxonomy-list-header">
            <div>
              <h3 className="text-base font-bold text-white">فهرست برندها</h3>
              <p className="text-[10px] text-slate-500">برای مشاهده فرم کامل، ویرایش را انتخاب کنید.</p>
            </div>
            <input className="huma-input taxonomy-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی برند…" />
          </div>

          <div className="taxonomy-items">
            {filtered.map((brand) => (
              <article key={brand.id} className={`taxonomy-item${editingId === brand.id ? ' active' : ''}`}>
                <div className="taxonomy-item-icon">
                  {brand.iconUrl ? <img src={brand.iconUrl.startsWith('/') || brand.iconUrl.startsWith('http') ? brand.iconUrl : `/assets/brand/${brand.iconUrl}`} alt="" /> : <span>{brand.faName.slice(0, 1)}</span>}
                </div>
                <div className="taxonomy-item-copy">
                  <strong>{brand.faName}</strong>
                  <span dir="ltr">{brand.name}</span>
                  <small>{formatNumber(brand.productCount ?? 0)} محصول · ترتیب {formatNumber(brand.sortOrder)}</small>
                </div>
                <div className="taxonomy-item-actions">
                  <button type="button" className="huma-btn-secondary" onClick={() => edit(brand)}>ویرایش</button>
                  <button type="button" className="taxonomy-delete-btn" disabled={remove.isPending} onClick={() => { if (confirm(`برند «${brand.faName}» حذف شود؟`)) remove.mutate(brand.id); }}>حذف</button>
                </div>
              </article>
            ))}
            {!query.isLoading && filtered.length === 0 && <div className="taxonomy-empty">برندی پیدا نشد.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
