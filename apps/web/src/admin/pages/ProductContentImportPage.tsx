import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

interface ImportableProduct {
  id: number;
  productId: string;
  title: string;
  imageCount: number;
  attributeCount: number;
  rating: number | null;
  ratingCount: number;
  externalDataUpdatedAt: string | null;
}

interface ImportResult {
  id: number;
  productId: string;
  title: string;
  imageCount: number;
  attributeCount: number;
  rating: number | null;
  updatedAt: string;
}

interface BatchResponse {
  ok: boolean;
  results: ImportResult[];
  errors: Array<{ id: number; error: string }>;
  message: string;
}

export function ProductContentImportPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const products = useQuery({
    queryKey: ['admin', 'product-content-import'],
    queryFn: () => api.get<{ items: ImportableProduct[] }>('/admin/product-content-import/products'),
  });

  const items = products.data?.items ?? [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fa');
    if (!needle) return items;
    return items.filter((item) => `${item.title} ${item.productId}`.toLocaleLowerCase('fa').includes(needle));
  }, [items, query]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'product-content-import'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
    ]);
  };

  const singleImport = useMutation({
    mutationFn: (id: number) => api.post<{ ok: true; result: ImportResult; message: string }>(`/admin/product-content-import/${id}`),
    onSuccess: async (response) => {
      toast.ok(response.message);
      await refresh();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const batchImport = useMutation({
    mutationFn: async (ids: number[]) => {
      const aggregate: BatchResponse = { ok: true, results: [], errors: [], message: '' };
      for (let index = 0; index < ids.length; index += 20) {
        const response = await api.post<BatchResponse>('/admin/product-content-import', { ids: ids.slice(index, index + 20) });
        aggregate.results.push(...response.results);
        aggregate.errors.push(...response.errors);
      }
      aggregate.ok = aggregate.errors.length === 0;
      aggregate.message = `${aggregate.results.length} محصول به‌روزرسانی شد.`;
      return aggregate;
    },
    onSuccess: async (response) => {
      if (response.errors.length > 0) toast.error(`${response.results.length} موفق، ${response.errors.length} ناموفق`);
      else toast.ok(response.message);
      setSelected(new Set());
      await refresh();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const busy = singleImport.isPending || batchImport.isPending;
  const selectedIds = [...selected];

  return (
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">دریافت اطلاعات از دیجیکالا</h2>
          <p className="a-subtitle">دریافت تصاویر، مشخصات، توضیحات و امتیاز برای محصولاتی که لینک آن‌ها ثبت شده است</p>
        </div>
        <div className="a-page-actions">
          <button
            type="button"
            className="a-btn a-btn--secondary"
            disabled={busy || items.length === 0}
            onClick={() => batchImport.mutate(items.map((item) => item.id))}
          >
            {batchImport.isPending ? 'در حال دریافت…' : 'دریافت همه'}
          </button>
          <button
            type="button"
            className="a-btn a-btn--primary"
            disabled={busy || selectedIds.length === 0}
            onClick={() => batchImport.mutate(selectedIds)}
          >
            دریافت انتخاب‌شده‌ها ({formatNumber(selectedIds.length)})
          </button>
        </div>
      </section>

      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">محصولات دارای لینک</h3>
            <p className="a-card-desc">قیمت، موجودی، عنوان، فروشنده و نظرات در این عملیات تغییر نمی‌کنند.</p>
          </div>
          <span className="a-badge a-badge--info">{formatNumber(items.length)} محصول</span>
        </div>
        <div className="p-4 border-b glass-border">
          <input
            className="a-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجوی نام یا شناسه محصول…"
          />
        </div>

        {products.isLoading ? (
          <p className="a-empty">در حال دریافت فهرست محصولات…</p>
        ) : products.isError ? (
          <div className="a-empty">
            <p>دریافت فهرست محصولات ناموفق بود.</p>
            <button type="button" className="a-btn a-btn--secondary" onClick={() => void products.refetch()}>تلاش دوباره</button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="a-empty">محصولی با لینک ثبت‌شده پیدا نشد.</p>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="انتخاب همه"
                      checked={filtered.length > 0 && filtered.every((item) => selected.has(item.id))}
                      onChange={(event) => {
                        const next = new Set(selected);
                        for (const item of filtered) event.target.checked ? next.add(item.id) : next.delete(item.id);
                        setSelected(next);
                      }}
                    />
                  </th>
                  <th>محصول</th>
                  <th>تصاویر</th>
                  <th>ویژگی‌ها</th>
                  <th>امتیاز</th>
                  <th>آخرین دریافت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`انتخاب ${item.title}`}
                        checked={selected.has(item.id)}
                        onChange={(event) => {
                          const next = new Set(selected);
                          event.target.checked ? next.add(item.id) : next.delete(item.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td>
                      <strong>{item.title}</strong>
                      <small className="block a-ltr text-slate-500">{item.productId}</small>
                    </td>
                    <td>{formatNumber(item.imageCount)}</td>
                    <td>{formatNumber(item.attributeCount)}</td>
                    <td>{item.rating == null ? '—' : `${(item.rating / 100).toLocaleString('fa-IR', { maximumFractionDigits: 2 })} از ۵`}</td>
                    <td>{item.externalDataUpdatedAt ? new Date(item.externalDataUpdatedAt).toLocaleString('fa-IR') : 'دریافت نشده'}</td>
                    <td>
                      <button
                        type="button"
                        className="a-btn a-btn--secondary a-btn--sm"
                        disabled={busy}
                        onClick={() => singleImport.mutate(item.id)}
                      >
                        دریافت اطلاعات
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

