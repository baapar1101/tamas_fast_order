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
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-wrap items-center justify-between gap-4 animate-fade-up">
        <div>
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">مدیریت سفارش‌ها</h2>
          <p className="mt-1 text-xs text-slate-400">بررسی، تایید و تغییر وضعیت سفارش‌های فروشگاه</p>
        </div>
        <button
          type="button"
          className="huma-btn-secondary"
          onClick={() =>
            void api
              .download('/admin/orders/export', { status, q: debounced }, `orders-${Date.now()}.csv`)
              .catch((err: Error) => toast.error(err.message))
          }
        >
          خروجی اکسل / CSV
        </button>
      </section>

      {/* Status Filter Tabs */}
      <section className="glass-card p-2 flex items-center gap-1 overflow-x-auto max-w-full whitespace-nowrap">
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            status === 'all' ? 'bg-emerald-500/15 text-emerald-300 shadow-glow' : 'text-slate-400 hover:text-white'
          }`}
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
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              status === s ? 'bg-emerald-500/15 text-emerald-300 shadow-glow' : 'text-slate-400 hover:text-white'
            }`}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {ORDER_STATUS_LABELS[s]} ({formatNumber(counts.data?.counts[s] ?? 0)})
          </button>
        ))}
      </section>

      {/* Search Input */}
      <section className="glass-card p-4">
        <input
          className="huma-input"
          placeholder="جستجو در کد سفارش، نام مشتری، شماره همراه..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </section>

      {/* Bulk Operations */}
      {selected.size > 0 && (
        <section className="glass-card bg-emerald-500/10 border-emerald-500/30 p-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-emerald-300">{formatNumber(selected.size)} سفارش انتخاب شده:</span>
          {ORDER_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className="huma-btn-secondary !py-1 !px-2.5 !text-xs"
              onClick={() => bulkStatus.mutate({ ids: [...selected], status: s })}
            >
              به {ORDER_STATUS_LABELS[s]}
            </button>
          ))}
          <button type="button" className="text-xs text-slate-400 underline mr-auto" onClick={() => setSelected(new Set())}>
            لغو انتخاب
          </button>
        </section>
      )}

      {/* Orders Glass Table */}
      <section className="glass-card overflow-hidden">
        {orders.isLoading ? (
          <div className="p-12 text-center text-slate-400">در حال دریافت لیست سفارش‌ها...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-500">هیچ سفارشی یافت نشد.</div>
        ) : (
          <div className="huma-table-container">
            <table className="huma-table">
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
                  <th>کد سفارش</th>
                  <th>خریدار</th>
                  <th>تعداد</th>
                  <th>مبلغ کل</th>
                  <th>وضعیت پرداخت</th>
                  <th>وضعیت سفارش</th>
                  <th>روش پرداخت</th>
                  <th>تاریخ</th>
                  <th>جزئیات</th>
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
                    <td className="font-mono font-bold text-white" dir="ltr">
                      #{o.orderCode}
                    </td>
                    <td>
                      <div className="font-bold text-white">{o.customerName || 'کاربر مهمان'}</div>
                      <div className="text-[11px] text-slate-500 font-mono" dir="ltr">
                        {o.phone || '—'}
                      </div>
                    </td>
                    <td className="text-center font-bold text-white">
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
                        className="huma-btn-secondary !py-1 !px-3 !text-xs"
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
      </section>

      {/* Pagination */}
      {pageCount > 1 && (
        <section className="flex items-center justify-between glass-card p-4">
          <button type="button" className="huma-btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            صفحه قبلی
          </button>
          <span className="text-xs text-slate-400 font-semibold">
            صفحه {formatNumber(page)} از {formatNumber(pageCount)}
          </span>
          <button type="button" className="huma-btn-secondary" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
            صفحه بعدی
          </button>
        </section>
      )}

      {/* Details Modal */}
      {detail && (
        <Modal
          open={true}
          wide
          title={`جزئیات سفارش #${detail.orderCode}`}
          onClose={() => setDetail(null)}
          footer={
            <button type="button" className="huma-btn-secondary" onClick={() => setDetail(null)}>
              بستن
            </button>
          }
        >
          <div className="flex gap-2 border-b border-white/[0.06] mb-4">
            <button
              type="button"
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                detailTab === 'info' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
              }`}
              onClick={() => setDetailTab('info')}
            >
              اطلاعات سفارش
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-all ${
                detailTab === 'items' ? 'border-emerald-400 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
              }`}
              onClick={() => setDetailTab('items')}
            >
              اقلام سفارش
              <span className="ml-2 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                {detail.items.length}
              </span>
            </button>
          </div>

          {detailTab === 'info' && (
            <div className="space-y-4">
              <div className="glass-card p-4 grid grid-cols-2 gap-3 text-xs">
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
                <label className="block text-xs font-semibold text-slate-400 mb-2">تغییر وضعیت سفارش:</label>
                <div className="flex flex-wrap gap-2">
                  {ORDER_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        detail.status === s ? 'bg-emerald-500 text-slate-950 shadow-glow' : 'huma-btn-secondary'
                      }`}
                      onClick={() => patch.mutate({ id: detail.id, body: { status: s } })}
                    >
                      {ORDER_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-4">
                <label className="block text-xs font-semibold text-slate-400 mb-2">وضعیت پرداخت:</label>
                <div className="flex flex-wrap gap-2">
                  {['paid', 'unpaid', 'pending'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        detail.paymentStatus === s ? 'bg-emerald-500 text-slate-950 shadow-glow' : 'huma-btn-secondary'
                      }`}
                      onClick={() => patch.mutate({ id: detail.id, body: { paymentStatus: s as 'paid' | 'unpaid' | 'pending' } })}
                    >
                      {s === 'paid' ? 'پرداخت شده' : s === 'pending' ? 'در انتظار پرداخت' : 'پرداخت نشده'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-4">
                <label className="block text-xs font-semibold text-slate-400 mb-1">یادداشت مدیریت:</label>
                <div className="flex gap-2">
                  <input
                    className="huma-input flex-1"
                    placeholder="یادداشت یا پیگیری..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button
                    type="button"
                    className="huma-btn-primary"
                    onClick={() => patch.mutate({ id: detail.id, body: { note } })}
                  >
                    ذخیره
                  </button>
                </div>
              </div>
            </div>
          )}

          {detailTab === 'items' && (
            <div className="huma-table-container">
              <table className="huma-table">
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
                <div className="p-8 text-center text-slate-500 text-sm">محصولی در این سفارش یافت نشد!</div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
