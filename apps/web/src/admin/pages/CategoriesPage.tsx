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
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">مدیریت دسته‌بندی‌ها</h2>
          <p className="a-subtitle">مشخصات کامل دسته و برندهای قابل نمایش در هر دسته‌بندی</p>
        </div>
        <div className="a-page-actions">
          <span className="a-badge a-badge--brand">{formatNumber(categories.length)} دسته</span>
        </div>
      </section>

      <div className="a-cols">
        {/* Form — "layout form" pattern (left/sticky column in RTL) */}
        <section className="a-card a-col-sticky">
          <div className="a-card-head">
            <div>
              <h3 className="a-card-title">{editingId === null ? 'افزودن دسته‌بندی جدید' : 'ویرایش دسته‌بندی'}</h3>
              <p className="a-card-sub">فیلدهای ستاره‌دار الزامی هستند.</p>
            </div>
            <div className="a-card-actions">
              {editingId !== null && <span className="a-badge a-badge--neutral">ID: #{editingId}</span>}
            </div>
          </div>

          <form
            className="a-card-body flex flex-col gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (!form.name.trim() || !form.faName.trim()) {
                toast.error('نام فارسی و انگلیسی را وارد کنید.');
                return;
              }
              save.mutate();
            }}
          >
            {/* Basic info */}
            <div>
              <h4 className="a-card-title mb-3">اطلاعات پایه</h4>
              <div className="a-form-grid">
                <label className="a-field">
                  <span className="a-label">نام فارسی <span className="a-req">*</span></span>
                  <input className="a-input" value={form.faName} onChange={(e) => setForm({ ...form, faName: e.target.value })} placeholder="مثلاً ساعت هوشمند" />
                </label>
                <label className="a-field">
                  <span className="a-label">نام انگلیسی <span className="a-req">*</span></span>
                  <input className="a-input a-ltr a-mono" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Smart Watch" />
                </label>
                <label className="a-field">
                  <span className="a-label">ترتیب نمایش</span>
                  <input className="a-input" type="number" inputMode="numeric" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
                  <span className="a-hint">عدد کوچک‌تر ابتدا نمایش داده می‌شود.</span>
                </label>
              </div>
            </div>

            {/* Option: image */}
            <div className="a-divider" />
            <div>
              <h4 className="a-card-title mb-3">تصویر دسته‌بندی</h4>
              <ImagePicker label="آیکن / تصویر" value={form.iconUrl} kind="category" onChange={(iconUrl) => setForm({ ...form, iconUrl })} />
            </div>

            {/* Option group: brands of this category */}
            <div className="a-divider" />
            <div>
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div>
                  <h4 className="a-card-title">برندهای این دسته</h4>
                  <p className="a-card-sub">{formatNumber(form.brandNames.length)} برند انتخاب شده</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="a-btn a-btn--ghost a-btn--xs" onClick={() => setForm({ ...form, brandNames: brands.map((brand) => brand.name) })}>انتخاب همه</button>
                  <button type="button" className="a-btn a-btn--ghost a-btn--xs" onClick={() => setForm({ ...form, brandNames: [] })}>پاک کردن</button>
                </div>
              </div>
              <input
                className="a-input mb-2"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="جستجو میان برندها…"
              />
              <div className="a-option-grid">
                {filteredBrands.map((brand) => {
                  const on = form.brandNames.includes(brand.name);
                  return (
                    <label key={brand.id} className={`a-chip-opt${on ? ' a-chip-opt--on' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleBrand(brand.name)} />
                      <span className="a-chip-opt-copy">
                        <strong>{brand.faName}</strong>
                        <small className="a-ltr">{brand.name}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
              {filteredBrands.length === 0 && <div className="a-empty">برندی پیدا نشد.</div>}
            </div>

            <div className="a-divider" />
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="a-btn a-btn--primary" disabled={save.isPending}>
                {save.isPending ? 'در حال ذخیره…' : editingId === null ? '+ ثبت دسته‌بندی' : 'ذخیره تغییرات'}
              </button>
              {editingId !== null && (
                <button type="button" className="a-btn a-btn--secondary" onClick={resetForm}>انصراف از ویرایش</button>
              )}
            </div>
          </form>
        </section>

        {/* List */}
        <section className="a-card">
          <div className="a-card-head">
            <div>
              <h3 className="a-card-title">فهرست دسته‌بندی‌ها</h3>
              <p className="a-card-sub">برندهای متصل‌شده در هر ردیف نمایش داده می‌شوند.</p>
            </div>
            <input className="a-input" style={{ maxWidth: 230 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی دسته…" />
          </div>

          <div className="a-list">
            {filteredCategories.map((category) => (
              <article key={category.id} className={`a-list-item${editingId === category.id ? ' a-list-item--active' : ''}`}>
                <div className="a-list-icon">
                  {category.iconUrl ? (
                    <img src={category.iconUrl.startsWith('/') || category.iconUrl.startsWith('http') ? category.iconUrl : `/assets/category/${category.iconUrl}`} alt="" />
                  ) : (
                    <span>{category.faName.slice(0, 1)}</span>
                  )}
                </div>
                <div className="a-list-copy">
                  <strong>{category.faName}</strong>
                  <span className="a-ltr">{category.name}</span>
                  <small>{formatNumber(category.productCount ?? 0)} محصول · ترتیب {formatNumber(category.sortOrder)}</small>
                  {category.brandNames.length > 0 && (
                    <div className="a-list-meta">
                      {category.brandNames.slice(0, 7).map((name) => <i key={name}>{name}</i>)}
                      {category.brandNames.length > 7 && <i>+{formatNumber(category.brandNames.length - 7)}</i>}
                    </div>
                  )}
                </div>
                <div className="a-list-actions">
                  <button type="button" className="a-btn a-btn--secondary a-btn--xs" onClick={() => edit(category)}>ویرایش</button>
                  <button type="button" className="a-btn a-btn--danger a-btn--xs" disabled={remove.isPending} onClick={() => { if (confirm(`دسته‌بندی «${category.faName}» حذف شود؟`)) remove.mutate(category.id); }}>حذف</button>
                </div>
              </article>
            ))}
            {!categoriesQuery.isLoading && filteredCategories.length === 0 && <div className="a-empty">دسته‌بندی پیدا نشد.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}