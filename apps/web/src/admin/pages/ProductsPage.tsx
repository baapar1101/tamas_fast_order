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

  const debounced = useDebounced(search);

  const taxonomy = useQuery({
    queryKey: ['admin', 'taxonomy'],
    queryFn: () => api.get<{ categories: CategoryDTO[]; brands: BrandDTO[] }>('/admin/taxonomy'),
    staleTime: 5 * 60_000,
  });

  const query = useMemo(
    () => ({ q: debounced, status, stock, categoryId: categoryId || undefined, brandId: brandId || undefined, sort, page, perPage: 24 }),
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

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <section className="flex flex-wrap items-center justify-between gap-4 animate-fade-up">
        <div>
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">مدیریت محصولات</h2>
          <p className="mt-1 text-xs text-slate-400">افزودن، ویرایش و مدیریت موجودی محصولات فروشگاه</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-white/[0.06] bg-[#131c2e]/60 p-1">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'grid' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-white'
              }`}
              onClick={() => setViewMode('grid')}
            >
              کارت‌ها (Grid)
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'table' ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-400 hover:text-white'
              }`}
              onClick={() => setViewMode('table')}
            >
              جدول (Table)
            </button>
          </div>
          <button type="button" className="huma-btn-primary" onClick={() => setEditing('new')}>
            + افزودن محصول جدید
          </button>
        </div>
      </section>

      {/* 4 Summary Stat Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">کل محصولات سیستم</span>
            <span className="chip chip-brand">{formatNumber(total)} مورد</span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-white">{formatNumber(total)}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">محصولات فعال</span>
            <span className="chip chip-brand">فعال</span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-emerald-400">{formatNumber(activeCount)}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">موجودی رو به اتمام</span>
            <span className="chip chip-amber">هشدار</span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-amber-400">{formatNumber(lowStockCount)}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">محصولات تمام‌شده</span>
            <span className="chip chip-rose">ناموجود</span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-rose-400">{formatNumber(outOfStockCount)}</p>
        </div>
      </section>

      {/* Filters Bar */}
      <section className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="huma-input flex-1 min-w-[200px]"
            placeholder="جستجو در عنوان، کد کالا، SKU..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="huma-input !w-auto"
            value={status}
            onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="active">فقط فعال</option>
            <option value="inactive">فقط غیرفعال</option>
          </select>
          <select
            className="huma-input !w-auto"
            value={stock}
            onChange={(e) => { setStock(e.target.value as typeof stock); setPage(1); }}
          >
            <option value="all">همه موجودی‌ها</option>
            <option value="in">موجود در انبار</option>
            <option value="out">تمام شده</option>
          </select>
          <select
            className="huma-input !w-auto"
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
            className="huma-input !w-auto"
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
          <select className="huma-input !w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
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
        <section className="glass-card bg-emerald-500/10 border-emerald-500/30 p-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-emerald-300">
            {formatNumber(selected.size)} محصول انتخاب شده:
          </span>
          <button type="button" className="huma-btn-secondary !py-1 !px-3 !text-xs" onClick={() => runBulk('activate')}>
            فعال‌سازی
          </button>
          <button type="button" className="huma-btn-secondary !py-1 !px-3 !text-xs" onClick={() => runBulk('deactivate')}>
            غیرفعال‌سازی
          </button>
          <button type="button" className="huma-btn-secondary !py-1 !px-3 !text-xs" onClick={() => runBulk('promote')}>
            پیشنهاد ویژه
          </button>
          <button type="button" className="huma-btn-secondary !py-1 !px-3 !text-xs" onClick={() => runBulk('setStock')}>
            تنظیم موجودی
          </button>
          <button type="button" className="huma-btn-secondary !py-1 !px-3 !text-xs" onClick={() => runBulk('adjustPrice')}>
            تغییر قیمت (درصدی)
          </button>
          <button
            type="button"
            className="huma-btn-secondary !bg-rose-500/15 !text-rose-300 !border-rose-500/30 !py-1 !px-3 !text-xs mr-auto"
            onClick={() => runBulk('delete')}
          >
            حذف محصولات
          </button>
          <button type="button" className="text-xs text-slate-400 underline hover:text-white" onClick={() => setSelected(new Set())}>
            لغو انتخاب
          </button>
        </section>
      )}

      {/* Main Products Rendering (Grid vs Table) */}
      {products.isLoading ? (
        <div className="glass-card p-12 text-center text-slate-400">در حال دریافت لیست محصولات...</div>
      ) : products.isError ? (
        <div className="glass-card p-8 text-center text-rose-400">خطا در دریافت لیست محصولات.</div>
      ) : items.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-500">هیچ محصولی با مشخصات جستجویافته پیدا نشد.</div>
      ) : viewMode === 'grid' ? (
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => {
            const totalStock = p.kermanStock + p.tehranStock > 0 ? p.kermanStock + p.tehranStock : p.stock;
            return (
              <div key={p.id} className="glass-card overflow-hidden flex flex-col group">
                <div className="relative h-44 w-full bg-[#131c2e]/60 flex items-center justify-center p-4">
                  <img
                    src={p.imageUrl || '/logo.png'}
                    alt={p.title}
                    className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
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
                      className="h-4 w-4 rounded accent-emerald-500 cursor-pointer"
                    />
                  </div>
                  {p.promotion && (
                    <span className="absolute top-3 left-3 chip chip-amber">ویژه</span>
                  )}
                  <span className={`absolute bottom-3 right-3 chip ${totalStock > 0 ? 'chip-brand' : 'chip-rose'}`}>
                    {totalStock > 0 ? `${formatNumber(totalStock)} عدد` : 'ناموجود'}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span>{p.categoryFaName || p.categoryName || 'دسته‌بندی'}</span>
                      <span>{p.brandFaName || p.brandName || ''}</span>
                    </div>
                    <h3 className="font-bold text-white text-sm line-clamp-2">{p.title}</h3>
                    {p.color && <p className="text-xs text-slate-400 mt-1">رنگ: {p.color}</p>}
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                    <div>
                      <p className="text-lg font-extrabold text-emerald-300">
                        <Price amount={p.price} />
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="icon-btn !h-8 !w-8"
                        onClick={() => setEditing(p)}
                        title="ویرایش"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="icon-btn !h-8 !w-8 text-rose-400 hover:border-rose-500/40"
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
        <section className="glass-card overflow-hidden">
          <div className="huma-table-container">
            <table className="huma-table">
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
                            className="huma-btn-secondary !py-1 !px-2.5 !text-xs"
                            onClick={() => setEditing(p)}
                          >
                            ویرایش
                          </button>
                          <button
                            type="button"
                            className="huma-btn-secondary !bg-rose-500/15 !text-rose-300 !border-rose-500/30 !py-1 !px-2.5 !text-xs"
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
        <section className="flex items-center justify-between glass-card p-4">
          <button
            type="button"
            className="huma-btn-secondary !py-1.5 !px-4"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            صفحه قبلی
          </button>
          <span className="text-xs text-slate-400 font-semibold">
            صفحه {formatNumber(page)} از {formatNumber(pageCount)}
          </span>
          <button
            type="button"
            className="huma-btn-secondary !py-1.5 !px-4"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
          >
            صفحه بعدی
          </button>
        </section>
      )}

      {/* Product Editor Modal */}
      {editing && (
        <ProductEditor
          product={editing === 'new' ? null : editing}
          categories={taxonomy.data?.categories ?? []}
          brands={taxonomy.data?.brands ?? []}
          busy={save.isPending}
          onClose={() => setEditing(null)}
          onSave={(body) => save.mutate({ id: editing === 'new' ? null : editing.id, body })}
        />
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
              className="huma-btn-primary"
              onClick={confirmBulkValue}
              disabled={bulk.isPending}
            >
              اعمال روی {formatNumber(selected.size)} محصول
            </button>
            <button type="button" className="huma-btn-secondary" onClick={() => setBulkPrompt(null)}>
              انصراف
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label htmlFor="bulk-value" className="block text-xs font-semibold text-slate-300">
            {bulkPrompt === 'setStock' ? 'موجودی جدید (عدد کل موجودی)' : 'درصد تغییر — مثبت گران‌تر، منفی ارزان‌تر'}
          </label>
          <input
            id="bulk-value"
            className="huma-input text-left"
            dir="ltr"
            inputMode="numeric"
            placeholder={bulkPrompt === 'setStock' ? '10' : '-5'}
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
