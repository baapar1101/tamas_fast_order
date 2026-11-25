import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OrderDTO, OrderStatus } from '@tamas/shared';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, formatNumber } from '@tamas/shared';
import { Price } from '../../components/Price';
import { useToast } from '../../components/Toast';
import { useDebounced } from '../../storefront/hooks';
import { api } from '../../lib/api';
import { downloadProformaPdf } from '../components/ProformaDocument';
import { AdminState } from '../components/AdminState';

interface OrdersResponse {
  items: OrderDTO[];
  total: number;
}

export function ProformasPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const debounced = useDebounced(search);
  const query = useMemo(() => ({ q: debounced, status, page, perPage: 30 }), [debounced, status, page]);

  const orders = useQuery({
    queryKey: ['admin', 'proformas', query],
    queryFn: () => api.get<OrdersResponse>('/admin/orders', query),
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  });

  const items = orders.data?.items ?? [];
  const total = orders.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 30));
  const filtered = search.trim() !== '' || status !== 'all';

  const download = async (order: OrderDTO) => {
    setDownloadingId(order.id);
    try {
      await downloadProformaPdf(order);
      toast.ok(`پیش‌فاکتور سفارش ${order.orderCode} دانلود شد.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فایل پیش‌فاکتور ساخته نشد؛ دوباره تلاش کنید.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="a-page a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">پیش‌فاکتورهای مشتریان</h2>
          <p className="a-subtitle">مشاهده و دریافت PDF پیش‌فاکتور سفارش‌های ثبت‌شدهٔ مشتریان.</p>
        </div>
        <span className="a-badge a-badge--neutral">{formatNumber(total)} پیش‌فاکتور</span>
      </section>

      <section className="a-searchbar">
        <input
          className="a-input"
          type="search"
          aria-label="جست‌وجوی پیش‌فاکتورها"
          placeholder="جست‌وجو با کد سفارش، نام مشتری، فروشگاه یا شمارهٔ همراه…"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
        />
      </section>

      <section className="a-tabs">
        <button type="button" className={`a-tab${status === 'all' ? ' a-tab--on' : ''}`} aria-pressed={status === 'all'} onClick={() => { setStatus('all'); setPage(1); }}>
          همه
        </button>
        {ORDER_STATUSES.map((item) => (
          <button key={item} type="button" className={`a-tab${status === item ? ' a-tab--on' : ''}`} aria-pressed={status === item} onClick={() => { setStatus(item); setPage(1); }}>
            {ORDER_STATUS_LABELS[item]}
          </button>
        ))}
      </section>

      <section className="a-card a-card--flush">
        {orders.isLoading ? (
          <AdminState kind="loading" />
        ) : orders.isError ? (
          <AdminState kind="error" error={orders.error} onRetry={() => orders.refetch()} />
        ) : items.length === 0 ? (
          filtered ? (
            <AdminState
              kind="filtered"
              noun="پیش‌فاکتور"
              action={<button type="button" className="a-btn a-btn--secondary a-btn--sm" onClick={() => { setSearch(''); setStatus('all'); setPage(1); }}>پاک کردن فیلترها</button>}
            />
          ) : (
            <AdminState kind="empty" noun="پیش‌فاکتور" />
          )
        ) : (
          <div className="a-table-wrap">
            <table className="a-table proforma-table">
              <thead>
                <tr>
                  <th>شمارهٔ پیش‌فاکتور</th>
                  <th>مشتری</th>
                  <th>تاریخ</th>
                  <th className="a-num">تعداد اقلام</th>
                  <th className="a-num">مبلغ کل</th>
                  <th>وضعیت سفارش</th>
                  <th>فایل</th>
                </tr>
              </thead>
              <tbody>
                {items.map((order) => (
                  <tr key={order.id}>
                    <td data-label="شماره" className="a-strong a-mono a-ltr">PF-{order.orderCode}</td>
                    <td data-label="مشتری">
                      <div className="proforma-customer">
                        <strong>{order.customerName || 'مشتری تماس مارکت'}</strong>
                        <span>{order.storeName || 'بدون نام فروشگاه'}</span>
                        <small className="a-ltr">{order.phone}</small>
                      </div>
                    </td>
                    <td data-label="تاریخ">{new Date(order.createdAt).toLocaleDateString('fa-IR')}</td>
                    <td data-label="تعداد" className="a-num">{formatNumber(order.quantity)} عدد</td>
                    <td data-label="مبلغ" className="a-num a-strong"><Price amount={order.total} /></td>
                    <td data-label="وضعیت"><span className={`a-badge ${order.status === 'cancelled' ? 'a-badge--danger' : 'a-badge--neutral'}`}>{ORDER_STATUS_LABELS[order.status]}</span></td>
                    <td data-label="فایل">
                      <button
                        type="button"
                        className="a-btn a-btn--secondary a-btn--sm proforma-action"
                        disabled={downloadingId !== null}
                        aria-busy={downloadingId === order.id || undefined}
                        onClick={() => void download(order)}
                      >
                        {downloadingId === order.id ? 'در حال ساخت PDF…' : 'دانلود PDF'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {items.length > 0 && (
          <footer className="a-pager">
            <span className="a-pager-info a-pager-count">{formatNumber(total)} پیش‌فاکتور</span>
            <div className="a-pager-actions">
              <button type="button" className="a-btn a-btn--secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>صفحهٔ قبل</button>
              <span className="a-pager-info">صفحه {formatNumber(page)} از {formatNumber(pageCount)}</span>
              <button type="button" className="a-btn a-btn--secondary" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>صفحهٔ بعد</button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
