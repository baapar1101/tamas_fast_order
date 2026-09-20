import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrandDTO, CategoryDTO, ProductDTO } from '@tamas/shared';
import { formatMoney, formatNumber } from '@tamas/shared';
import { Price } from '../../components/Price';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { useDebounced } from '../../storefront/hooks';
import { ProductEditor, type ProductForm } from '../components/ProductEditor';
import { VariantsEditor } from '../components/VariantsEditor';

interface ProductsResponse {
  items: ProductDTO[];
  total: number;
  page: number;
  perPage: number;
}

type BulkAction = 'activate' | 'deactivate' | 'delete' | 'promote' | 'demote' | 'setStock' | 'adjustPrice';

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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [variantsProduct, setVariantsProduct] = useState<ProductDTO | null>(null);

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

  // Stat summary calculations
  const activeCount = items.filter((p) => p.status === 'active').length;
  const outOfStockCount = items.filter((p) => (p.kermanStock + p.tehranStock > 0 ? p.kermanStock + p.tehranStock : p.stock) === 0).length;
  const lowStockCount = items.filter((p) => {
    const s = p.kermanStock + p.tehranStock > 0 ? p.kermanStock + p.tehranStock : p.stock;
    return s > 0 && s <= 5;
  }).length;

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function runBulk(action: BulkAction) {
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

  if (editing) {
    return (
      <ProductEditor
        product={editing === 'new' ? null : editing}
        categories={taxonomy.data?.categories ?? []}
        brands={taxonomy.data?.brands ?? []}
        busy={save.isPending}
        onClose={() => setEditing(null)}
        onSave={(body) => save.mutate({ id: editing === 'new' ? null : editing.id, body })}
      />
    );
  }

  return (
    <div className="a-page a-page--products a-fade">
      {/* Header & Primary Actions */}
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">مدیریت محصولات</h2>
          <p className="a-subtitle">افزودن، ویرایش و مدیریت موجودی محصولات فروشگاه</p>
        </div>
        <div className="a-page-actions">
          <div className="a-segmented">
            <button
              type="button"
              className={`a-seg${viewMode === 'grid' ? ' a-seg--on' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              کارت‌ها (Grid)
            </button>
            <button
              type="button"
              className={`a-seg${viewMode === 'table' ? ' a-seg--on' : ''}`}
              onClick={() => setViewMode('table')}
            >
              جدول (Table)
            </button>
          </div>
          <button type="button" className="a-btn a-btn--primary" onClick={() => setEditing('new')}>
            + افزودن محصول جدید
          </button>
        </div>
      </section>

      {/* 4 Summary Stat Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="a-stat">
          <div className="a-stat-head">
            <span className="a-stat-label">کل محصولات سیستم</span>
            <span className="a-badge a-badge--brand">{formatNumber(total)} مورد</span>
          </div>
          <p className="a-stat-value">{formatNumber(total)}</p>
        </div>
        <div className="a-stat">
          <div className="a-stat-head">
            <span className="a-stat-label">محصولات فعال</span>
            <span className="a-badge a-badge--green">فعال</span>
          </div>
          <p className="a-stat-value a-stat-value--green">{formatNumber(activeCount)}</p>
        </div>
        <div className="a-stat">
          <div className="a-stat-head">
            <span className="a-stat-label">موجودی رو به اتمام</span>
            <span className="a-badge a-badge--amber">هشدار</span>
          </div>
          <p className="a-stat-value a-stat-value--amber">{formatNumber(lowStockCount)}</p>
        </div>
        <div className="a-stat">
          <div className="a-stat-head">
            <span className="a-stat-label">محصولات تمام‌شده</span>
            <span className="a-badge a-badge--red">ناموجود</span>
          </div>
          <p className="a-stat-value a-stat-value--red">{formatNumber(outOfStockCount)}</p>
        </div>
      </section>

      {/* Filters Bar */}
      <section className="a-card">
        <div className="a-filterbar">
          <input
            className="a-input a-grow"
            placeholder="جستجو در عنوان، کد کالا، SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="a-select a-select--auto"
            value={status}
            onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="active">فقط فعال</option>
            <option value="inactive">فقط غیرفعال</option>
          </select>
          <select
            className="a-select a-select--auto"
            value={stock}
            onChange={(e) => { setStock(e.target.value as typeof stock); setPage(1); }}
          >
            <option value="all">همه موجودی‌ها</option>
            <option value="in">موجود در انبار</option>
            <option value="out">تمام شده</option>
          </select>
          <select
            className="a-select a-select--auto"
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
          >
            <option value="">همه دسته‌بندی‌ها</option>
            {(taxonomy.data?.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.faName}
              </option>
            ))}
          </select>
          <select
            className="a-select a-select--auto"
            value={brandId}
            onChange={(e) => { setBrandId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}
          >
            <option value="">همه برندها</option>
            {(taxonomy.data?.brands ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.faName}
              </option>
            ))}
          </select>
          <select className="a-select a-select--auto" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="updated">آخرین تغییرات</option>
            <option value="title">عنوان کالا</option>
            <option value="price_asc">ارزان‌ترین</option>
            <option value="price_desc">گران‌ترین</option>
            <option value="stock">کم‌موجودترین</option>
          </select>
        </div>
      </section>

      {/* Bulk Operations Toolbar */}
      {selected.size > 0 && (
        <section className="a-bulkbar">
          <span className="a-bulkbar-label">{formatNumber(selected.size)} محصول انتخاب شده:</span>
          <button type="button" className="a-btn a-btn--secondary a-btn--sm" onClick={() => runBulk('activate')}>
            فعال‌سازی
          </button>
          <button type="button" className="a-btn a-btn--secondary a-btn--sm" onClick={() => runBulk('deactivate')}>
            غیرفعال‌سازی
          </button>
          <button type="button" className="a-btn a-btn--secondary a-btn--sm" onClick={() => runBulk('promote')}>
            پیشنهاد ویژه
          </button>
          <button type="button" className="a-btn a-btn--secondary a-btn--sm" onClick={() => runBulk('setStock')}>
            تنظیم موجودی
          </button>
          <button type="button" className="a-btn a-btn--secondary a-btn--sm" onClick={() => runBulk('adjustPrice')}>
            تغییر قیمت (درصدی)
          </button>
          <span className="a-bulkbar-spacer" />
          <button
            type="button"
            className="a-btn a-btn--danger a-btn--sm"
            onClick={() => runBulk('delete')}
          >
            حذف محصولات
          </button>
          <button type="button" className="a-bulkbar-link" onClick={() => setSelected(new Set())}>
            لغو انتخاب
          </button>
        </section>
      )}

      {/* Main Products Rendering (Grid vs Table) */}
      {products.isLoading ? (
        <div className="a-card"><div className="a-empty">در حال دریافت لیست محصولات...</div></div>
      ) : products.isError ? (
        <div className="a-card"><div className="a-empty">خطا در دریافت لیست محصولات.</div></div>
      ) : items.length === 0 ? (
        <div className="a-card"><div className="a-empty">هیچ محصولی با مشخصات جستجویافته پیدا نشد.</div></div>
      ) : viewMode === 'grid' ? (
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => {
            const totalStock = p.kermanStock + p.tehranStock > 0 ? p.kermanStock + p.tehranStock : p.stock;
            return (
              <div key={p.id} className="a-card a-card--flush group">
                <div className="a-thumb" style={{ height: '11rem' }}>
                  <img
                    src={p.imageUrl || '/logo.png'}
                    alt={p.title}
                    className="transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/logo.png';
                    }}
                  />
                  <div className="absolute top-3 right-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                      className="a-grid-check h-4 w-4 cursor-pointer"
                    />
                  </div>
                  {p.promotion && (
                    <span className="absolute top-3 left-3 a-badge a-badge--amber">ویژه</span>
                  )}
                </div>

                <div className="a-card-body">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span>{p.categoryFaName || p.categoryName || 'دسته‌بندی'}</span>
                      <span>{p.brandFaName || p.brandName || ''}</span>
                    </div>
                    <h3 className="font-bold text-sm text-white line-clamp-2">{p.title}</h3>
                    <div className="admin-product-stock-row">
                      <span className={`admin-product-stock chip ${totalStock > 0 ? 'chip-brand' : 'chip-rose'}`}>
                        <span className="admin-product-stock-dot" aria-hidden="true" />
                        {totalStock > 0 ? `موجودی: ${formatNumber(totalStock)} عدد` : 'ناموجود در انبار'}
                      </span>
                    </div>
                    {p.color && <p className="text-xs text-slate-400 mt-1">رنگ: {p.color}</p>}
                  </div>

                  <div className="a-divider" />
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-extrabold text-emerald-300">
                      <Price amount={p.price} />
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="a-icon-btn"
                        onClick={() => setEditing(p)}
                        title="ویرایش"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="a-icon-btn a-icon-btn--info"
                        onClick={() => setVariantsProduct(p)}
                        title="مدیریت واریانت‌ها"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="a-icon-btn a-icon-btn--danger"
                        onClick={() => {
                          if (confirm(`«${p.title}» حذف شود؟`)) remove.mutate(p.id);
                        }}
                        title="حذف"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="a-card a-card--flush">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={(e) => {
                        const next = new Set(selected);
                        for (const p of items) {
                          if (e.target.checked) next.add(p.id);
                          else next.delete(p.id);
                        }
                        setSelected(next);
                      }}
                    />
                  </th>
                  <th style={{ width: 56 }}>تصویر</th>
                  <th>عنوان محصول</th>
                  <th>برند / رنگ</th>
                  <th>قیمت</th>
                  <th>کرمان</th>
                  <th>تهران</th>
                  <th>کل موجودی</th>
                  <th>وضعیت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const totalStock = p.kermanStock + p.tehranStock > 0 ? p.kermanStock + p.tehranStock : p.stock;
                  return (
                    <tr key={p.id}>
                      <td>
                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                      </td>
                      <td>
                        <img
                          src={p.imageUrl || '/logo.png'}
                          alt=""
                          className="h-10 w-10 object-contain rounded-lg bg-[#131c2e] p-1 border border-white/10"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/logo.png';
                          }}
                        />
                      </td>
                      <td>
                        <div className="font-bold text-white">
                          {p.promotion && <span className="chip chip-amber ml-2">ویژه</span>}
                          {p.title}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono" dir="ltr">
                          {p.productId}
                        </div>
                      </td>
                      <td className="text-xs text-slate-400">
                        {p.brandFaName || p.brandName || '—'} / {p.color || '—'}
                      </td>
                      <td className="font-bold text-emerald-300"><Price amount={p.price} /></td>
                      <td className="text-xs">{formatNumber(p.kermanStock)}</td>
                      <td className="text-xs">{formatNumber(p.tehranStock)}</td>
                      <td>
                        <span className={`chip ${totalStock > 0 ? 'chip-brand' : 'chip-rose'}`}>
                          {formatNumber(totalStock)}
                        </span>
                      </td>
                      <td>
                        <span className={`chip ${p.status === 'active' ? 'chip-brand' : 'chip-slate'}`}>
                          {p.status === 'active' ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="a-btn a-btn--secondary a-btn--xs"
                            onClick={() => setEditing(p)}
                          >
                            ویرایش
                          </button>
                          <button
                            type="button"
                            className="a-btn a-btn--info a-btn--xs"
                            onClick={() => setVariantsProduct(p)}
                          >
                            واریانت‌ها
                          </button>
                          <button
                            type="button"
                            className="a-btn a-btn--danger a-btn--xs"
                            onClick={() => {
                              if (confirm(`«${p.title}» حذف شود؟`)) remove.mutate(p.id);
                            }}
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Pagination Controls */}
      {pageCount > 1 && (
        <section className="a-card a-pager">
          <button
            type="button"
            className="a-btn a-btn--secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            صفحه قبلی
          </button>
          <span className="a-pager-info">
            صفحه {formatNumber(page)} از {formatNumber(pageCount)}
          </span>
          <button
            type="button"
            className="a-btn a-btn--secondary"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
          >
            صفحه بعدی
          </button>
        </section>
      )}

      {/* Bulk Modal */}
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
          categories={taxonomy.data?.categories ?? []}
          brands={taxonomy.data?.brands ?? []}
          onClose={() => setVariantsProduct(null)}
        />
      )}
    </div>
  );
}