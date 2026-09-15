import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrandDTO, CategoryDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { ImagePicker } from '../components/ImagePicker';

interface CategoryForm {
  name: string;
  faName: string;
  iconUrl: string;
  sortOrder: number;
  brandNames: string[];
}

const EMPTY_FORM: CategoryForm = { name: '', faName: '', iconUrl: '', sortOrder: 0, brandNames: [] };

export function CategoriesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [brandSearch, setBrandSearch] = useState('');

  const categoriesQuery = useQuery({ queryKey: ['admin', 'categories'], queryFn: () => api.get<{ categories: CategoryDTO[] }>('/admin/categories') });
  const brandsQuery = useQuery({ queryKey: ['admin', 'brands'], queryFn: () => api.get<{ brands: BrandDTO[] }>('/admin/brands') });
  const categories = categoriesQuery.data?.categories ?? [];
  const brands = brandsQuery.data?.brands ?? [];

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setBrandSearch('');
  };

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, name: form.name.trim(), faName: form.faName.trim(), iconUrl: form.iconUrl.trim() || null };
      return editingId === null ? api.post('/admin/categories', body) : api.patch(`/admin/categories/${editingId}`, body);
    },
    onSuccess: () => {
      toast.ok(editingId === null ? 'دسته‌بندی جدید ثبت شد.' : 'اطلاعات دسته‌بندی ذخیره شد.');
      resetForm();
      void qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'taxonomy'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/admin/categories/${id}`),
    onSuccess: () => {
      toast.ok('دسته‌بندی حذف شد.');
      resetForm();
      void qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'taxonomy'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filteredCategories = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return categories;
    return categories.filter((category) => `${category.faName} ${category.name}`.toLowerCase().includes(needle));
  }, [categories, search]);

  const filteredBrands = useMemo(() => {
    const needle = brandSearch.trim().toLowerCase();
    if (!needle) return brands;
    return brands.filter((brand) => `${brand.faName} ${brand.name}`.toLowerCase().includes(needle));
  }, [brands, brandSearch]);

  const edit = (category: CategoryDTO) => {
    const selected = brands
      .filter((brand) => category.brandNames.some((name) => name.toLowerCase() === brand.name.toLowerCase() || name.toLowerCase() === brand.faName.toLowerCase()))
      .map((brand) => brand.name);
    setEditingId(category.id);
    setForm({ name: category.name, faName: category.faName, iconUrl: category.iconUrl ?? '', sortOrder: category.sortOrder, brandNames: selected });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleBrand = (name: string) => setForm((current) => ({
    ...current,
    brandNames: current.brandNames.includes(name) ? current.brandNames.filter((item) => item !== name) : [...current.brandNames, name],
  }));

  return (
    <div className="space-y-6 taxonomy-page">
      <section className="flex flex-wrap items-center justify-between gap-4 animate-fade-up">
        <div>
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">مدیریت دسته‌بندی‌ها</h2>
          <p className="mt-1 text-xs text-slate-400">مشخصات کامل دسته و برندهای قابل نمایش در هر دسته‌بندی</p>
        </div>
        <span className="chip chip-brand">{formatNumber(categories.length)} دسته</span>
      </section>

      <div className="taxonomy-layout">
        <section className="glass-card p-6 taxonomy-form-card">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <h3 className="text-base font-bold text-white">{editingId === null ? 'افزودن دسته‌بندی جدید' : 'ویرایش دسته‌بندی'}</h3>
            {editingId !== null && <span className="chip chip-slate">ID: #{editingId}</span>}
          </div>

          <form className="taxonomy-form" onSubmit={(event) => {
            event.preventDefault();
            if (!form.name.trim() || !form.faName.trim()) { toast.error('نام فارسی و انگلیسی را وارد کنید.'); return; }
            save.mutate();
          }}>
            <div className="taxonomy-fields-grid">
              <label className="taxonomy-field"><span>نام فارسی *</span><input className="huma-input" value={form.faName} onChange={(e) => setForm({ ...form, faName: e.target.value })} placeholder="مثلاً ساعت هوشمند" /></label>
              <label className="taxonomy-field"><span>نام انگلیسی *</span><input className="huma-input" dir="ltr" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Smart Watch" /></label>
              <label className="taxonomy-field"><span>ترتیب نمایش</span><input className="huma-input" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} /></label>
            </div>

            <ImagePicker label="آیکن / تصویر دسته‌بندی" value={form.iconUrl} kind="category" onChange={(iconUrl) => setForm({ ...form, iconUrl })} />

            <div className="category-brands-field">
              <div className="category-brands-heading">
                <div><strong>برندهای این دسته</strong><span>{formatNumber(form.brandNames.length)} برند انتخاب شده</span></div>
                <div className="category-brands-actions">
                  <button type="button" onClick={() => setForm({ ...form, brandNames: brands.map((brand) => brand.name) })}>انتخاب همه</button>
                  <button type="button" onClick={() => setForm({ ...form, brandNames: [] })}>پاک کردن</button>
                </div>
              </div>
              <input className="huma-input" value={brandSearch} onChange={(e) => setBrandSearch(e.target.value)} placeholder="جستجو میان برندها…" />
              <div className="brand-checkbox-grid">
                {filteredBrands.map((brand) => (
                  <label key={brand.id} className={`brand-checkbox${form.brandNames.includes(brand.name) ? ' selected' : ''}`}>
                    <input type="checkbox" checked={form.brandNames.includes(brand.name)} onChange={() => toggleBrand(brand.name)} />
                    <span><strong>{brand.faName}</strong><small dir="ltr">{brand.name}</small></span>
                  </label>
                ))}
              </div>
            </div>

            <div className="taxonomy-form-actions">
              <button type="submit" className="huma-btn-primary" disabled={save.isPending}>{save.isPending ? 'در حال ذخیره…' : editingId === null ? '+ ثبت دسته‌بندی' : 'ذخیره تغییرات'}</button>
              {editingId !== null && <button type="button" className="huma-btn-secondary" onClick={resetForm}>انصراف از ویرایش</button>}
            </div>
          </form>
        </section>

        <section className="glass-card p-6 taxonomy-list-card">
          <div className="taxonomy-list-header">
            <div><h3 className="text-base font-bold text-white">فهرست دسته‌بندی‌ها</h3><p className="text-[10px] text-slate-500">برندهای متصل‌شده در هر ردیف نمایش داده می‌شوند.</p></div>
            <input className="huma-input taxonomy-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی دسته…" />
          </div>
          <div className="taxonomy-items">
            {filteredCategories.map((category) => (
              <article key={category.id} className={`taxonomy-item category-item${editingId === category.id ? ' active' : ''}`}>
                <div className="taxonomy-item-icon">{category.iconUrl ? <img src={category.iconUrl.startsWith('/') || category.iconUrl.startsWith('http') ? category.iconUrl : `/assets/category/${category.iconUrl}`} alt="" /> : <span>{category.faName.slice(0, 1)}</span>}</div>
                <div className="taxonomy-item-copy"><strong>{category.faName}</strong><span dir="ltr">{category.name}</span><small>{formatNumber(category.productCount ?? 0)} محصول · ترتیب {formatNumber(category.sortOrder)}</small>
                  <div className="taxonomy-brand-chips">{category.brandNames.slice(0, 7).map((name) => <i key={name}>{name}</i>)}{category.brandNames.length > 7 && <i>+{formatNumber(category.brandNames.length - 7)}</i>}</div>
                </div>
                <div className="taxonomy-item-actions"><button type="button" className="huma-btn-secondary" onClick={() => edit(category)}>ویرایش</button><button type="button" className="taxonomy-delete-btn" disabled={remove.isPending} onClick={() => { if (confirm(`دسته‌بندی «${category.faName}» حذف شود؟`)) remove.mutate(category.id); }}>حذف</button></div>
              </article>
            ))}
            {!categoriesQuery.isLoading && filteredCategories.length === 0 && <div className="taxonomy-empty">دسته‌بندی پیدا نشد.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
