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
  const [formOpen, setFormOpen] = useState(false);

  const query = useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: () => api.get<{ brands: BrandDTO[] }>('/admin/brands'),
  });

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const canSubmit = Boolean(form.name.trim() && form.faName.trim());

  return (
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">مدیریت برندها</h2>
          <p className="a-subtitle">ثبت نام فارسی و انگلیسی، لوگو و ترتیب نمایش برندها</p>
        </div>
        <div className="a-page-actions">
          <button type="button" className="a-btn a-btn--primary" onClick={openCreate}>+ افزودن برند</button>
          <span className="a-badge a-badge--brand">{formatNumber(brands.length)} برند</span>
        </div>
      </section>

      {formOpen && (
        <>
      {/* Reference-style create form: header card + stacked sections + save footer */}
      <form
        className="a-form a-fade"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) {
            toast.error('نام فارسی و انگلیسی را وارد کنید.');
            return;
          }
          save.mutate();
        }}
      >
        <div className="a-form-head">
          <button type="button" className="a-form-back" onClick={resetForm} aria-label="بازگشت" title="بازگشت">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
          <div className="a-form-title">
            {editingId === null ? 'افزودن برند جدید' : 'ویرایش برند'}
            {editingId !== null && <span className="a-badge a-badge--neutral">#{editingId}</span>}
          </div>
          <div className="a-form-actions">
            {editingId !== null && (
              <button type="button" className="a-btn a-btn--ghost" onClick={resetForm}>انصراف</button>
            )}
            <button type="submit" className="a-btn a-btn--primary" disabled={save.isPending}>
              {save.isPending ? 'در حال ذخیره…' : 'ذخیره'}
            </button>
          </div>
        </div>

        <section className="a-card">
          <div className="a-card-head">
            <h3 className="a-card-title">اطلاعات پایه</h3>
          </div>
          <div className="a-form-grid">
            <label className="a-field">
              <span className="a-label">نام فارسی <span className="a-req">*</span></span>
              <input className="a-input" value={form.faName} onChange={(e) => setForm({ ...form, faName: e.target.value })} placeholder="مثلاً انکر" />
            </label>
            <label className="a-field">
              <span className="a-label">نام انگلیسی <span className="a-req">*</span></span>
              <input className="a-input a-ltr a-mono" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ANKER" />
            </label>
            <label className="a-field">
              <span className="a-label">ترتیب نمایش</span>
              <input className="a-input" type="number" inputMode="numeric" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
              <span className="a-hint">عدد کوچک‌تر ابتدا نمایش داده می‌شود.</span>
            </label>
          </div>
        </section>

        <section className="a-card">
          <div className="a-card-head">
            <h3 className="a-card-title">لوگو برند</h3>
          </div>
          <p className="a-card-sub">تصویر یا آیکن لوگو؛ از گالری قبلی یا آدرس مستقیم.</p>
          <ImagePicker label="لوگو / تصویر برند" value={form.iconUrl} kind="brand" onChange={(iconUrl) => setForm({ ...form, iconUrl })} />
        </section>

        <div className="a-form-foot">
          <button type="submit" className="a-btn a-btn--primary a-btn--lg" disabled={save.isPending}>
            {save.isPending ? 'در حال ذخیره…' : editingId === null ? '+ ثبت برند' : 'ذخیره تغییرات'}
          </button>
        </div>
      </form>
        </>
      )}

      {/* List */}
      <section className="a-card a-container-md">
        <div className="a-card-head">
          <div>
            <h3 className="a-card-title">فهرست برندها</h3>
            <p className="a-card-sub">برای مشاهده فرم کامل، ویرایش را انتخاب کنید.</p>
          </div>
          <input className="a-input" style={{ maxWidth: 230 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی برند…" />
        </div>

        <div className="a-list">
          {filtered.map((brand) => (
            <article key={brand.id} className={`a-list-item${editingId === brand.id ? ' a-list-item--active' : ''}`}>
              <div className="a-list-icon">
                {brand.iconUrl ? <img src={brand.iconUrl.startsWith('/') || brand.iconUrl.startsWith('http') ? brand.iconUrl : `/assets/brand/${brand.iconUrl}`} alt="" /> : <span>{brand.faName.slice(0, 1)}</span>}
              </div>
              <div className="a-list-copy">
                <strong>{brand.faName}</strong>
                <span className="a-ltr">{brand.name}</span>
                <small>{formatNumber(brand.productCount ?? 0)} محصول · ترتیب {formatNumber(brand.sortOrder)}</small>
              </div>
              <div className="a-list-actions">
                <button type="button" className="a-btn a-btn--secondary a-btn--xs" onClick={() => edit(brand)}>ویرایش</button>
                <button type="button" className="a-btn a-btn--danger a-btn--xs" disabled={remove.isPending} onClick={() => { if (confirm(`برند «${brand.faName}» حذف شود؟`)) remove.mutate(brand.id); }}>حذف</button>
              </div>
            </article>
          ))}
          {!query.isLoading && filtered.length === 0 && <div className="a-empty">برندی پیدا نشد.</div>}
        </div>
      </section>
    </div>
  );
}