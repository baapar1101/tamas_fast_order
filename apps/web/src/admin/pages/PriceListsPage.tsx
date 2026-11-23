import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_PRICE_LISTS_CONFIG,
  PRICE_LISTS_MAX,
  formatNumber,
  type BrandDTO,
  type CategoryDTO,
  type PriceListDefinition,
  type PriceListSummary,
  type PriceListsConfig,
} from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';

interface Loaded {
  config: PriceListsConfig;
  summaries: PriceListSummary[];
  telegram: { enabled: boolean; groups: Array<{ id: string; name: string }> };
}

function Chips({ options, value, onChange }: { options: Array<{ key: string; label: string }>; value: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = value.includes(option.key);
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={on}
            className={`a-btn a-btn--xs ${on ? 'a-btn--primary' : 'a-btn--secondary'}`}
            onClick={() => onChange(on ? value.filter((item) => item !== option.key) : [...value, option.key])}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Public price lists: each list is a set of categories (and optionally
 * brands). The rows always come from current site prices, so updating prices
 * (Excel or the panel) updates the lists at once.
 */
export function PriceListsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'price-lists'], queryFn: () => api.get<Loaded>('/admin/price-lists') });
  const taxonomy = useQuery({
    queryKey: ['admin', 'taxonomy'],
    queryFn: () => api.get<{ categories: CategoryDTO[]; brands: BrandDTO[] }>('/admin/taxonomy'),
    staleTime: 5 * 60_000,
  });
  const [config, setConfig] = useState<PriceListsConfig>(DEFAULT_PRICE_LISTS_CONFIG);
  useEffect(() => { if (query.data) setConfig(query.data.config); }, [query.data]);

  const save = useMutation({
    mutationFn: () => api.put<Loaded & { message: string }>('/admin/price-lists', config),
    onSuccess: (data) => {
      toast.ok(data.message);
      void qc.invalidateQueries({ queryKey: ['admin', 'price-lists'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const publish = useMutation({
    mutationFn: () => api.post<{ message: string }>('/admin/price-lists/publish', {}),
    onSuccess: (data) => toast.ok(data.message),
    onError: (err: Error) => toast.error(err.message),
  });
  const savedTelegram = query.data?.config.telegram;
  const telegramDirty = Boolean(savedTelegram) && (savedTelegram!.groupId !== config.telegram.groupId || savedTelegram!.autoPublish !== config.telegram.autoPublish);

  const update = (index: number, patch: Partial<PriceListDefinition>) =>
    setConfig({ ...config, lists: config.lists.map((list, i) => (i === index ? { ...list, ...patch } : list)) });
  const addList = () => {
    let n = config.lists.length + 1;
    while (config.lists.some((list) => list.id === `list-${n}`)) n += 1;
    setConfig({ ...config, lists: [...config.lists, { id: `list-${n}`, title: 'لیست قیمت جدید', categoryNames: [], brandNames: [], inStockOnly: true, enabled: false }] });
  };

  const categoryOptions = (taxonomy.data?.categories ?? []).map((item) => ({ key: item.faName, label: item.faName }));
  const brandOptions = (taxonomy.data?.brands ?? []).map((item) => ({ key: item.faName, label: `${item.faName} / ${item.name}` }));
  const counts = new Map((query.data?.summaries ?? []).map((item) => [item.id, item.count]));

  return (
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">لیست‌های قیمت عمومی</h2>
          <p className="a-subtitle">
            هر لیست از دسته‌بندی‌ها (و در صورت نیاز برندهای) انتخابی ساخته می‌شود و قیمت‌ها همیشه همان قیمت فعلی سایت است؛
            با آپدیت اکسل یا ویرایش کالا، لیست‌ها همان لحظه به‌روز می‌شوند. قیمت فقط به همکاران تأییدشده نشان داده می‌شود.
          </p>
        </div>
        <div className="a-page-actions">
          <a className="a-btn a-btn--secondary" href="/prices" target="_blank" rel="noreferrer">صفحهٔ لیست قیمت ↗</a>
          <button type="button" className="a-btn a-btn--primary" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'در حال ذخیره…' : 'ذخیره'}
          </button>
        </div>
      </section>

      <section className="a-card mt-4">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">ارسال در تلگرام</h3>
            <p className="a-card-desc">
              لیست‌های منتشرشده (متن و فایل اکسل، با قیمت) به گروه انتخابی فرستاده می‌شوند. مدیران مجاز می‌توانند فایل اکسل قیمت را
              برای ربات بفرستند؛ ربات پیش‌نمایش تغییرها را نشان می‌دهد و با «اعمال» ثبت می‌کند. دستورهای ربات: /prices و /publish_prices
            </p>
          </div>
          <div className="a-card-actions">
            <button
              type="button"
              className="a-btn a-btn--secondary"
              disabled={!savedTelegram?.groupId || telegramDirty || publish.isPending}
              title={telegramDirty ? 'اول تغییرات را ذخیره کنید.' : undefined}
              onClick={() => publish.mutate()}
            >
              {publish.isPending ? 'در حال ارسال…' : 'ارسال الان'}
            </button>
          </div>
        </div>
        {query.data && !query.data.telegram.enabled ? (
          <p className="a-hint">ربات تلگرام در تنظیمات فعال نیست.</p>
        ) : (
          <div className="a-form-grid">
            <label className="a-field">
              <span className="a-label">گروه لیست قیمت</span>
              <select
                className="a-input"
                value={config.telegram.groupId}
                onChange={(e) => setConfig({ ...config, telegram: { ...config.telegram, groupId: e.target.value } })}
              >
                <option value="">ارسال نشود</option>
                {(query.data?.telegram.groups ?? []).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <span className="a-hint">گروه‌ها از تنظیمات ← تلگرام می‌آیند. قیمت‌ها کامل فرستاده می‌شوند؛ گروهی انتخاب کنید که فقط همکاران در آن هستند.</span>
            </label>
            <label className="flex items-center gap-2 text-sm" style={{ alignSelf: 'center' }}>
              <input
                type="checkbox"
                checked={config.telegram.autoPublish}
                disabled={!config.telegram.groupId}
                onChange={(e) => setConfig({ ...config, telegram: { ...config.telegram, autoPublish: e.target.checked } })}
              />
              بعد از هر به‌روزرسانی قیمت با اکسل (پنل یا ربات)، یک دقیقه بعد خودکار ارسال شود
            </label>
          </div>
        )}
      </section>

      {config.lists.map((list, index) => (
        <section key={list.id} className="a-card mt-4">
          <div className="a-card-head a-card-head--split">
            <div className="flex flex-wrap items-center gap-3">
              <input className="a-input" style={{ minWidth: 260 }} maxLength={80} value={list.title} onChange={(e) => update(index, { title: e.target.value })} aria-label="عنوان لیست" />
              <span className="a-badge a-badge--neutral a-ltr">/prices?list={list.id}</span>
              {counts.has(list.id) && <span className="a-badge a-badge--brand">{formatNumber(counts.get(list.id) ?? 0)} کالا</span>}
            </div>
            <div className="a-card-actions">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={list.enabled} onChange={(e) => update(index, { enabled: e.target.checked })} /> منتشر شود
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={list.inStockOnly} onChange={(e) => update(index, { inStockOnly: e.target.checked })} /> فقط کالاهای موجود
              </label>
              <button type="button" className="a-btn a-btn--danger a-btn--xs" onClick={() => setConfig({ ...config, lists: config.lists.filter((_, i) => i !== index) })}>حذف لیست</button>
            </div>
          </div>
          <div className="a-field mt-2">
            <span className="a-label">دسته‌بندی‌ها {list.categoryNames.length ? `(${formatNumber(list.categoryNames.length)})` : '(دست‌کم یکی)'}</span>
            <Chips options={categoryOptions} value={list.categoryNames} onChange={(categoryNames) => update(index, { categoryNames })} />
          </div>
          <div className="a-field mt-3">
            <span className="a-label">برندها {list.brandNames.length ? `(${formatNumber(list.brandNames.length)})` : '(هیچ‌کدام = همهٔ برندها)'}</span>
            <Chips options={brandOptions} value={list.brandNames} onChange={(brandNames) => update(index, { brandNames })} />
          </div>
        </section>
      ))}

      {config.lists.length < PRICE_LISTS_MAX && (
        <button type="button" className="a-btn a-btn--secondary mt-4" onClick={addList}>+ لیست جدید</button>
      )}
    </div>
  );
}
