import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrandDTO, CategoryDTO, ProductDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { useDebounced } from '../../storefront/hooks';
import { ProductEditor, type ProductForm } from '../components/ProductEditor';
import { VariantsEditor } from '../components/VariantsEditor';
import { AnimatedDropdown } from '../components/AnimatedDropdown';
import '../productsPortal.css';

interface ProductsResponse {
  items: ProductDTO[];
  total: number;
  page: number;
  perPage: number;
}

type BulkAction = 'activate' | 'deactivate' | 'delete' | 'promote' | 'demote' | 'setStock' | 'adjustPrice';

function Chevron() {
  return (
    <svg className="pp-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="pp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0" />
    </svg>
  );
}

function Dots() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

interface Opt<T extends string> {
  value: T;
  label: string;
  dot?: string;
}



const STATUS_OPTIONS = [
  { value: 'all', label: <span className="flex items-center gap-2"><span className="pp-dot pp-dot--gray" />همه</span> },
  { value: 'active', label: <span className="flex items-center gap-2"><span className="pp-dot pp-dot--green" />فعال</span> },
  { value: 'inactive', label: <span className="flex items-center gap-2"><span className="pp-dot pp-dot--red" />غیرفعال</span> },
];

const STOCK_OPTIONS = [
  { value: 'all', label: 'همه موجودی‌ها' },
  { value: 'in', label: 'موجود در انبار' },
  { value: 'out', label: 'تمام شده' },
];

const SORT_OPTIONS = [
  { value: 'updated', label: 'آخرین تغییرات' },
  { value: 'title', label: 'عنوان کالا' },
  { value: 'price_asc', label: 'ارزان‌ترین' },
  { value: 'price_desc', label: 'گران‌ترین' },
  { value: 'stock', label: 'کم‌موجودترین' },
];

export function ProductsPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [stock, setStock] = useState<'all' | 'in' | 'out'>('all');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [brandId, setBrandId] = useState<number | ''>('');
  const [sort, setSort] = useState('updated');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<ProductDTO | 'new' | null>(null);
  const [bulkPrompt, setBulkPrompt] = useState<'setStock' | 'adjustPrice' | null>(null);
  const [bulkValue, setBulkValue] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [variantsProduct, setVariantsProduct] = useState<ProductDTO | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<number | null>(null);

  const debounced = useDebounced(search);

  const taxonomy = useQuery({
    queryKey: ['admin', 'taxonomy'],
    queryFn: () => api.get<{ categories: CategoryDTO[]; brands: BrandDTO[] }>('/admin/taxonomy'),
    staleTime: 5 * 60_000,
  });

  const query = useMemo(
    () => ({ q: debounced, status, stock, categoryId: categoryId || undefined, brandId: brandId || undefined, sort, page, perPage: 24, parentOnly: true }),
    [debounced, status, stock, categoryId, brandId, sort, page],
  );

  const products = useQuery({
    queryKey: ['admin', 'products', query],
    queryFn: () => api.get<ProductsResponse>('/admin/products', query),
    placeholderData: (prev) => prev,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'products'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
  };

  const save = useMutation({
    mutationFn: async ({ id, body }: { id: number | null; body: ProductForm }) =>
      id == null ? api.post('/admin/products', body) : api.patch(`/admin/products/${id}`, body),
    onSuccess: () => {
      toast.ok('محصول با موفقیت ذخیره شد.');
      setEditing(null);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/admin/products/${id}`),
    onSuccess: () => {
      toast.ok('محصول حذف شد.');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulk = useMutation({
    mutationFn: (body: { ids: number[]; action: BulkAction; stock?: number; percent?: number }) =>
      api.post<{ changed: number; message: string }>('/admin/products/bulk', body),
    onSuccess: (res) => {
      toast.ok(res.message ?? `${res.changed} مورد به‌روزرسانی شد.`);
      setSelected(new Set());
      setBulkPrompt(null);
      setBulkValue('');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = products.data?.items ?? [];
  const total = products.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 24));
  const allOnPageSelected = items.length > 0 && items.every((p) => selected.has(p.id));
  const categoryOptions = taxonomy.data?.categories ?? [];
  const brandOptions = taxonomy.data?.brands ?? [];
  const activeFilterCount = (stock !== 'all' ? 1 : 0) + (categoryId !== '' ? 1 : 0) + (brandId !== '' ? 1 : 0);

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function toggleAll(checked: boolean) {
    const next = new Set(selected);
    for (const p of items) {
      if (checked) next.add(p.id);
      else next.delete(p.id);
    }
    setSelected(next);
  }

  function runBulk(action: BulkAction) {
    setBulkMenuOpen(false);
    if (selected.size === 0) return;
    if (action === 'setStock' || action === 'adjustPrice') {
      setBulkPrompt(action);
      return;
    }
    if (action === 'delete' && !confirm(`${formatNumber(selected.size)} محصول حذف شود؟`)) return;
    bulk.mutate({ ids: [...selected], action });
  }

  function confirmBulkValue() {
    const n = Number(bulkValue);
    if (!Number.isFinite(n)) {
      toast.error('عدد معتبر وارد کنید.');
      return;
    }
    if (bulkPrompt === 'setStock') bulk.mutate({ ids: [...selected], action: 'setStock', stock: Math.max(0, Math.trunc(n)) });
    else bulk.mutate({ ids: [...selected], action: 'adjustPrice', percent: n });
  }

  function rowActions(p: ProductDTO): Array<{ label: string; danger?: boolean; run: () => void }> {
    return [
      { label: 'ویرایش', run: () => setEditing(p) },
      { label: 'مدیریت واریانت‌ها', run: () => setVariantsProduct(p) },
      {
        label: p.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی',
        run: () => bulk.mutate({ ids: [p.id], action: p.status === 'active' ? 'deactivate' : 'activate' }),
      },
      { label: 'حذف', danger: true, run: () => { if (confirm(`«${p.title}» حذف شود؟`)) remove.mutate(p.id); } },
    ];
  }

  if (editing) {
    return (
      <ProductEditor
        product={editing === 'new' ? null : editing}
        categories={categoryOptions}
        brands={brandOptions}
        busy={save.isPending}
        onClose={() => setEditing(null)}
        onSave={(body) => save.mutate({ id: editing === 'new' ? null : editing.id, body })}
        onManageVariants={(p) => { setEditing(null); setVariantsProduct(p); }}
      />
    );
  }

  return (
    <div className="pp-root pp-fade">
      <header className="pp-head">
        <div>
          <h1 className="pp-head-title">محصولات</h1>
          <p className="pp-head-sub">مدیریت و ویرایش محصولات فروشگاه</p>
        </div>
        <div className="pp-head-actions">
          <div className="pp-seg-group" role="group" aria-label="حالت نمایش">
            <button
              type="button"
              className={`pp-seg${viewMode === 'grid' ? ' pp-seg--on' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              کارت‌ها
            </button>
            <button
              type="button"
              className={`pp-seg${viewMode === 'table' ? ' pp-seg--on' : ''}`}
              onClick={() => setViewMode('table')}
            >
              جدول
            </button>
          </div>
        </div>
      </header>

      <section className="pp-searchbar">
        <div className="pp-search">
          <SearchIcon />
          <input
            className="pp-input"
            placeholder="جستجو در عنوان، کد کالا یا SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </section>

      <section className="pp-toolbar">
        <div className="pp-select">
          <button
            type="button"
            className="pp-btn pp-btn--secondary"
            disabled={selected.size === 0}
            aria-expanded={bulkMenuOpen}
            onClick={() => setBulkMenuOpen((o) => !o)}
          >
            عملیات
            {selected.size > 0 && <span className="pp-count">{formatNumber(selected.size)}</span>}
            <Chevron />
          </button>
          {bulkMenuOpen && (
            <>
              <div className="pp-scrim" onClick={() => setBulkMenuOpen(false)} />
              <div className="pp-pop" style={{ minWidth: 220 }}>
                <button type="button" className="pp-pop-item" onClick={() => runBulk('activate')}>
                  فعال‌سازی
                </button>
                <button type="button" className="pp-pop-item" onClick={() => runBulk('deactivate')}>
                  غیرفعال‌سازی
                </button>
                <button type="button" className="pp-pop-item" onClick={() => runBulk('promote')}>
                  نمایش در پیشنهاد ویژه
                </button>
                <button type="button" className="pp-pop-item" onClick={() => runBulk('demote')}>
                  حذف از پیشنهاد ویژه
                </button>
                <button type="button" className="pp-pop-item" onClick={() => runBulk('setStock')}>
                  تنظیم موجودی…
                </button>
                <button type="button" className="pp-pop-item" onClick={() => runBulk('adjustPrice')}>
                  تغییر قیمت (درصدی)…
                </button>
                <button type="button" className="pp-pop-item pp-pop-item--danger" onClick={() => runBulk('delete')}>
                  حذف محصولات
                </button>
              </div>
            </>
          )}
        </div>

        <AnimatedDropdown
          buttonClassName="w-40 h-[38px]"
          value={status}
          onChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
          }}
          options={STATUS_OPTIONS}
          prefix="وضعیت:"
        />

        <div className="pp-select">
          <button
            type="button"
            className="pp-btn pp-btn--secondary"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            فیلترها
            {activeFilterCount > 0 && <span className="pp-count">{formatNumber(activeFilterCount)}</span>}
            <Chevron />
          </button>
          {filtersOpen && (
            <>
              <div className="pp-scrim" onClick={() => setFiltersOpen(false)} />
              <div className="pp-filter-panel">
                <div className="pp-field">
                  <label>موجودی</label>
                  <AnimatedDropdown
                    value={stock}
                    onChange={(v) => {
                      setStock(v as typeof stock);
                      setPage(1);
                    }}
                    options={STOCK_OPTIONS}
                  />
                </div>
                <div className="pp-field">
                  <label>دسته‌بندی</label>
                  <AnimatedDropdown
                    value={categoryId ? String(categoryId) : ''}
                    onChange={(v) => {
                      setCategoryId(v ? Number(v) : '');
                      setPage(1);
                    }}
                    placeholder="همه دسته‌بندی‌ها"
                    options={[
                      { value: '', label: 'همه دسته‌بندی‌ها' },
                      ...categoryOptions.map(c => ({ value: String(c.id), label: c.faName }))
                    ]}
                  />
                </div>
                <div className="pp-field">
                  <label>برند</label>
                  <AnimatedDropdown
                    value={brandId ? String(brandId) : ''}
                    onChange={(v) => {
                      setBrandId(v ? Number(v) : '');
                      setPage(1);
                    }}
                    placeholder="همه برندها"
                    options={[
                      { value: '', label: 'همه برندها' },
                      ...brandOptions.map(b => ({ value: String(b.id), label: b.faName }))
                    ]}
                  />
                </div>
                <div className="pp-field">
                  <label>مرتب‌سازی</label>
                  <AnimatedDropdown value={sort} onChange={setSort} options={SORT_OPTIONS} />
                </div>
                <button type="button" className="pp-btn pp-btn--secondary pp-btn--sm" onClick={() => setFiltersOpen(false)}>
                  بستن
                </button>
              </div>
            </>
          )}
        </div>

        <button type="button" className="pp-btn pp-btn--primary" onClick={() => setEditing('new')}>
          + ایجاد محصول
        </button>
      </section>

      {selected.size > 0 && (
        <div className="pp-bulkbar">
          <span>{formatNumber(selected.size)} محصول انتخاب شده است.</span>
          <button type="button" onClick={() => setSelected(new Set())}>
            لغو انتخاب
          </button>
        </div>
      )}

      <section className="pp-card">
        {products.isLoading ? (
          <div className="pp-state">
            <div className="pp-state-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg></div>
            <div className="pp-state-title">در حال دریافت محصولات...</div>
          </div>
        ) : products.isError ? (
          <div className="pp-state">
            <div className="pp-state-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg></div>
            <div className="pp-state-title">خطا در دریافت لیست محصولات</div>
            <div className="pp-state-sub">{products.error?.message ?? 'دوباره تلاش کنید.'}</div>
            <button type="button" className="pp-btn pp-btn--secondary pp-btn--sm" onClick={() => void products.refetch()}>
              تلاش مجدد
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="pp-state">
            <div className="pp-state-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg></div>
            <div className="pp-state-title">محصولی یافت نشد</div>
            <div className="pp-state-sub">هیچ محصولی با مشخصات جستجو‌یافته پیدا نشد.</div>
            <button type="button" className="pp-btn pp-btn--primary pp-btn--sm" onClick={() => setEditing('new')}>
              + ایجاد محصول
            </button>
          </div>
        ) : viewMode === 'table' ? (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead>
                <tr>
                  <th className="pp-th pp-col-num">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        className="pp-check"
                        checked={allOnPageSelected}
                        onChange={(e) => toggleAll(e.target.checked)}
                      />
                      <span>#</span>
                    </div>
                  </th>
                  <th className="pp-th">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>
                      <span>عنوان</span>
                    </div>
                  </th>
                  <th className="pp-th">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      <span>قیمت (تومان)</span>
                    </div>
                  </th>
                  <th className="pp-th">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125 2.25 2.25m0 0 2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>
                      <span>موجودی (عدد)</span>
                    </div>
                  </th>
                  <th className="pp-th">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
                      <span>وضعیت</span>
                    </div>
                  </th>
                  <th className="pp-th">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                      <span>تاریخ ایجاد</span>
                    </div>
                  </th>
                  <th className="pp-th pp-col-actions">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="pp-tbody">
                {items.map((p, i) => {
                  const totalStock = p.kermanStock + p.tehranStock > 0 ? p.kermanStock + p.tehranStock : p.stock;
                  const created = p.createdAt ? new Date(p.createdAt).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
                  return (
                    <tr key={p.id} className="pp-tr">
                      <td className="pp-td pp-col-num">
                        <input
                          type="checkbox"
                          className="pp-check"
                          checked={selected.has(p.id)}
                          onChange={() => toggle(p.id)}
                        />
                      </td>
                      <td className="pp-td pp-cell-title">
                        <div className="pp-cell-title-row">
                          {p.promotion && <span className="pp-chip pp-chip--amber">ویژه</span>}
                          <span className="pp-title">{p.title}</span>
                        </div>
                        <div className="pp-meta">{p.productId}{p.sku ? ` • ${p.sku}` : ''}</div>
                      </td>
                      <td className="pp-td">
                        <div className="pp-price">{formatNumber(p.price)}</div>
                        {p.oldPrice && p.oldPrice > p.price && <div className="pp-oldprice">{formatNumber(p.oldPrice)}</div>}
                      </td>
                      <td className="pp-td">
                        {totalStock === 0 ? (
                          <span className="pp-text-off">ناموجود</span>
                        ) : (
                          <span className="pp-text-ok">{formatNumber(totalStock)}</span>
                        )}
                      </td>
                      <td className="pp-td">
                        <span className={`pp-chip ${p.status === 'active' ? 'pp-chip--green' : 'pp-chip--gray'}`}>
                          {p.status === 'active' ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="pp-td">{created}</td>
                      <td className="pp-td pp-col-actions">
                        <div className="pp-row-actions">
                          <button
                            type="button"
                            className="pp-icon-btn"
                            aria-label="عملیات"
                            onClick={() => setRowMenu(rowMenu === p.id ? null : p.id)}
                          >
                            <Dots />
                          </button>
                          {rowMenu === p.id && (
                            <>
                              <div className="pp-scrim" onClick={() => setRowMenu(null)} />
                              <div className="pp-row-menu">
                                {rowActions(p).map((a) => (
                                  <button
                                    key={a.label}
                                    type="button"
                                    className={`pp-pop-item${a.danger ? ' pp-pop-item--danger' : ''}`}
                                    onClick={() => {
                                      setRowMenu(null);
                                      a.run();
                                    }}
                                  >
                                    {a.label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="pp-grid">
            {items.map((p) => {
              const totalStock = p.kermanStock + p.tehranStock > 0 ? p.kermanStock + p.tehranStock : p.stock;
              return (
                <div key={p.id} className="pp-gcard">
                  <div className="pp-gimg">
                    <img
                      src={p.imageUrl || '/logo.png'}
                      alt={p.title}
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/logo.png';
                      }}
                    />
                    <input
                      type="checkbox"
                      className="pp-check pp-gcheck"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                    {p.promotion && <span className="pp-chip pp-chip--amber pp-gbadge">ویژه</span>}
                  </div>
                  <div className="pp-gbody">
                    <div className="pp-gcat">
                      {p.categoryFaName || p.categoryName || 'دسته‌بندی'}{p.color ? ` • ${p.color}` : ''}
                    </div>
                    <div className="pp-gtitle">{p.title}</div>
                    <div className="pp-gfoot">
                      <div>
                        <div className="pp-gprice">{formatNumber(p.price)}</div>
                        {p.oldPrice && p.oldPrice > p.price && <div className="pp-goldprice">{formatNumber(p.oldPrice)}</div>}
                      </div>
                      <div className="pp-actions-gap">
                        <button type="button" className="pp-icon-btn" title="ویرایش" onClick={() => setEditing(p)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="pp-icon-btn"
                          style={{ color: 'var(--pp-brand)' }}
                          title="مدیریت واریانت‌ها"
                          onClick={() => setVariantsProduct(p)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="pp-icon-btn"
                          style={{ color: 'var(--pp-danger-strong)' }}
                          title="حذف"
                          onClick={() => {
                            if (confirm(`«${p.title}» حذف شود؟`)) remove.mutate(p.id);
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className={`pp-chip ${totalStock === 0 ? 'pp-chip--red' : 'pp-chip--green'}`}>
                        {totalStock === 0 ? 'ناموجود' : `${formatNumber(totalStock)} عدد`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {items.length > 0 && (
          <div className="pp-pager">
            <span className="pp-pager-info">
              {formatNumber((page - 1) * 24 + 1)} تا {formatNumber(Math.min(page * 24, total))} از {formatNumber(total)} محصول
            </span>
            {pageCount > 1 && (
              <div className="pp-pager-actions">
                <button type="button" className="pp-btn pp-btn--secondary pp-btn--sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  صفحه قبلی
                </button>
                <span className="pp-pager-info">
                  صفحه {formatNumber(page)} از {formatNumber(pageCount)}
                </span>
                <button type="button" className="pp-btn pp-btn--secondary pp-btn--sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                  صفحه بعدی
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <Modal
        open={bulkPrompt !== null}
        title={bulkPrompt === 'setStock' ? 'تنظیم موجودی گروهی' : 'تغییر درصدی قیمت'}
        onClose={() => setBulkPrompt(null)}
        footer={
          <>
            <button
              type="button"
              className="a-btn a-btn--primary"
              onClick={confirmBulkValue}
              disabled={bulk.isPending}
            >
              اعمال روی {formatNumber(selected.size)} محصول
            </button>
            <button type="button" className="a-btn a-btn--secondary" onClick={() => setBulkPrompt(null)}>
              انصراف
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label htmlFor="bulk-value" className="a-label">
            {bulkPrompt === 'setStock' ? 'موجودی جدید (عدد کل موجودی)' : 'درصد تغییر — مثبت گران‌تر، منفی ارزان‌تر'}
          </label>
          <input
            id="bulk-value"
            className="a-input a-ltr"
            inputMode="numeric"
            placeholder={bulkPrompt === 'setStock' ? '10' : '-5'}
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      {variantsProduct && (
        <VariantsEditor
          product={variantsProduct}
          categories={categoryOptions}
          brands={brandOptions}
          onClose={() => setVariantsProduct(null)}
        />
      )}
    </div>
  );
}