import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrandDTO, CategoryDTO, ColorDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { ImagePicker } from '../components/ImagePicker';

type Tab = 'categories' | 'brands' | 'colors';

interface CategoryForm {
  name: string;
  faName: string;
  iconUrl: string;
  brandNames: string[];
  sortOrder: number;
}

interface BrandForm {
  name: string;
  faName: string;
  iconUrl: string;
  sortOrder: number;
}

interface ColorForm {
  code: string;
  name: string;
  faName: string;
}

export function TaxonomyPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('categories');
  const [editingCategory, setEditingCategory] = useState<CategoryDTO | 'new' | null>(null);
  const [editingBrand, setEditingBrand] = useState<BrandDTO | 'new' | null>(null);
  const [editingColor, setEditingColor] = useState<ColorDTO | 'new' | null>(null);

  const categories = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api.get<{ categories: CategoryDTO[] }>('/admin/categories'),
  });
  const brands = useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: () => api.get<{ brands: BrandDTO[] }>('/admin/brands'),
  });
  const colors = useQuery({
    queryKey: ['admin', 'colors'],
    queryFn: () => api.get<{ colors: ColorDTO[] }>('/admin/colors'),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'categories'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'brands'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'colors'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'taxonomy'] });
  };

  const mutate = (fn: () => Promise<unknown>, message: string) =>
    fn()
      .then(() => {
        toast.ok(message);
        refresh();
        setEditingCategory(null);
        setEditingBrand(null);
        setEditingColor(null);
      })
      .catch((err: Error) => toast.error(err.message));

  const removeMutation = useMutation({
    mutationFn: ({ kind, id }: { kind: Tab; id: number }) => api.del(`/admin/${kind}/${id}`),
    onSuccess: () => {
      toast.ok('حذف شد.');
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <div className="admin-head">
        <h1>دسته‌بندی، برند و رنگ</h1>
        <span className="spacer" />
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            if (tab === 'categories') setEditingCategory('new');
            else if (tab === 'brands') setEditingBrand('new');
            else setEditingColor('new');
          }}
        >
          + مورد جدید
        </button>
      </div>

      <div className="tabs">
        <button type="button" className={`tab${tab === 'categories' ? ' on' : ''}`} onClick={() => setTab('categories')}>
          دسته‌بندی‌ها ({formatNumber(categories.data?.categories.length ?? 0)})
        </button>
        <button type="button" className={`tab${tab === 'brands' ? ' on' : ''}`} onClick={() => setTab('brands')}>
          برندها ({formatNumber(brands.data?.brands.length ?? 0)})
        </button>
        <button type="button" className={`tab${tab === 'colors' ? ' on' : ''}`} onClick={() => setTab('colors')}>
          رنگ‌ها ({formatNumber(colors.data?.colors.length ?? 0)})
        </button>
      </div>

      {tab === 'categories' && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 54 }}>آیکن</th>
                <th>نام فارسی</th>
                <th>کلید انگلیسی</th>
                <th>برندهای مرتبط</th>
                <th>تعداد کالا</th>
                <th>ترتیب</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(categories.data?.categories ?? []).map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.iconUrl && (
                      <img
                        className="thumb-cell"
                        src={c.iconUrl.startsWith('http') || c.iconUrl.startsWith('/') ? c.iconUrl : `/assets/category/${c.iconUrl}`}
                        alt=""
                      />
                    )}
                  </td>
                  <td>{c.faName}</td>
                  <td className="ltr">{c.name}</td>
                  <td className="wrap">{c.brandNames.join('، ') || '—'}</td>
                  <td>{formatNumber(c.productCount ?? 0)}</td>
                  <td>{formatNumber(c.sortOrder)}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button type="button" className="btn sm" onClick={() => setEditingCategory(c)}>ویرایش</button>
                      <button
                        type="button"
                        className="btn sm danger"
                        onClick={() => {
                          if (confirm(`دسته «${c.faName}» حذف شود؟`)) removeMutation.mutate({ kind: 'categories', id: c.id });
                        }}
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

      {tab === 'brands' && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 54 }}>آیکن</th>
                <th>نام فارسی</th>
                <th>کلید انگلیسی</th>
                <th>تعداد کالا</th>
                <th>ترتیب</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(brands.data?.brands ?? []).map((b) => (
                <tr key={b.id}>
                  <td>
                    {b.iconUrl && (
                      <img
                        className="thumb-cell"
                        src={b.iconUrl.startsWith('http') || b.iconUrl.startsWith('/') ? b.iconUrl : `/assets/brand/${b.iconUrl}`}
                        alt=""
                      />
                    )}
                  </td>
                  <td>{b.faName}</td>
                  <td className="ltr">{b.name}</td>
                  <td>{formatNumber(b.productCount ?? 0)}</td>
                  <td>{formatNumber(b.sortOrder)}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button type="button" className="btn sm" onClick={() => setEditingBrand(b)}>ویرایش</button>
                      <button
                        type="button"
                        className="btn sm danger"
                        onClick={() => {
                          if (confirm(`برند «${b.faName}» حذف شود؟`)) removeMutation.mutate({ kind: 'brands', id: b.id });
                        }}
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

      {tab === 'colors' && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 44 }} />
                <th>کد رنگ</th>
                <th>نام فارسی</th>
                <th>نام انگلیسی</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(colors.data?.colors ?? []).map((c) => (
                <tr key={c.id}>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: c.code.startsWith('#') ? c.code : `#${c.code}`,
                        boxShadow: '0 0 0 1px var(--border-strong)',
                      }}
                    />
                  </td>
                  <td className="ltr">{c.code}</td>
                  <td>{c.faName || '—'}</td>
                  <td className="ltr">{c.name || '—'}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button type="button" className="btn sm" onClick={() => setEditingColor(c)}>ویرایش</button>
                      <button
                        type="button"
                        className="btn sm danger"
                        onClick={() => {
                          if (confirm('این رنگ حذف شود؟')) removeMutation.mutate({ kind: 'colors', id: c.id });
                        }}
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

      {editingCategory && (
        <CategoryDialog
          value={editingCategory === 'new' ? null : editingCategory}
          allBrands={brands.data?.brands ?? []}
          onClose={() => setEditingCategory(null)}
          onSave={(form) =>
            void mutate(
              () =>
                editingCategory === 'new'
                  ? api.post('/admin/categories', form)
                  : api.patch(`/admin/categories/${editingCategory.id}`, form),
              'دسته‌بندی ذخیره شد.',
            )
          }
        />
      )}

      {editingBrand && (
        <BrandDialog
          value={editingBrand === 'new' ? null : editingBrand}
          onClose={() => setEditingBrand(null)}
          onSave={(form) =>
            void mutate(
              () =>
                editingBrand === 'new' ? api.post('/admin/brands', form) : api.patch(`/admin/brands/${editingBrand.id}`, form),
              'برند ذخیره شد.',
            )
          }
        />
      )}

      {editingColor && (
        <ColorDialog
          value={editingColor === 'new' ? null : editingColor}
          onClose={() => setEditingColor(null)}
          onSave={(form) =>
            void mutate(
              () =>
                editingColor === 'new' ? api.post('/admin/colors', form) : api.patch(`/admin/colors/${editingColor.id}`, form),
              'رنگ ذخیره شد.',
            )
          }
        />
      )}
    </>
  );
}

function CategoryDialog({
  value,
  allBrands,
  onClose,
  onSave,
}: {
  value: CategoryDTO | null;
  allBrands: BrandDTO[];
  onClose: () => void;
  onSave: (form: CategoryForm) => void;
}) {
  const [form, setForm] = useState<CategoryForm>({
    name: value?.name ?? '',
    faName: value?.faName ?? '',
    iconUrl: value?.iconUrl ?? '',
    // Stored as English keys; the DTO carries Persian labels, so map back.
    brandNames: value
      ? allBrands.filter((b) => value.brandNames.includes(b.faName) || value.brandNames.includes(b.name)).map((b) => b.name)
      : [],
    sortOrder: value?.sortOrder ?? 0,
  });

  return (
    <Modal
      open
      wide
      title={value ? `ویرایش دسته: ${value.faName}` : 'دسته‌بندی جدید'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn primary" style={{ flex: 1 }} onClick={() => onSave(form)}>
            ذخیره
          </button>
          <button type="button" className="btn" onClick={onClose}>انصراف</button>
        </>
      }
    >
      <div className="stack">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="c-fa">نام فارسی *</label>
            <input id="c-fa" className="input" value={form.faName} onChange={(e) => setForm({ ...form, faName: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="c-en">کلید انگلیسی *</label>
            <input id="c-en" className="input ltr" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="c-sort">ترتیب</label>
            <input
              id="c-sort"
              className="input ltr"
              inputMode="numeric"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value.replace(/\D/g, '')) || 0 })}
            />
          </div>
        </div>

        <ImagePicker label="آیکن دسته" kind="category" value={form.iconUrl} onChange={(url) => setForm({ ...form, iconUrl: url })} />

        <div className="field">
          <label>برندهای این دسته</label>
          <div className="row wrap" style={{ gap: 6 }}>
            {allBrands.map((b) => {
              const on = form.brandNames.includes(b.name);
              return (
                <button
                  key={b.id}
                  type="button"
                  className={`chip${on ? ' on' : ''}`}
                  onClick={() =>
                    setForm({
                      ...form,
                      brandNames: on ? form.brandNames.filter((n) => n !== b.name) : [...form.brandNames, b.name],
                    })
                  }
                >
                  {b.faName}
                </button>
              );
            })}
          </div>
          <span className="faint" style={{ fontSize: 11 }}>
            در فروشگاه، انتخاب این دسته نوار برندها را به همین موارد محدود می‌کند.
          </span>
        </div>
      </div>
    </Modal>
  );
}

function BrandDialog({
  value,
  onClose,
  onSave,
}: {
  value: BrandDTO | null;
  onClose: () => void;
  onSave: (form: BrandForm) => void;
}) {
  const [form, setForm] = useState<BrandForm>({
    name: value?.name ?? '',
    faName: value?.faName ?? '',
    iconUrl: value?.iconUrl ?? '',
    sortOrder: value?.sortOrder ?? 0,
  });

  return (
    <Modal
      open
      title={value ? `ویرایش برند: ${value.faName}` : 'برند جدید'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn primary" style={{ flex: 1 }} onClick={() => onSave(form)}>ذخیره</button>
          <button type="button" className="btn" onClick={onClose}>انصراف</button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <label htmlFor="b-fa">نام فارسی *</label>
          <input id="b-fa" className="input" value={form.faName} onChange={(e) => setForm({ ...form, faName: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="b-en">کلید انگلیسی *</label>
          <input id="b-en" className="input ltr" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="b-sort">ترتیب</label>
          <input
            id="b-sort"
            className="input ltr"
            inputMode="numeric"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value.replace(/\D/g, '')) || 0 })}
          />
        </div>
        <ImagePicker label="لوگوی برند" kind="brand" value={form.iconUrl} onChange={(url) => setForm({ ...form, iconUrl: url })} />
      </div>
    </Modal>
  );
}

function ColorDialog({
  value,
  onClose,
  onSave,
}: {
  value: ColorDTO | null;
  onClose: () => void;
  onSave: (form: ColorForm) => void;
}) {
  const [form, setForm] = useState<ColorForm>({
    code: value?.code ?? '#',
    name: value?.name ?? '',
    faName: value?.faName ?? '',
  });

  const hex = /^#[0-9a-f]{6}$/i.test(form.code) ? form.code : '#00768f';

  return (
    <Modal
      open
      title={value ? 'ویرایش رنگ' : 'رنگ جدید'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn primary" style={{ flex: 1 }} onClick={() => onSave(form)}>ذخیره</button>
          <button type="button" className="btn" onClick={onClose}>انصراف</button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <label htmlFor="col-code">کد رنگ *</label>
          <div className="row">
            <input id="col-code" className="input ltr" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input
              type="color"
              value={hex}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              style={{ width: 44, height: 36, padding: 2, border: '1px solid var(--border-strong)', borderRadius: 8 }}
              aria-label="انتخاب رنگ"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="col-fa">نام فارسی</label>
          <input id="col-fa" className="input" value={form.faName} onChange={(e) => setForm({ ...form, faName: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="col-en">نام انگلیسی</label>
          <input id="col-en" className="input ltr" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}
