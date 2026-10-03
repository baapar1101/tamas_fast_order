import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProductDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

export function TargetSitesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'has_link' | 'no_link' | 'in_tehran' | 'out_tehran'>('has_link');
  const [editingUrl, setEditingUrl] = useState<Record<number, string>>({});
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState<Record<number, string>>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['adminTargetProducts', search, filter],
    queryFn: () =>
      api.get<{ items: ProductDTO[]; total: number }>('/admin/products', {
        q: search || undefined,
        perPage: 100,
      }),
  });

  const allItems = data?.items ?? [];

  // Filter items
  const filteredItems = allItems.filter((item) => {
    const hasLink = Boolean(item.targetSiteUrl && item.targetSiteUrl.trim().length > 0);
    if (filter === 'has_link') return hasLink;
    if (filter === 'no_link') return !hasLink;
    if (filter === 'in_tehran') return item.tehranStock > 0;
    if (filter === 'out_tehran') return item.tehranStock === 0;
    return true;
  });

  // Calculate statistics
  const totalCount = allItems.length;
  const withLinkCount = allItems.filter((i) => i.targetSiteUrl && i.targetSiteUrl.trim().length > 0).length;
  const totalTehranStock = allItems.reduce((acc, i) => acc + (i.tehranStock || 0), 0);
  const inStockTehranCount = allItems.filter((i) => i.tehranStock > 0).length;

  // Single target URL save mutation
  const saveUrlMutation = useMutation({
    mutationFn: async ({ id, targetSiteUrl }: { id: number; targetSiteUrl: string }) => {
      return api.patch<{ ok: boolean; product: ProductDTO }>(`/admin/products/${id}`, {
        targetSiteUrl: targetSiteUrl.trim() || null,
      });
    },
    onSuccess: (res, vars) => {
      toast.ok('لینک سایت هدف با موفقیت ذخیره شد');
      queryClient.invalidateQueries({ queryKey: ['adminTargetProducts'] });
      setEditingUrl((prev) => {
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
    },
    onError: (err: any) => {
      toast.error(err.message || 'خطا در ذخیره لینک سایت هدف');
    },
  });

  // Single product Tehran stock save mutation
  const saveStockMutation = useMutation({
    mutationFn: async ({ id, tehranStock }: { id: number; tehranStock: number }) => {
      return api.patch<{ ok: boolean; product: ProductDTO }>(`/admin/products/${id}`, {
        tehranStock,
      });
    },
    onSuccess: () => {
      toast.ok('موجودی انبار تهران به‌روزرسانی شد');
      queryClient.invalidateQueries({ queryKey: ['adminTargetProducts'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'خطا در ثبت موجودی انبار تهران');
    },
  });

  // Check & Sync Target Site Stock for one product
  const syncProductStock = async (id: number) => {
    setSyncingId(id);
    try {
      const res = await api.post<{ ok: boolean; product: ProductDTO; statusText: string; tehranStock: number }>(
        `/admin/products/${id}/sync-target-stock`,
        {},
      );
      if (res.ok) {
        toast.ok(`موجودی انبار تهران به ${res.tehranStock} تغییر یافت (${res.statusText})`);
        setSyncLog((prev) => ({ ...prev, [id]: res.statusText }));
        queryClient.invalidateQueries({ queryKey: ['adminTargetProducts'] });
      }
    } catch (err: any) {
      toast.error(err.message || 'خطا در استعلام سایت هدف');
      setSyncLog((prev) => ({ ...prev, [id]: err.message || 'خطا در ارتباط' }));
    } finally {
      setSyncingId(null);
    }
  };

  // Batch Sync All Products Target Sites
  const handleBatchSync = async () => {
    if (!confirm('آیا از استعلام همگانی و بروزرسانی موجودی انبار تهران برای تمام محصولات دارای لینک مطمئن هستید؟')) {
      return;
    }
    setBatchSyncing(true);
    try {
      const res = await api.post<{ ok: boolean; message: string; success: number; failed: number }>(
        '/admin/products/sync-target-stocks',
        {},
      );
      if (res.ok) {
        toast.ok(res.message || 'بروزرسانی همگانی انبار تهران با موفقیت انجام شد');
        queryClient.invalidateQueries({ queryKey: ['adminTargetProducts'] });
      }
    } catch (err: any) {
      toast.error(err.message || 'خطا در اجرای بروزرسانی همگانی');
    } finally {
      setBatchSyncing(false);
    }
  };

  return (
    <div className="a-page space-y-6">
      {/* Header Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--a-surface)] p-6 rounded-2xl border border-[var(--a-border)] shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-[var(--a-fg)] flex items-center gap-2">
            <span>🌐</span>
            <span>افزودن سایت هدف (انبار تهران)</span>
          </h1>
          <p className="text-sm text-[var(--a-muted)] mt-1">
            ثبت لینک محصولات در سایت‌های تامین‌کننده و استعلام هوشمند موجودی جهت تخصیص خودکار به انبار تهران
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={handleBatchSync}
            disabled={batchSyncing}
            className="a-btn a-btn--primary flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {batchSyncing ? (
              <span className="animate-spin text-lg">⌛</span>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span>{batchSyncing ? 'در حال بروزرسانی همگانی...' : 'بروزرسانی همگانی انبار تهران'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--a-surface)] p-5 rounded-2xl border border-[var(--a-border)] flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--a-muted)] font-medium">کل محصولات</div>
            <div className="text-2xl font-black text-[var(--a-fg)] mt-1">{formatNumber(totalCount)}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold">
            📦
          </div>
        </div>

        <div className="bg-[var(--a-surface)] p-5 rounded-2xl border border-[var(--a-border)] flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--a-muted)] font-medium">دارای لینک سایت هدف</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{formatNumber(withLinkCount)}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold">
            🔗
          </div>
        </div>

        <div className="bg-[var(--a-surface)] p-5 rounded-2xl border border-[var(--a-border)] flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--a-muted)] font-medium">موجودی انبار تهران</div>
            <div className="text-2xl font-black text-amber-600 mt-1">{formatNumber(totalTehranStock)}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold">
            🏢
          </div>
        </div>

        <div className="bg-[var(--a-surface)] p-5 rounded-2xl border border-[var(--a-border)] flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--a-muted)] font-medium">محصولات موجود در تهران</div>
            <div className="text-2xl font-black text-purple-600 mt-1">{formatNumber(inStockTehranCount)}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl font-bold">
            ✅
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-[var(--a-surface)] p-4 rounded-2xl border border-[var(--a-border)] flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-80">
          <input
            type="text"
            className="a-input"
            placeholder="جستجوی نام محصول، SKU یا شناسه..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {[
            { key: 'has_link', label: 'دارای لینک هدف' },
            { key: 'no_link', label: 'بدون لینک هدف' },
            { key: 'in_tehran', label: 'موجود در تهران' },
            { key: 'out_tehran', label: 'ناموجود در تهران' },
            { key: 'all', label: 'همه محصولات' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                filter === tab.key
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-[var(--a-bg)] text-[var(--a-muted)] hover:bg-[var(--a-border)]'
              }`}
              onClick={() => setFilter(tab.key as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Content */}
      <div className="bg-[var(--a-surface)] rounded-2xl border border-[var(--a-border)] overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-[var(--a-muted)] flex flex-col items-center justify-center gap-3">
            <span className="animate-spin text-3xl">⏳</span>
            <span>در حال دریافت اطلاعات محصولات...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-[var(--a-muted)]">
            محصولی با فیلترهای انتخابی یافت نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-[var(--a-bg)] text-xs text-[var(--a-muted)] border-b border-[var(--a-border)]">
                <tr>
                  <th className="py-3 px-4">محصول</th>
                  <th className="py-3 px-4">شناسه / SKU</th>
                  <th className="py-3 px-4">لینک سایت هدف</th>
                  <th className="py-3 px-4 text-center">موجودی انبار تهران</th>
                  <th className="py-3 px-4 text-center">موجودی انبار کرمان</th>
                  <th className="py-3 px-4 text-center">عملیات استعلام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--a-border)]">
                {filteredItems.map((item) => {
                  const currentTargetUrl = editingUrl[item.id] ?? item.targetSiteUrl ?? '';
                  const isDirty = editingUrl[item.id] !== undefined && editingUrl[item.id] !== (item.targetSiteUrl ?? '');
                  const isSyncingThis = syncingId === item.id;
                  const logMessage = syncLog[item.id];

                  return (
                    <tr key={item.id} className="hover:bg-[var(--a-bg)]/50 transition-colors">
                      {/* Product Thumbnail & Title */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.imageUrl || '/logo.svg'}
                            alt={item.title}
                            className="w-10 h-10 object-contain rounded-lg bg-white border border-[var(--a-border)]"
                          />
                          <div>
                            <div className="font-semibold text-[var(--a-fg)] line-clamp-1">{item.title}</div>
                            {item.color && (
                              <span className="text-xs text-[var(--a-muted)] font-normal">رنگ: {item.color}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Product ID & SKU */}
                      <td className="py-3 px-4 font-mono text-xs text-[var(--a-muted)]">
                        <div>{item.productId}</div>
                        {item.sku && <div className="text-[10px] opacity-75">{item.sku}</div>}
                      </td>

                      {/* Target Site Link Input */}
                      <td className="py-3 px-4 min-w-[280px]">
                        <div className="flex items-center gap-2">
                          <input
                            type="url"
                            className="a-input text-xs dir-ltr font-mono flex-1"
                            placeholder="https://targetsite.com/product/..."
                            value={currentTargetUrl}
                            onChange={(e) =>
                              setEditingUrl((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                          />
                          {isDirty && (
                            <button
                              type="button"
                              className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                              onClick={() => saveUrlMutation.mutate({ id: item.id, targetSiteUrl: currentTargetUrl })}
                            >
                              ذخیره
                            </button>
                          )}
                          {item.targetSiteUrl && (
                            <a
                              href={item.targetSiteUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-[var(--a-muted)] hover:text-sky-600 transition-colors"
                              title="باز کردن لینک سایت هدف"
                            >
                              ↗️
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Tehran Stock Input */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min="0"
                            className="w-16 text-center a-input text-xs font-bold"
                            defaultValue={item.tehranStock}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val !== item.tehranStock) {
                                saveStockMutation.mutate({ id: item.id, tehranStock: val });
                              }
                            }}
                          />
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.tehranStock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {item.tehranStock > 0 ? 'موجود' : 'ناموجود'}
                          </span>
                        </div>
                      </td>

                      {/* Kerman Stock */}
                      <td className="py-3 px-4 text-center text-xs font-mono text-[var(--a-muted)]">
                        {formatNumber(item.kermanStock)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            disabled={!item.targetSiteUrl || isSyncingThis}
                            onClick={() => syncProductStock(item.id)}
                            className="a-btn a-btn--secondary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
                          >
                            {isSyncingThis ? (
                              <span className="animate-spin">⏳</span>
                            ) : (
                              <span>🔄</span>
                            )}
                            <span>استعلام موجودی</span>
                          </button>
                          {logMessage && (
                            <span className="text-[10px] text-sky-600 font-medium">{logMessage}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
