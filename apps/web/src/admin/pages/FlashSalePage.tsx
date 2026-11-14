import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  FLASH_SALE_MAX_DISCOUNT,
  FLASH_SALE_MAX_ITEMS,
  discountPercent,
  flashSaleFloor,
  formatMoney,
  formatNumber,
  type FlashSaleConfig,
  type ProductDTO,
} from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { useDebounced } from '../../storefront/hooks';

type ProductInfo = { price: number; title: string };
type SaleWindow = { active: boolean; startsAt: string; endsAt: string };
type Loaded = { config: FlashSaleConfig; window: SaleWindow; products: Record<string, ProductInfo> };

const HOURS = Array.from({ length: 25 }, (_, hour) => hour);

/** A suggested sale price: 20% off, rounded down to a thousand toman, never past the cap. */
function suggestedPrice(price: number): number {
  return Math.max(flashSaleFloor(price), Math.floor((price * 0.8) / 1000) * 1000);
}

export function FlashSalePage() {
  const toast = useToast();
  const query = useQuery({ queryKey: ['admin', 'flash-sale'], queryFn: () => api.get<Loaded>('/admin/flash-sale') });
  const [config, setConfig] = useState<FlashSaleConfig | null>(null);
  const [info, setInfo] = useState<Record<string, ProductInfo>>({});
  const [saved, setSaved] = useState('');
  const [saleWindow, setSaleWindow] = useState<SaleWindow | null>(null);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search.trim(), 300);

  useEffect(() => {
    if (query.data && config === null) {
      setConfig(query.data.config);
      setInfo(query.data.products);
      setSaved(JSON.stringify(query.data.config));
      setSaleWindow(query.data.window);
    }
  }, [query.data, config]);

  const results = useQuery({
    queryKey: ['admin', 'flash-sale', 'search', debounced],
    queryFn: ({ signal }) => api.get<{ items: ProductDTO[] }>('/admin/products', { q: debounced, status: 'active', perPage: 12 }, signal),
    enabled: debounced.length >= 2,
  });

  const dirty = useMemo(() => config !== null && JSON.stringify(config) !== saved, [config, saved]);

  const save = useMutation({
    mutationFn: (next: FlashSaleConfig) => api.put<{ config: FlashSaleConfig; window: SaleWindow; message: string }>('/admin/flash-sale', next),
    onSuccess: (data) => {
      setConfig(data.config);
      setSaved(JSON.stringify(data.config));
      setSaleWindow(data.window);
      toast.ok(data.message);
    },
    onError: (err: Error) => toast.error(err.message || 'ذخیرهٔ فروش ویژه ناموفق بود.'),
  });

  if (query.isError) return <div className="a-page"><div className="a-alert a-alert--error">دریافت تنظیمات فروش ویژه ناموفق بود.</div></div>;
  if (!config) return <div className="a-page a-fade"><div className="a-card"><div className="a-skeleton a-skeleton--text" /></div></div>;

  const listed = new Set(config.items.map((item) => item.productId));
  const add = (product: ProductDTO) => {
    if (listed.has(product.productId) || product.price <= 0) return;
    if (config.items.length >= FLASH_SALE_MAX_ITEMS) {
      toast.error(`حداکثر ${formatNumber(FLASH_SALE_MAX_ITEMS)} کالا در فروش ویژه جا می‌شود.`);
      return;
    }
    setInfo({ ...info, [product.productId]: { price: product.price, title: product.title + (product.color ? ` — ${product.color}` : '') } });
    setConfig({ ...config, items: [...config.items, { productId: product.productId, salePrice: suggestedPrice(product.price) }] });
  };
  const setPrice = (productId: string, salePrice: number) =>
    setConfig({ ...config, items: config.items.map((item) => (item.productId === productId ? { ...item, salePrice } : item)) });
  const remove = (productId: string) => setConfig({ ...config, items: config.items.filter((item) => item.productId !== productId) });
  const invalid = config.items.filter((item) => {
    const price = info[item.productId]?.price ?? 0;
    return !price || item.salePrice >= price || item.salePrice < flashSaleFloor(price);
  });

  return (
    <div className="a-page a-page--form a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">فروش ویژهٔ زمان‌دار</h2>
          <p className="a-subtitle">کالاهای منتخب هر روز در ساعت‌های تعیین‌شده (به وقت تهران) با قیمت ویژه فروخته می‌شوند. تخفیف هر کالا حداکثر {formatNumber(FLASH_SALE_MAX_DISCOUNT)}٪ است و قیمت در لحظهٔ ثبت سفارش روی سرور حساب می‌شود.</p>
        </div>
        <div className="a-page-actions">
          <a className="a-btn a-btn--secondary" href="/#flash-sale" target="_blank" rel="noreferrer">مشاهده در سایت</a>
          <button type="button" className="a-btn a-btn--primary" disabled={!dirty || save.isPending || invalid.length > 0} onClick={() => save.mutate(config)}>
            {save.isPending ? 'در حال ذخیره…' : dirty ? 'ذخیرهٔ تغییرات' : 'ذخیره شده'}
          </button>
        </div>
      </section>

      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">روشن بودن فروش ویژه</h3>
            <p className="a-card-desc">
              {!config.enabled ? 'خاموش است؛ در سایت نمایش داده نمی‌شود.'
                : saleWindow?.active ? 'هم‌اکنون در حال برگزاری است.'
                : `نوبت بعدی: ساعت ${formatNumber(config.startHour)} تا ${formatNumber(config.endHour)}`}
            </p>
          </div>
          <button type="button" role="switch" className="a-switch" aria-checked={config.enabled} aria-label="روشن بودن فروش ویژه" onClick={() => setConfig({ ...config, enabled: !config.enabled })} />
        </div>
        <div className="a-form-grid a-cols--2">
          <div className="a-field">
            <label className="a-label" htmlFor="fs-title">عنوان</label>
            <input id="fs-title" className="a-input" maxLength={80} value={config.title} onChange={(event) => setConfig({ ...config, title: event.target.value })} />
          </div>
          <div className="a-field">
            <label className="a-label" htmlFor="fs-subtitle">توضیح کوتاه</label>
            <input id="fs-subtitle" className="a-input" maxLength={200} value={config.subtitle} onChange={(event) => setConfig({ ...config, subtitle: event.target.value })} />
          </div>
          <div className="a-field">
            <label className="a-label" htmlFor="fs-start">ساعت شروع</label>
            <select id="fs-start" className="a-input" value={config.startHour} onChange={(event) => setConfig({ ...config, startHour: Number(event.target.value) })}>
              {HOURS.slice(0, 24).map((hour) => <option key={hour} value={hour}>{formatNumber(hour)}:۰۰</option>)}
            </select>
          </div>
          <div className="a-field">
            <label className="a-label" htmlFor="fs-end">ساعت پایان</label>
            <select id="fs-end" className="a-input" value={config.endHour} onChange={(event) => setConfig({ ...config, endHour: Number(event.target.value) })}>
              {HOURS.slice(1).map((hour) => <option key={hour} value={hour} disabled={hour <= config.startHour}>{formatNumber(hour)}:۰۰</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="a-card">
        <div className="a-card-head">
          <div>
            <h3 className="a-card-title">کالاهای فروش ویژه ({formatNumber(config.items.length)} از {formatNumber(FLASH_SALE_MAX_ITEMS)})</h3>
            <p className="a-card-desc">کالا را با نام یا کد پیدا کنید و قیمت ویژه را به تومان بنویسید. کمترین قیمت مجاز نصف قیمت فعلی است.</p>
          </div>
        </div>
        <div className="a-field a-field--full">
          <input className="a-input" type="search" placeholder="جست‌وجوی نام یا کد کالا…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="جست‌وجوی کالا برای فروش ویژه" />
        </div>
        {debounced.length >= 2 && (
          <div className="a-table-wrap" style={{ marginTop: 8 }}>
            <table className="a-table">
              <tbody>
                {(results.data?.items ?? []).map((product) => (
                  <tr key={product.productId}>
                    <td>{product.title}{product.color ? ` — ${product.color}` : ''}<div className="a-hint">{product.productId}</div></td>
                    <td>{formatMoney(product.price)}</td>
                    <td style={{ textAlign: 'end' }}>
                      <button type="button" className="a-btn a-btn--secondary a-btn--sm" disabled={listed.has(product.productId) || product.price <= 0} onClick={() => add(product)}>
                        {listed.has(product.productId) ? 'اضافه شده' : 'افزودن'}
                      </button>
                    </td>
                  </tr>
                ))}
                {results.isSuccess && results.data.items.length === 0 && <tr><td>کالایی پیدا نشد.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {config.items.length > 0 && (
          <div className="a-table-wrap" style={{ marginTop: 16 }}>
            <table className="a-table">
              <thead>
                <tr><th>کالا</th><th>قیمت فعلی</th><th>قیمت ویژه (تومان)</th><th>تخفیف</th><th /></tr>
              </thead>
              <tbody>
                {config.items.map((item) => {
                  const product = info[item.productId];
                  const price = product?.price ?? 0;
                  const bad = !price || item.salePrice >= price || item.salePrice < flashSaleFloor(price);
                  return (
                    <tr key={item.productId}>
                      <td>{product?.title ?? 'کالای حذف‌شده'}<div className="a-hint">{item.productId}</div></td>
                      <td>{price ? formatMoney(price) : '—'}</td>
                      <td>
                        <input
                          className="a-input"
                          inputMode="numeric"
                          style={{ maxWidth: 160 }}
                          value={item.salePrice}
                          aria-invalid={bad}
                          onChange={(event) => setPrice(item.productId, Number(event.target.value.replace(/[^\d]/g, '')) || 0)}
                        />
                        {bad && price > 0 && <div className="a-hint" style={{ color: 'var(--a-danger, #dc2626)' }}>بین {formatMoney(flashSaleFloor(price))} و کمتر از {formatMoney(price)}</div>}
                      </td>
                      <td>{price ? `${formatNumber(discountPercent(price, item.salePrice))}٪` : '—'}</td>
                      <td style={{ textAlign: 'end' }}><button type="button" className="a-btn a-btn--ghost a-btn--sm" onClick={() => remove(item.productId)}>حذف</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
