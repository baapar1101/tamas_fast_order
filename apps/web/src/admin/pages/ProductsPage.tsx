import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BrandDTO, CategoryDTO, ProductDTO } from '@tamas/shared';
import { formatMoney, formatNumber } from '@tamas/shared';
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

  const debounced = useDebounced(search);

  const taxonomy = useQuery({
    queryKey: ['admin', 'taxonomy'],
    queryFn: () => api.get<{ categories: CategoryDTO[]; brands: BrandDTO[] }>('/admin/taxonomy'),
    staleTime: 5 * 60_000,
  });

  const query = useMemo(
    () => ({ q: debounced, status, stock, categoryId: categoryId || undefined, brandId: brandId || undefined, sort, page, perPage: 40 }),
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
      toast.ok('محصول ذخیره شد.');
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
  const pageCount = Math.max(1, Math.ceil(total / 40));
  const allOnPageSelected = items.length > 0 && items.every((p) => selected.has(p.id));

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
    <>
      <div className="admin-head">
        <h1>محصولات</h1>
        <span className="badge">{formatNumber(total)} مورد</span>
        <span className="spacer" />
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>
          + محصول جدید
        </button>
      </div>

      <div className="filters-bar">
        <input
          className="input grow"
          placeholder="جستجو در عنوان، کد کالا، SKU…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }}>
          <option value="all">همه وضعیت‌ها</option>
          <option value="active">فعال</option>
          <option value="inactive">غیرفعال</option>
        </select>
        <select className="select" style={{ width: 'auto' }} value={stock} onChange={(e) => { setStock(e.target.value as typeof stock); setPage(1); }}>
          <option value="all">همه موجودی‌ها</option>
          <option value="in">موجود</option>
          <option value="out">ناموجود</option>
        </select>
        <select className="select" style={{ width: 'auto' }} value={categoryId} onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}>
          <option value="">همه دسته‌ها</option>
          {(taxonomy.data?.categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.faName}
            </option>
          ))}
        </select>
        <select className="select" style={{ width: 'auto' }} value={brandId} onChange={(e) => { setBrandId(e.target.value ? Number(e.target.value) : ''); setPage(1); }}>
          <option value="">همه برندها</option>
          {(taxonomy.data?.brands ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.faName}
            </option>
          ))}
        </select>
        <select className="select" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="updated">آخرین تغییر</option>
          <option value="title">عنوان</option>
          <option value="price_asc">ارزان‌ترین</option>
          <option value="price_desc">گران‌ترین</option>
          <option value="stock">کم‌موجودترین</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <b>{formatNumber(selected.size)} مورد انتخاب شده</b>
          <button type="button" className="btn sm" onClick={() => runBulk('activate')}>فعال</button>
          <button type="button" className="btn sm" onClick={() => runBulk('deactivate')}>غیرفعال</button>
          <button type="button" className="btn sm" onClick={() => runBulk('promote')}>پیشنهاد ویژه</button>
          <button type="button" className="btn sm" onClick={() => runBulk('demote')}>حذف از ویژه</button>
          <button type="button" className="btn sm" onClick={() => runBulk('setStock')}>تنظیم موجودی</button>
          <button type="button" className="btn sm" onClick={() => runBulk('adjustPrice')}>تغییر درصدی قیمت</button>
          <button type="button" className="btn sm danger" onClick={() => runBulk('delete')}>حذف</button>
          <span className="spacer" />
          <button type="button" className="btn ghost sm" onClick={() => setSelected(new Set())}>لغو انتخاب</button>
        </div>
      )}

      {products.isLoading ? (
        <div className="skeleton" style={{ height: 380 }} />
      ) : products.isError ? (
        <div className="alert error">دریافت محصولات ناموفق بود.</div>
      ) : items.length === 0 ? (
        <div className="card empty">محصولی پیدا نشد.</div>
      ) : (
        <div className="table-wrap" style={{ opacity: products.isFetching ? 0.6 : 1 }}>
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 34 }}>
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
                    aria-label="انتخاب همه"
                  />
                </th>
                <th style={{ width: 54 }}>تصویر</th>
                <th>عنوان</th>
                <th>رنگ</th>
                <th>برند</th>
                <th>قیمت</th>
                <th>کرمان</th>
                <th>تهران</th>
                <th>کل</th>
                <th>وضعیت</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const totalStock = p.kermanStock + p.tehranStock > 0 ? p.kermanStock + p.tehranStock : p.stock;
                return (
                  <tr key={p.id}>
                    <td>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={p.title} />
                    </td>
                    <td>
                      <img
                        className="thumb-cell"
                        src={p.imageUrl || '/logo.png'}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/logo.png';
                        }}
                      />
                    </td>
                    <td className="wrap">
                      {p.promotion && <span className="badge warn" style={{ marginInlineEnd: 6 }}>ویژه</span>}
                      {p.title}
                      <div className="faint ltr" style={{ fontSize: 11 }}>{p.productId}</div>
                    </td>
                    <td>{p.color || '—'}</td>
                    <td>{p.brandFaName || p.brandName || '—'}</td>
                    <td>{formatMoney(p.price)}</td>
                    <td>{formatNumber(p.kermanStock)}</td>
                    <td>{formatNumber(p.tehranStock)}</td>
                    <td>
                      <span className={`badge ${totalStock > 0 ? 'success' : 'danger'}`}>{formatNumber(totalStock)}</span>
                    </td>
                    <td>
                      <span className={`badge ${p.status === 'active' ? 'success' : ''}`}>
                        {p.status === 'active' ? 'فعال' : 'غیرفعال'}
                      </span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <button type="button" className="btn sm" onClick={() => setEditing(p)}>ویرایش</button>
                        <button
                          type="button"
                          className="btn sm danger"
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
      )}

      {pageCount > 1 && (
        <div className="pager">
          <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</button>
          <span className="muted">صفحه {formatNumber(page)} از {formatNumber(pageCount)}</span>
          <button type="button" className="btn" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>بعدی</button>
        </div>
      )}

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

      <Modal
        open={bulkPrompt !== null}
        title={bulkPrompt === 'setStock' ? 'تنظیم موجودی گروهی' : 'تغییر درصدی قیمت'}
        onClose={() => setBulkPrompt(null)}
        footer={
          <>
            <button type="button" className="btn primary" style={{ flex: 1 }} onClick={confirmBulkValue} disabled={bulk.isPending}>
              اعمال روی {formatNumber(selected.size)} محصول
            </button>
            <button type="button" className="btn" onClick={() => setBulkPrompt(null)}>انصراف</button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="bulk-value">
            {bulkPrompt === 'setStock' ? 'موجودی جدید (ستون stock)' : 'درصد تغییر — مثبت گران‌تر، منفی ارزان‌تر'}
          </label>
          <input
            id="bulk-value"
            className="input ltr"
            inputMode="numeric"
            placeholder={bulkPrompt === 'setStock' ? '10' : '-5'}
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </>
  );
}
