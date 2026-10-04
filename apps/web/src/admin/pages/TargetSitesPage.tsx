import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductDTO, TrackingSiteDTO } from '@tamas/shared';
import { formatMoney, formatNumber } from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

type ProductFilter = 'all' | 'has_link' | 'no_link' | 'in_tehran' | 'out_tehran';

interface BatchSyncResponse {
  ok: boolean;
  results: Array<{ productId: string; title: string; tehranStock: number }>;
  errors: Array<{ id: number; error: string }>;
  message: string;
}

export function TargetSitesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ProductFilter>('has_link');
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [priceUnit, setPriceUnit] = useState<'toman' | 'rial'>('toman');
  const [syncingId, setSyncingId] = useState<number | null>(null);

  const sites = useQuery({
    queryKey: ['admin', 'tracking-sites'],
    queryFn: () => api.get<{ items: TrackingSiteDTO[] }>('/admin/tracking-sites'),
  });
  const products = useQuery({
    queryKey: ['adminTargetProducts', search],
    queryFn: () => api.get<{ items: ProductDTO[]; total: number }>('/admin/products', { q: search || undefined, perPage: 5000 }),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'tracking-sites'] }),
      queryClient.invalidateQueries({ queryKey: ['adminTargetProducts'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
    ]);
  };

  const addSite = useMutation({
    mutationFn: () => api.post<{ message: string }>('/admin/tracking-sites', {
      name: siteName.trim(), baseUrl: siteUrl.trim() || null, priceUnit, isActive: true,
    }),
    onSuccess: async (response) => {
      toast.ok(response.message); setSiteName(''); setSiteUrl(''); setPriceUnit('toman'); await refresh();
    },
    onError: (error) => toast.error((error as Error).message),
  });
  const updateSite = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => api.patch<{ message: string }>(`/admin/tracking-sites/${id}`, { isActive }),
    onSuccess: async (response) => { toast.ok(response.message); await refresh(); },
    onError: (error) => toast.error((error as Error).message),
  });
  const deleteSite = useMutation({
    mutationFn: (id: number) => api.del<{ message: string }>(`/admin/tracking-sites/${id}`),
    onSuccess: async (response) => { toast.ok(response.message); await refresh(); },
    onError: (error) => toast.error((error as Error).message),
  });
  const syncOne = useMutation({
    mutationFn: (id: number) => api.post<{ message: string }>(`/admin/tracking/products/${id}/sync`, {}),
    onMutate: (id) => setSyncingId(id),
    onSuccess: async (response) => { toast.ok(response.message); await refresh(); },
    onError: (error) => toast.error((error as Error).message),
    onSettled: () => setSyncingId(null),
  });
  const syncAll = useMutation({
    mutationFn: () => api.post<BatchSyncResponse>('/admin/tracking/sync', {}),
    onSuccess: async (response) => {
      response.errors.length > 0 ? toast.error(`${response.results.length} موفق و ${response.errors.length} ناموفق`) : toast.ok(response.message);
      await refresh();
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const allProducts = products.data?.items ?? [];
  const filteredProducts = useMemo(() => allProducts.filter((product) => {
    const hasLinks = (product.trackingLinks?.length ?? 0) > 0;
    if (filter === 'has_link') return hasLinks;
    if (filter === 'no_link') return !hasLinks;
    if (filter === 'in_tehran') return product.tehranStock > 0;
    if (filter === 'out_tehran') return product.tehranStock === 0;
    return true;
  }), [allProducts, filter]);
  const siteItems = sites.data?.items ?? [];
  const totalLinks = siteItems.reduce((sum, site) => sum + (site.linkCount ?? 0), 0);
  const trackedProducts = allProducts.filter((product) => (product.trackingLinks?.length ?? 0) > 0).length;

  return (
    <div className="a-page space-y-6">
      <section className="a-page-head">
        <div className="a-titles">
          <h1 className="a-title">سایت‌های رهگیری موجودی و قیمت</h1>
          <p className="a-subtitle">سایت‌ها را یک‌بار تعریف کنید؛ سپس در فرم هر محصول حداکثر سه لینک ثبت کنید.</p>
        </div>
        <button type="button" className="a-btn a-btn--primary" disabled={syncAll.isPending || totalLinks === 0} onClick={() => syncAll.mutate()}>
          {syncAll.isPending ? 'در حال بررسی…' : 'بررسی همه قیمت‌ها و موجودی‌ها'}
        </button>
      </section>

      <section className="a-card p-5">
        <div className="a-card-head"><div><h2 className="a-card-title">افزودن سایت</h2><p className="a-card-desc">مثلاً همراه‌تل یا کسری‌پلاس</p></div></div>
        <form className="a-form-grid" onSubmit={(event) => { event.preventDefault(); if (!siteName.trim()) return toast.error('نام سایت را وارد کنید.'); addSite.mutate(); }}>
          <label className="a-field"><span className="a-label">نام سایت</span><input className="a-input" value={siteName} onChange={(event) => setSiteName(event.target.value)} placeholder="مثلاً همراه‌تل" required /></label>
          <label className="a-field"><span className="a-label">آدرس اصلی سایت</span><input className="a-input a-ltr" type="url" value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="https://example.com" /></label>
          <label className="a-field"><span className="a-label">واحد قیمت سایت</span><select className="a-select" value={priceUnit} onChange={(event) => setPriceUnit(event.target.value as 'toman' | 'rial')}><option value="toman">تومان</option><option value="rial">ریال</option></select></label>
          <div className="a-field flex justify-end"><span className="a-label">&nbsp;</span><button type="submit" className="a-btn a-btn--primary" disabled={addSite.isPending}>{addSite.isPending ? 'در حال افزودن…' : 'افزودن سایت'}</button></div>
        </form>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sites.isLoading ? <div className="a-card p-5">در حال دریافت سایت‌ها…</div> : siteItems.length === 0 ? <div className="a-card p-5 text-[var(--a-muted)]">هنوز سایتی تعریف نشده است.</div> : siteItems.map((site) => (
          <article key={site.id} className="a-card p-5">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold text-[var(--a-fg)]">{site.name}</h3><p className="text-xs text-[var(--a-muted)] a-ltr truncate mt-1">{site.baseUrl || 'دامنه ثبت نشده'}</p></div><span className={`a-badge ${site.isActive ? 'a-badge--success' : 'a-badge--neutral'}`}>{site.isActive ? 'فعال' : 'غیرفعال'}</span></div>
            <div className="flex items-center justify-between mt-5 text-xs text-[var(--a-muted)]"><span>{formatNumber(site.linkCount ?? 0)} لینک محصول</span><span>قیمت: {site.priceUnit === 'rial' ? 'ریال ← تومان' : 'تومان'}</span></div>
            <div className="flex gap-2 mt-4"><button type="button" className="a-btn a-btn--secondary a-btn--sm" onClick={() => updateSite.mutate({ id: site.id, isActive: !site.isActive })}>{site.isActive ? 'غیرفعال‌کردن' : 'فعال‌کردن'}</button><button type="button" className="a-btn a-btn--danger a-btn--sm" onClick={() => { if (confirm(`سایت «${site.name}» و همه لینک‌های وابسته حذف شود؟`)) deleteSite.mutate(site.id); }}>حذف</button></div>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([['سایت‌های فعال', siteItems.filter((site) => site.isActive).length], ['کل لینک‌ها', totalLinks], ['محصولات رهگیری‌شده', trackedProducts], ['موجود در تهران', allProducts.filter((product) => product.tehranStock > 0).length]] as Array<[string, number]>).map(([label, value]) => (
          <div className="a-card p-5" key={label}><div className="text-xs text-[var(--a-muted)]">{label}</div><div className="text-2xl font-black text-[var(--a-fg)] mt-1">{formatNumber(value)}</div></div>
        ))}
      </section>

      <section className="a-card overflow-hidden">
        <div className="a-card-head a-card-head--split"><div><h2 className="a-card-title">محصولات</h2><p className="a-card-desc">لینک‌ها از فرم ویرایش محصول ثبت می‌شوند.</p></div><input className="a-input max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجوی محصول…" /></div>
        <div className="flex flex-wrap gap-2 p-4 border-b border-[var(--a-border)]">
          {([['has_link', 'دارای لینک'], ['no_link', 'بدون لینک'], ['in_tehran', 'موجود در تهران'], ['out_tehran', 'ناموجود در تهران'], ['all', 'همه محصولات']] as Array<[ProductFilter, string]>).map(([key, label]) => <button key={key} type="button" className={`a-btn a-btn--sm ${filter === key ? 'a-btn--primary' : 'a-btn--secondary'}`} onClick={() => setFilter(key)}>{label}</button>)}
        </div>
        {products.isLoading ? <p className="a-empty">در حال دریافت محصولات…</p> : filteredProducts.length === 0 ? <p className="a-empty">محصولی با این فیلتر پیدا نشد.</p> : (
          <div className="a-table-wrap"><table className="a-table"><thead><tr><th>محصول</th><th>سایت‌ها و آخرین وضعیت</th><th>موجودی تهران</th><th>عملیات</th></tr></thead><tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id}>
                <td><strong>{product.title}</strong><small className="block a-ltr text-[var(--a-muted)]">{product.productId}</small></td>
                <td className="min-w-[360px]">{(product.trackingLinks?.length ?? 0) === 0 ? <span className="text-xs text-[var(--a-muted)]">بدون لینک رهگیری</span> : <div className="flex flex-col gap-2">{product.trackingLinks!.map((link) => <div key={link.siteId} className="flex flex-wrap items-center gap-2 text-xs"><strong>{link.siteName}</strong><span className={`a-badge ${link.inStock === true ? 'a-badge--success' : link.inStock === false ? 'a-badge--danger' : 'a-badge--neutral'}`}>{link.inStock === true ? 'موجود' : link.inStock === false ? 'ناموجود' : 'بررسی نشده'}</span>{link.lastPrice != null && <span>{formatMoney(link.lastPrice)}</span>}{link.checkedAt && <span className="text-[var(--a-muted)]">{new Date(link.checkedAt).toLocaleString('fa-IR')}</span>}<a href={link.url} target="_blank" rel="noreferrer" className="text-sky-500">بازکردن ↗</a></div>)}</div>}</td>
                <td>{formatNumber(product.tehranStock)}</td>
                <td><button type="button" className="a-btn a-btn--secondary a-btn--sm" disabled={(product.trackingLinks?.length ?? 0) === 0 || syncingId === product.id} onClick={() => syncOne.mutate(product.id)}>{syncingId === product.id ? 'در حال بررسی…' : 'بررسی قیمت و موجودی'}</button></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}
