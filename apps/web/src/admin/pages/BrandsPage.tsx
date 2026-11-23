import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrandDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { ImagePicker } from '../components/ImagePicker';

interface BrandForm {
  name: string;
  faName: string;
  iconUrl: string;
  sortOrder: number;
}

const EMPTY_FORM: BrandForm = { name: '', faName: '', iconUrl: '', sortOrder: 0 };

/** Same rule as the API's taxonomyKey: case, spaces, dashes and ي/ك do not count. */
function brandKey(name: string): string {
  return name.normalize('NFKC').toLowerCase()
    .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\s\u200c\u200d_.-]+/g, '');
}

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

  const [mergeFrom, setMergeFrom] = useState<BrandDTO | null>(null);
  const [mergeInto, setMergeInto] = useState<number | ''>('');
  const merge = useMutation({
    mutationFn: ({ id, intoId }: { id: number; intoId: number }) =>
      api.post<{ message: string }>(`/admin/brands/${id}/merge`, { intoId }),
    onSuccess: (data) => {
      toast.ok(data.message);
      setMergeFrom(null);
      setMergeInto('');
      setLocalBrands([]);
      void qc.invalidateQueries({ queryKey: ['admin', 'brands'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'taxonomy'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [localBrands, setLocalBrands] = useState<BrandDTO[]>([]);

  const brands = query.data?.brands ?? [];

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return localBrands.length > 0 ? localBrands : brands;
    return brands.filter((brand) => `${brand.faName} ${brand.name}`.toLowerCase().includes(needle));
  }, [brands, localBrands, search]);

  useMemo(() => {
    if (brands.length > 0 && localBrands.length === 0) {
      setLocalBrands(brands);
    }
  }, [brands]);

  // Brands whose names differ only in case, spacing or Arabic letter forms.
  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, BrandDTO[]>();
    for (const brand of brands) {
      for (const key of new Set([brandKey(brand.name), brandKey(brand.faName)].filter(Boolean))) {
        const list = groups.get(key) ?? [];
        if (!list.includes(brand)) list.push(brand);
        groups.set(key, list);
      }
    }
    const seen = new Set<string>();
    return [...groups.values()].filter((list) => {
      if (list.length < 2) return false;
      const id = list.map((brand) => brand.id).sort((a, b) => a - b).join(',');
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [brands]);

  const reorder = useMutation({
    mutationFn: (ids: number[]) => api.post('/admin/brands/reorder', { ids }),
    onSuccess: () => {
      toast.ok('ترتیب جدید برندها ذخیره شد.');
      void qc.invalidateQueries({ queryKey: ['admin', 'brands'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'taxonomy'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const currentList = search.trim() ? filtered : (localBrands.length > 0 ? localBrands : brands);
    const next = [...currentList];
    const [moved] = next.splice(draggedIndex, 1);
    if (moved) {
      next.splice(dropIndex, 0, moved);
      setLocalBrands(next);
      reorder.mutate(next.map((b) => b.id));
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const edit = (brand: BrandDTO) => {
    setEditingId(brand.id);
    setForm({ name: brand.name, faName: brand.faName, iconUrl: brand.iconUrl ?? '', sortOrder: brand.sortOrder });
    setFormOpen(true);
  };

  const canSubmit = Boolean(form.name.trim() && form.faName.trim());

  return (
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">مدیریت برندها</h2>
          <p className="a-subtitle">جابجایی ترتیب نمایش برندها با کلیک و درگ (Drag & Drop)</p>
        </div>
        <div className="a-page-actions">
          <button type="button" className="a-btn a-btn--primary" onClick={openCreate}>+ افزودن برند</button>
          <span className="a-badge a-badge--brand">{formatNumber(brands.length)} برند</span>
        </div>
      </section>

      <Modal
        open={formOpen}
        title={
          <>
            {editingId === null ? 'افزودن برند جدید' : 'ویرایش برند'}
            {editingId !== null && <span className="a-badge a-badge--neutral">#{editingId}</span>}
          </>
        }
        onClose={resetForm}
        wide
        busy={save.isPending}
        footer={
          <>
            <button type="button" className="a-btn a-btn--ghost" onClick={resetForm} disabled={save.isPending}>انصراف</button>
            <button type="submit" form="brand-form" className="a-btn a-btn--primary" disabled={save.isPending}>
              {save.isPending ? 'در حال ذخیره…' : editingId === null ? 'ثبت برند' : 'ذخیره تغییرات'}
            </button>
          </>
        }
      >
        <form
          id="brand-form"
          className="a-form a-form--standard a-fade"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) {
              toast.error('نام فارسی و انگلیسی را وارد کنید.');
              return;
            }
            save.mutate();
          }}
        >
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
            </div>
          </section>

          <section className="a-card">
            <div className="a-card-head">
              <h3 className="a-card-title">لوگو برند</h3>
            </div>
            <p className="a-card-sub">تصویر یا آیکن لوگو؛ از گالری قبلی یا آدرس مستقیم.</p>
            <ImagePicker label="لوگو / تصویر برند" value={form.iconUrl} kind="brand" onChange={(iconUrl) => setForm({ ...form, iconUrl })} />
          </section>
        </form>
      </Modal>

      <Modal
        open={mergeFrom !== null}
        title={<>ادغام برند «{mergeFrom?.faName}»</>}
        onClose={() => { setMergeFrom(null); setMergeInto(''); }}
        busy={merge.isPending}
        footer={
          <>
            <button type="button" className="a-btn a-btn--ghost" onClick={() => { setMergeFrom(null); setMergeInto(''); }} disabled={merge.isPending}>انصراف</button>
            <button
              type="button"
              className="a-btn a-btn--primary"
              disabled={merge.isPending || mergeInto === '' || !mergeFrom}
              onClick={() => mergeFrom && mergeInto !== '' && merge.mutate({ id: mergeFrom.id, intoId: mergeInto })}
            >
              {merge.isPending ? 'در حال ادغام…' : 'ادغام'}
            </button>
          </>
        }
      >
        <p className="a-card-sub">
          {formatNumber(mergeFrom?.productCount ?? 0)} محصول و دسته‌بندی‌های «{mergeFrom?.faName} / {mergeFrom?.name}» به برند انتخابی منتقل
          می‌شوند و این برند حذف می‌شود.
        </p>
        <label className="a-field mt-3">
          <span className="a-label">برند درست</span>
          <select className="a-input" value={mergeInto} onChange={(e) => setMergeInto(e.target.value ? Number(e.target.value) : '')}>
            <option value="">انتخاب کنید…</option>
            {brands.filter((brand) => brand.id !== mergeFrom?.id).map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.faName} / {brand.name} ({formatNumber(brand.productCount ?? 0)} محصول)
              </option>
            ))}
          </select>
        </label>
      </Modal>

      {duplicateGroups.length > 0 && (
        <section className="a-alert mt-2" role="status">
          <strong>برندهای احتمالاً تکراری:</strong>
          {duplicateGroups.map((group) => {
            const keep = [...group].sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0))[0]!;
            return (
              <div key={group.map((brand) => brand.id).join('-')} className="flex flex-wrap items-center gap-2 mt-2">
                <span>{group.map((brand) => `${brand.faName} / ${brand.name} (${formatNumber(brand.productCount ?? 0)})`).join('  ،  ')}</span>
                {group.filter((brand) => brand.id !== keep.id).map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    className="a-btn a-btn--secondary a-btn--xs"
                    onClick={() => { setMergeFrom(brand); setMergeInto(keep.id); }}
                  >
                    ادغام «{brand.name}» در «{keep.name}»
                  </button>
                ))}
              </div>
            );
          })}
        </section>
      )}

      {/* List */}
      <section className="a-searchbar">
        <input className="a-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجوی برند…" />
      </section>

      <section className="a-card a-container-md">
        <div className="a-card-head">
          <div>
            <h3 className="a-card-title">فهرست برندها</h3>
            <p className="a-card-sub">برای جابجایی ترتیب نمایش، آیکون ۶ نقطه سمت راست را بکشید و رها کنید.</p>
          </div>
        </div>

        <div className="a-list">
          {filtered.map((brand, index) => (
            <article
              key={brand.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
              className={`a-list-item${editingId === brand.id ? ' a-list-item--active' : ''}${draggedIndex === index ? ' is-dragging' : ''}${dragOverIndex === index ? ' is-drag-over' : ''}`}
            >
              <div className="a-drag-handle" title="برای جابجایی بکشید">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="5" cy="3" r="1.5" />
                  <circle cx="11" cy="3" r="1.5" />
                  <circle cx="5" cy="8" r="1.5" />
                  <circle cx="11" cy="8" r="1.5" />
                  <circle cx="5" cy="13" r="1.5" />
                  <circle cx="11" cy="13" r="1.5" />
                </svg>
              </div>
              <div className="a-list-icon">
                {brand.iconUrl ? <img src={brand.iconUrl.startsWith('/') || brand.iconUrl.startsWith('http') ? brand.iconUrl : `/assets/brand/${brand.iconUrl}`} alt="" /> : <span>{brand.faName.slice(0, 1)}</span>}
              </div>
              <div className="a-list-copy">
                <strong>{brand.faName}</strong>
                <span className="a-ltr">{brand.name}</span>
                <small>{formatNumber(brand.productCount ?? 0)} محصول</small>
              </div>
              <div className="a-list-actions">
                <button type="button" className="a-btn a-btn--secondary a-btn--xs" onClick={() => edit(brand)}>ویرایش</button>
                <button type="button" className="a-btn a-btn--secondary a-btn--xs" onClick={() => { setMergeFrom(brand); setMergeInto(''); }}>ادغام</button>
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
