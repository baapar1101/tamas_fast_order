import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrderDTO, OrderStatus } from '@tamas/shared';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, formatMoney, formatNumber } from '@tamas/shared';
import { Price } from '../../components/Price';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { useDebounced } from '../../storefront/hooks';

interface OrdersResponse {
  items: OrderDTO[];
  total: number;
}

const CHIP_TONE: Record<OrderStatus, string> = {
  new: 'chip-brand',
  confirmed: 'chip-brand',
  preparing: 'chip-amber',
  shipped: 'chip-aqua',
  delivered: 'chip-brand',
  cancelled: 'chip-rose',
};

export function OrdersPage() {
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<OrderDTO | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'items'>('info');
  const [note, setNote] = useState('');

  const debounced = useDebounced(search);
  const query = useMemo(() => ({ q: debounced, status, page, perPage: 30 }), [debounced, status, page]);

  const orders = useQuery({
    queryKey: ['admin', 'orders', query],
    queryFn: () => api.get<OrdersResponse>('/admin/orders', query),
    placeholderData: (prev) => prev,
    refetchInterval: 30_000,
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
    mutationFn: ({ id, body }: { id: number; body: { status?: OrderStatus; paymentStatus?: 'paid' | 'unpaid' | 'pending'; note?: string } }) =>
      api.patch<{ order: OrderDTO }>(`/admin/orders/${id}`, body),
    onSuccess: (res) => {
      toast.ok('سفارش به روزرسانی شد.');
      setDetail(res.order);
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkStatus = useMutation({
    mutationFn: (body: { ids: number[]; status: OrderStatus }) => api.post<{ changed: number }>('/admin/orders/bulk-status', body),
    onSuccess: (res) => {
      toast.ok(`${formatNumber(res.changed)} سفارش تغییر یافت.`);
      setSelected(new Set());
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = orders.data?.items ?? [];
  const total = orders.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 30));

  return (
    <div className="a-page a-page--orders a-fade">
      {/* Header */}
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">مدیریت سفارش‌ها</h2>
          <p className="a-subtitle">بررسی، تایید و تغییر وضعیت سفارش‌های فروشگاه</p>
        </div>
        <div className="a-page-actions">
          <button
            type="button"
            className="a-btn a-btn--secondary"
            onClick={() =>
              void api
                .download('/admin/orders/export', { status, q: debounced }, `orders-${Date.now()}.csv`)
                .catch((err: Error) => toast.error(err.message))
            }
          >
            خروجی اکسل / CSV
          </button>
        </div>
      </section>

      {/* Search Input */}
      <section className="a-searchbar">
        <input
          className="a-input"
          placeholder="جستجو در کد سفارش، نام مشتری، شماره همراه..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </section>

      {/* Status Filter Tabs */}
      <section className="a-tabs">
        <button
          type="button"
          className={`a-tab${status === 'all' ? ' a-tab--on' : ''}`}
          onClick={() => {
            setStatus('all');
            setPage(1);
          }}
        >
          همه ({formatNumber(counts.data?.total ?? 0)})
        </button>
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={`a-tab${status === s ? ' a-tab--on' : ''}`}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {ORDER_STATUS_LABELS[s]} ({formatNumber(counts.data?.counts[s] ?? 0)})
          </button>
        ))}
      </section>

      {/* Bulk Operations */}
      {selected.size > 0 && (
        <section className="a-bulkbar">
          <span className="a-bulkbar-label">{formatNumber(selected.size)} سفارش انتخاب شده:</span>
          {ORDER_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className="a-btn a-btn--secondary a-btn--sm"
              onClick={() => bulkStatus.mutate({ ids: [...selected], status: s })}
            >
              به {ORDER_STATUS_LABELS[s]}
            </button>
          ))}
          <span className="a-bulkbar-spacer" />
          <button type="button" className="a-bulkbar-link" onClick={() => setSelected(new Set())}>
            لغو انتخاب
          </button>
        </section>
      )}

      {/* Orders Table */}
      <section className="a-card a-card--flush">
        {orders.isLoading ? (
          <div className="a-empty">در حال دریافت لیست سفارش‌ها...</div>
        ) : items.length === 0 ? (
          <div className="a-empty">هیچ سفارشی یافت نشد.</div>
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
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
                    />
                  </th>
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                      <span>کد سفارش</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                      <span>خریدار</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
                      <span>تعداد</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      <span>مبلغ کل</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>
                      <span>وضعیت پرداخت</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      <span>وضعیت سفارش</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" /></svg>
                      <span>روش پرداخت</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                      <span>تاریخ</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                      <span>جزئیات</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id} className="order-row">
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
                      />
                    </td>
                    <td className="a-strong font-mono" dir="ltr">
                      #{o.orderCode}
                    </td>
                    <td>
                      <div className="font-bold">{o.customerName || 'کاربر مهمان'}</div>
                      <div className="text-[11px] text-slate-500 font-mono" dir="ltr">
                        {o.phone || '—'}
                      </div>
                    </td>
                    <td className="text-center font-bold">
                      {formatNumber(o.quantity ?? 1)}
                    </td>
                    <td className="font-bold text-emerald-300"><Price amount={o.total} /></td>
                    <td>
                      <span className={`chip ${o.paymentStatus === 'paid' ? 'chip-brand' : o.paymentStatus === 'pending' ? 'chip-amber' : 'chip-rose'}`}>
                        {o.paymentStatus === 'paid' ? 'پرداخت شده' : o.paymentStatus === 'pending' ? 'در انتظار' : 'پرداخت نشده'}
                      </span>
                    </td>
                    <td>
                      <span className={`chip ${CHIP_TONE[o.status]}`}>
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400">
                      {o.paymentMethod === 'card_to_card' ? 'کارت به کارت' : 'آنلاین / نقدی'}
                    </td>
                    <td className="text-xs text-slate-400">
                      {new Date(o.createdAt).toLocaleDateString('fa-IR')}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="a-btn a-btn--secondary a-btn--sm"
                        onClick={() => {
                          setDetail(o);
                          setDetailTab('info');
                          setNote(o.note ?? '');
                        }}
                      >
                        بررسی و ویرایش
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer: count + pagination */}
        {items.length > 0 && (
          <footer className="a-pager">
            <span className="a-pager-info a-pager-count">{formatNumber(total)} سفارش</span>
            <div className="a-pager-actions">
              {pageCount > 1 && (
                <>
                  <button type="button" className="a-btn a-btn--secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    صفحه قبلی
                  </button>
                  <span className="a-pager-info">صفحه {formatNumber(page)} از {formatNumber(pageCount)}</span>
                  <button type="button" className="a-btn a-btn--secondary" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                    صفحه بعدی
                  </button>
                </>
              )}
            </div>
          </footer>
        )}
      </section>

      {/* Details Modal */}
      {detail && (
        <Modal
          open={true}
          wide
          title={`جزئیات سفارش #${detail.orderCode}`}
          onClose={() => setDetail(null)}
          footer={
            <button type="button" className="a-btn a-btn--secondary" onClick={() => setDetail(null)}>
              بستن
            </button>
          }
        >
          <div className="a-tabs mb-4">
            <button
              type="button"
              className={`a-tab${detailTab === 'info' ? ' a-tab--on' : ''}`}
              onClick={() => setDetailTab('info')}
            >
              اطلاعات سفارش
            </button>
            <button
              type="button"
              className={`a-tab${detailTab === 'items' ? ' a-tab--on' : ''}`}
              onClick={() => setDetailTab('items')}
            >
              اقلام سفارش
              <span className="mr-2 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                {detail.items.length}
              </span>
            </button>
          </div>

          {detailTab === 'info' && (
            <div className="space-y-4">
              <div className="a-card grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400">نام خریدار:</span>{' '}
                  <strong className="text-white">{detail.customerName || 'مهمان'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">شماره همراه:</span>{' '}
                  <strong className="text-white" dir="ltr">{detail.phone || '—'}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">آدرس تحویل:</span>{' '}
                  <span className="text-slate-200">{detail.address || '—'}</span>
                </div>
              </div>

              <div>
                <label className="a-label mb-2">تغییر وضعیت سفارش:</label>
                <div className="flex flex-wrap gap-2">
                  {ORDER_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={detail.status === s ? 'a-btn a-btn--primary a-btn--sm' : 'a-btn a-btn--secondary a-btn--sm'}
                      onClick={() => patch.mutate({ id: detail.id, body: { status: s } })}
                    >
                      {ORDER_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="a-divider" />
              <div>
                <label className="a-label mb-2">وضعیت پرداخت:</label>
                <div className="flex flex-wrap gap-2">
                  {['paid', 'unpaid', 'pending'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={detail.paymentStatus === s ? 'a-btn a-btn--primary a-btn--sm' : 'a-btn a-btn--secondary a-btn--sm'}
                      onClick={() => patch.mutate({ id: detail.id, body: { paymentStatus: s as 'paid' | 'unpaid' | 'pending' } })}
                    >
                      {s === 'paid' ? 'پرداخت شده' : s === 'pending' ? 'در انتظار پرداخت' : 'پرداخت نشده'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="a-divider" />
              <div>
                <label className="a-label mb-1">یادداشت مدیریت:</label>
                <div className="flex gap-2">
                  <input
                    className="a-input flex-1"
                    placeholder="یادداشت یا پیگیری..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button
                    type="button"
                    className="a-btn a-btn--primary"
                    onClick={() => patch.mutate({ id: detail.id, body: { note } })}
                  >
                    ذخیره
                  </button>
                </div>
              </div>
            </div>
          )}

          {detailTab === 'items' && (
            <div className="a-table-wrap">
              <table className="a-table">
                <thead>
                  <tr>
                    <th>کد کالا</th>
                    <th>نام کالا</th>
                    <th>مشخصات</th>
                    <th>تعداد</th>
                    <th>قیمت واحد</th>
                    <th>جمع کل</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td className="text-xs text-slate-400 font-mono">{item.productId}</td>
                      <td className="font-bold text-white">{item.title}</td>
                      <td className="text-xs text-slate-400">
                        {item.color ? `رنگ: ${item.color}` : '—'}
                      </td>
                      <td className="font-bold text-emerald-300 text-center">{formatNumber(item.qty)}</td>
                      <td className="text-slate-300"><Price amount={item.price} /></td>
                      <td className="font-bold text-white"><Price amount={item.price * item.qty} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detail.items.length === 0 && (
                <div className="a-empty">محصولی در این سفارش یافت نشد!</div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}