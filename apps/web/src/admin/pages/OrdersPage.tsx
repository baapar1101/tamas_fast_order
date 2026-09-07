import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrderDTO, OrderStatus } from '@tamas/shared';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, WAREHOUSE_LABELS, formatMoney, formatNumber } from '@tamas/shared';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { useDebounced } from '../../storefront/hooks';

interface OrdersResponse {
  items: OrderDTO[];
  total: number;
}

const TONE: Record<OrderStatus, string> = {
  new: 'brand',
  confirmed: 'brand',
  preparing: 'warn',
  shipped: 'warn',
  delivered: 'success',
  cancelled: 'danger',
};

export function OrdersPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<OrderDTO | null>(null);
  const [note, setNote] = useState('');

  const debounced = useDebounced(search);
  const query = useMemo(() => ({ q: debounced, status, page, perPage: 40 }), [debounced, status, page]);

  const orders = useQuery({
    queryKey: ['admin', 'orders', query],
    queryFn: () => api.get<OrdersResponse>('/admin/orders', query),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });

  const counts = useQuery({
    queryKey: ['admin', 'orders', 'counts'],
    queryFn: () => api.get<{ counts: Record<string, number>; total: number }>('/admin/orders/status-counts'),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'counters'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
  };

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { status?: OrderStatus; note?: string } }) =>
      api.patch<{ order: OrderDTO }>(`/admin/orders/${id}`, body),
    onSuccess: (res) => {
      toast.ok('سفارش به‌روزرسانی شد.');
      setDetail(res.order);
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkStatus = useMutation({
    mutationFn: (body: { ids: number[]; status: OrderStatus }) => api.post<{ changed: number }>('/admin/orders/bulk-status', body),
    onSuccess: (res) => {
      toast.ok(`${formatNumber(res.changed)} سفارش به‌روزرسانی شد.`);
      setSelected(new Set());
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = orders.data?.items ?? [];
  const total = orders.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 40));

  return (
    <>
      <div className="admin-head">
        <h1>سفارش‌ها</h1>
        <span className="badge">{formatNumber(total)} مورد</span>
        <span className="spacer" />
        <button
          type="button"
          className="btn"
          onClick={() =>
            void api
              .download('/admin/orders/export', { status, q: debounced }, `orders-${Date.now()}.csv`)
              .catch((err: Error) => toast.error(err.message))
          }
        >
          خروجی CSV
        </button>
      </div>

      <div className="tabs">
        <button type="button" className={`tab${status === 'all' ? ' on' : ''}`} onClick={() => { setStatus('all'); setPage(1); }}>
          همه ({formatNumber(counts.data?.total ?? 0)})
        </button>
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={`tab${status === s ? ' on' : ''}`}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {ORDER_STATUS_LABELS[s]} ({formatNumber(counts.data?.counts[s] ?? 0)})
          </button>
        ))}
      </div>

      <div className="filters-bar">
        <input
          className="input grow"
          placeholder="جستجو در کد سفارش، نام، موبایل، فروشگاه…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <b>{formatNumber(selected.size)} سفارش انتخاب شده</b>
          <span>تغییر وضعیت به:</span>
          {ORDER_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className="btn sm"
              onClick={() => bulkStatus.mutate({ ids: [...selected], status: s })}
            >
              {ORDER_STATUS_LABELS[s]}
            </button>
          ))}
          <span className="spacer" />
          <button type="button" className="btn ghost sm" onClick={() => setSelected(new Set())}>لغو انتخاب</button>
        </div>
      )}

      {orders.isLoading ? (
        <div className="skeleton" style={{ height: 340 }} />
      ) : items.length === 0 ? (
        <div className="card empty">سفارشی پیدا نشد.</div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th style={{ width: 34 }}>
                  <input
                    type="checkbox"
                    checked={items.length > 0 && items.every((o) => selected.has(o.id))}
                    onChange={(e) => {
                      const next = new Set(selected);
                      for (const o of items) {
                        if (e.target.checked) next.add(o.id);
                        else next.delete(o.id);
                      }
                      setSelected(next);
                    }}
                    aria-label="انتخاب همه"
                  />
                </th>
                <th>کد</th>
                <th>مشتری</th>
                <th>فروشگاه</th>
                <th>موبایل</th>
                <th>اقلام</th>
                <th>مبلغ</th>
                <th>وضعیت</th>
                <th>تاریخ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => {
                        const next = new Set(selected);
                        if (next.has(o.id)) next.delete(o.id);
                        else next.add(o.id);
                        setSelected(next);
                      }}
                      aria-label={o.orderCode}
                    />
                  </td>
                  <td className="ltr">{o.orderCode}</td>
                  <td>{o.customerName}</td>
                  <td>{o.storeName || '—'}</td>
                  <td className="ltr">{o.phone}</td>
                  <td>{formatNumber(o.items.length)}</td>
                  <td>{formatMoney(o.total)}</td>
                  <td>
                    <select
                      className="select"
                      style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
                      value={o.status}
                      onChange={(e) => patch.mutate({ id: o.id, body: { status: e.target.value as OrderStatus } })}
                    >
                      {ORDER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {ORDER_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{new Date(o.createdAt).toLocaleDateString('fa-IR')}</td>
                  <td>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => {
                        setDetail(o);
                        setNote(o.note ?? '');
                      }}
                    >
                      جزئیات
                    </button>
                  </td>
                </tr>
              ))}
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

      <Modal
        open={detail !== null}
        wide
        title={detail ? `سفارش ${detail.orderCode}` : ''}
        onClose={() => setDetail(null)}
        footer={
          detail ? (
            <>
              <button
                type="button"
                className="btn primary"
                style={{ flex: 1 }}
                onClick={() => patch.mutate({ id: detail.id, body: { note } })}
                disabled={patch.isPending}
              >
                ذخیره یادداشت
              </button>
              <button type="button" className="btn" onClick={() => setDetail(null)}>بستن</button>
            </>
          ) : null
        }
      >
        {detail && (
          <div className="stack">
            <div className="stat-grid" style={{ marginBottom: 0 }}>
              <div className="stat">
                <div className="label">مشتری</div>
                <div style={{ fontWeight: 600 }}>{detail.customerName}</div>
                <div className="sub ltr">{detail.phone}</div>
              </div>
              <div className="stat">
                <div className="label">فروشگاه</div>
                <div style={{ fontWeight: 600 }}>{detail.storeName || '—'}</div>
              </div>
              <div className="stat">
                <div className="label">مبلغ کل</div>
                <div className="value brand" style={{ fontSize: 17 }}>{formatMoney(detail.total)}</div>
              </div>
              <div className="stat">
                <div className="label">وضعیت</div>
                <span className={`badge ${TONE[detail.status]}`}>{ORDER_STATUS_LABELS[detail.status]}</span>
                <div className="sub">{new Date(detail.createdAt).toLocaleString('fa-IR')}</div>
              </div>
            </div>

            <div className="field">
              <label>آدرس تحویل</label>
              <div className="card" style={{ padding: 10 }}>{detail.address || '—'}</div>
            </div>

            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>کالا</th>
                    <th>کد</th>
                    <th>رنگ</th>
                    <th>انبار</th>
                    <th>تعداد</th>
                    <th>قیمت واحد</th>
                    <th>جمع</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((i) => (
                    <tr key={i.id}>
                      <td className="wrap">{i.title}</td>
                      <td className="ltr">{i.productId}</td>
                      <td>{i.color || '—'}</td>
                      <td>{WAREHOUSE_LABELS[i.warehouse]}</td>
                      <td>{formatNumber(i.qty)}</td>
                      <td>{formatMoney(i.price)}</td>
                      <td>{formatMoney(i.price * i.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="field">
              <label htmlFor="o-note">یادداشت داخلی</label>
              <textarea id="o-note" className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
