import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrderDTO, OrderStatus, Warehouse } from '@tamas/shared';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, WAREHOUSE_LABELS, formatMoney, formatNumber } from '@tamas/shared';
import { Price } from '../../components/Price';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { AdminStatStrip } from '../components/AdminStatStrip';
import { api } from '../../lib/api';
import { useDebounced } from '../../storefront/hooks';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AdminState } from '../components/AdminState';
import './orders-page.css';

interface OrdersResponse {
  items: OrderDTO[];
  total: number;
}

interface OrderProductOption {
  productId: string;
  sku: string | null;
  title: string;
  color: string | null;
  price: number;
  costPrice: number;
  kermanStock: number;
  tehranStock: number;
  stock: number;
  type: string;
}

interface OrderItemDraft {
  productId: string;
  sku: string | null;
  title: string;
  color: string | null;
  price: number;
  costPrice?: number;
  qty: number;
  warehouse: Warehouse;
}

const downloadOrderExcel = (order: OrderDTO) =>
  api.download(`/admin/orders/${order.id}/sepidar-excel`, {}, `order-${order.orderCode}.xlsx`);

const BADGE_TONE: Record<OrderStatus, string> = {
  new: 'a-badge--info',
  confirmed: 'a-badge--neutral',
  preparing: 'a-badge--warning',
  shipped: 'a-badge--info',
  delivered: 'a-badge--success',
  cancelled: 'a-badge--danger',
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
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [editingItems, setEditingItems] = useState(false);
  const [itemDrafts, setItemDrafts] = useState<OrderItemDraft[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'one'; order: OrderDTO } | { kind: 'bulk'; ids: number[] } | null>(null);

  const debounced = useDebounced(search);
  const debouncedProductSearch = useDebounced(productSearch);
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

  const productOptions = useQuery({
    queryKey: ['admin', 'orders', 'product-options', debouncedProductSearch],
    queryFn: () => api.get<{ items: OrderProductOption[] }>('/admin/orders/product-options', {
      q: debouncedProductSearch,
      limit: 20,
    }),
    enabled: editingItems && debouncedProductSearch.trim().length > 0,
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
      toast.ok('سفارش به‌روز شد.');
      setDetail(res.order);
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const replaceItems = useMutation({
    mutationFn: ({ id, items }: { id: number; items: Array<{ productId: string; warehouse: Warehouse; qty: number }> }) =>
      api.put<{ order: OrderDTO }>(`/admin/orders/${id}/items`, { items }),
    onSuccess: (res) => {
      toast.ok('اقلام سفارش و مبلغ کل به‌روزرسانی شد.');
      setDetail(res.order);
      setItemDrafts(res.order.items.map((item) => ({ ...item })));
      setEditingItems(false);
      setProductSearch('');
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendPaymentInstructions = useMutation({
    mutationFn: ({ id, instructions }: { id: number; instructions: string }) => api.post<{ paymentInstructions: OrderDTO['paymentInstructions']; message: string }>(`/admin/orders/${id}/payment-instructions`, {
      instructions, sendSms: true, sendTelegram: true, sendBale: true,
    }),
    onSuccess: (res) => {
      toast.ok(res.message);
      setDetail((current) => current ? { ...current, paymentInstructions: res.paymentInstructions } : current);
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const autoSendPaymentInstructions = useMutation({
    mutationFn: (id: number) => api.post<{ paymentInstructions: OrderDTO['paymentInstructions']; message: string }>(`/admin/orders/${id}/payment-instructions/auto`, {}),
    onSuccess: (res) => {
      toast.ok(res.message);
      setPaymentInstructions(res.paymentInstructions?.instructions ?? '');
      setDetail((current) => current ? { ...current, paymentInstructions: res.paymentInstructions } : current);
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

  const remove = useMutation({
    mutationFn: (id: number) => api.del<{ message: string }>(`/admin/orders/${id}`),
    onSuccess: (res) => {
      toast.ok(res.message || 'سفارش حذف شد.');
      setDeleteTarget(null);
      setDetail(null);
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkRemove = useMutation({
    mutationFn: (ids: number[]) => api.post<{ changed: number; message: string }>('/admin/orders/bulk-delete', { ids }),
    onSuccess: (res) => {
      toast.ok(res.message || `${formatNumber(res.changed)} سفارش حذف شد.`);
      setDeleteTarget(null);
      setSelected(new Set());
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = orders.data?.items ?? [];
  const total = orders.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 30));
  const canEditOrderItems = Boolean(
    detail && ['new', 'confirmed'].includes(detail.status) && detail.paymentStatus !== 'paid',
  );
  const draftTotal = itemDrafts.reduce((sum, item) => sum + item.price * item.qty, 0);
  const hasFilters = search.trim() !== '' || status !== 'all';

  const beginItemEditing = () => {
    if (!detail || !canEditOrderItems) return;
    setItemDrafts(detail.items.map((item) => ({ ...item })));
    setProductSearch('');
    setEditingItems(true);
  };

  const cancelItemEditing = () => {
    setEditingItems(false);
    setProductSearch('');
    setItemDrafts(detail?.items.map((item) => ({ ...item })) ?? []);
  };

  const addOrderProduct = (product: OrderProductOption, warehouse: Warehouse) => {
    setItemDrafts((current) => {
      const index = current.findIndex((item) => item.productId === product.productId && item.warehouse === warehouse);
      if (index >= 0) {
        return current.map((item, itemIndex) => itemIndex === index ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...current, {
        productId: product.productId,
        sku: product.sku,
        title: product.title,
        color: product.color,
        price: product.price,
        costPrice: product.costPrice,
        qty: 1,
        warehouse,
      }];
    });
  };

  return (
    <div className="a-page a-page--orders a-fade">
      {/* Header */}
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">مدیریت سفارش‌ها</h2>
          <p className="a-subtitle">بررسی، تأیید و تغییر وضعیت سفارش‌های فروشگاه.</p>
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
            دریافت خروجی CSV
          </button>
        </div>
      </section>

      {/* Summary strip */}
      <AdminStatStrip kind="orders" />

      {/* Search Input */}
      <section className="a-searchbar">
        <input
          className="a-input"
          type="search"
          aria-label="جست‌وجوی سفارش‌ها"
          placeholder="جست‌وجو در کد سفارش، نام مشتری، شمارهٔ همراه…"
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
          aria-pressed={status === 'all'}
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
            aria-pressed={status === s}
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
          <button
            type="button"
            className="a-btn a-btn--danger a-btn--sm"
            onClick={() => setDeleteTarget({ kind: 'bulk', ids: [...selected] })}
          >
            حذف انتخاب‌شده‌ها
          </button>
          <span className="a-bulkbar-spacer" />
          <button type="button" className="a-bulkbar-link" onClick={() => setSelected(new Set())}>
            لغو انتخاب
          </button>
        </section>
      )}

      {/* Orders Table */}
      <section className="a-card a-card--flush">
        {orders.isLoading ? (
          <AdminState kind="loading" />
        ) : orders.isError && items.length === 0 ? (
          <AdminState kind="error" title="فهرست سفارش‌ها دریافت نشد." error={orders.error} onRetry={() => void orders.refetch()} />
        ) : items.length === 0 ? (
          hasFilters ? (
            <AdminState
              kind="filtered"
              noun="سفارش"
              action={<button type="button" className="a-btn a-btn--secondary a-btn--sm" onClick={() => { setSearch(''); setStatus('all'); setPage(1); }}>پاک کردن فیلترها</button>}
            />
          ) : (
            <AdminState kind="empty" noun="سفارش" />
          )
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th className="orders-check-col a-center">
                    <input
                      type="checkbox"
                      className="orders-check"
                      aria-label="انتخاب همهٔ سفارش‌های این صفحه"
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
                      <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                      <span>کد سفارش</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                      <span>خریدار</span>
                    </div>
                  </th>
                  <th className="a-num">
                    <div>
                      <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" /></svg>
                      <span>تعداد</span>
                    </div>
                  </th>
                  <th className="a-num">
                    <div>
                      <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      <span>مبلغ کل</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>
                      <span>وضعیت پرداخت</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      <span>وضعیت سفارش</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" /></svg>
                      <span>روش پرداخت</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                      <span>تاریخ</span>
                    </div>
                  </th>
                  <th>
                    <div>
                      <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                      <span>جزئیات</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id} className="order-row">
                    <td className="a-center">
                      <input
                        type="checkbox"
                        className="orders-check"
                        aria-label={`انتخاب سفارش #${o.orderCode}`}
                        checked={selected.has(o.id)}
                        onChange={() => {
                          const next = new Set(selected);
                          if (next.has(o.id)) next.delete(o.id);
                          else next.add(o.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td className="a-strong a-mono a-ltr">
                      #{o.orderCode}
                    </td>
                    <td>
                      <div className="a-strong">{o.customerName || 'کاربر مهمان'}</div>
                      <div className="a-cell-sub a-ltr">
                        {o.phone || '—'}
                      </div>
                    </td>
                    <td className="a-num a-strong">
                      {formatNumber(o.quantity ?? 1)}
                    </td>
                    <td className="a-num a-strong"><Price amount={o.total} /></td>
                    <td>
                      <span className={`a-badge ${o.paymentStatus === 'paid' ? 'a-badge--success' : o.paymentStatus === 'pending' ? 'a-badge--warning' : 'a-badge--danger'}`}>
                        {o.paymentStatus === 'paid' ? 'پرداخت شده' : o.paymentStatus === 'pending' ? 'در انتظار' : 'پرداخت نشده'}
                      </span>
                    </td>
                    <td>
                      <span className={`a-badge ${BADGE_TONE[o.status]}`}>
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="a-cell-sub">
                      {o.paymentPlan?.label ?? (o.paymentMethod === 'card_to_card' ? 'کارت به کارت' : 'آنلاین / نقدی')}
                    </td>
                    <td className="a-cell-sub">
                      {new Date(o.createdAt).toLocaleDateString('fa-IR')}
                    </td>
                    <td>
                      <div className="flex items-center justify-start gap-2">
                        <button
                          type="button"
                          className="a-btn a-btn--secondary a-btn--sm"
                          onClick={() => {
                            setDetail(o);
                            setDetailTab('info');
                            setNote(o.note ?? '');
                            setPaymentInstructions(o.paymentInstructions?.status === 'sent' ? o.paymentInstructions.instructions ?? '' : '');
                            setEditingItems(false);
                            setItemDrafts(o.items.map((item) => ({ ...item })));
                            setProductSearch('');
                          }}
                        >
                          بررسی و ویرایش
                        </button>
                        <button
                          type="button"
                          className="a-btn a-btn--danger a-btn--sm"
                          disabled={o.status !== 'cancelled'}
                          title={o.status === 'cancelled' ? 'حذف سفارش' : 'ابتدا سفارش را لغو کنید.'}
                          aria-label={`حذف سفارش #${o.orderCode}`}
                          onClick={() => setDeleteTarget({ kind: 'one', order: o })}
                        >
                          حذف
                        </button>
                      </div>
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
                    صفحهٔ قبل
                  </button>
                  <span className="a-pager-info">صفحه {formatNumber(page)} از {formatNumber(pageCount)}</span>
                  <button type="button" className="a-btn a-btn--secondary" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                    صفحهٔ بعد
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
          onClose={() => {
            setDetail(null);
            setEditingItems(false);
            setProductSearch('');
          }}
          footer={
            <>
              <button
                type="button"
                className="a-btn a-btn--danger"
                disabled={detail.status !== 'cancelled'}
                title={detail.status === 'cancelled' ? 'حذف سفارش' : 'برای حذف، ابتدا وضعیت سفارش را به لغوشده تغییر دهید.'}
                onClick={() => {
                  setDeleteTarget({ kind: 'one', order: detail });
                  setDetail(null);
                }}
              >
                حذف سفارش
              </button>
              <button type="button" className="a-btn a-btn--secondary" onClick={() => setDetail(null)}>
                بستن
              </button>
            </>
          }
        >
          <div className="a-tabs mb-4 flex justify-between">
            <div className="flex gap-1">
              <button
                type="button"
                className={`a-tab${detailTab === 'info' ? ' a-tab--on' : ''}`}
                aria-pressed={detailTab === 'info'}
                onClick={() => setDetailTab('info')}
              >
                اطلاعات سفارش
              </button>
              <button
                type="button"
                className={`a-tab${detailTab === 'items' ? ' a-tab--on' : ''}`}
                aria-pressed={detailTab === 'items'}
                onClick={() => setDetailTab('items')}
              >
                اقلام سفارش
                <span className="orders-tab-count">
                  {formatNumber(detail.items.length)}
                </span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {detailTab === 'items' && !editingItems && (
                <button
                  type="button"
                  className="a-btn a-btn--primary a-btn--sm"
                  disabled={!canEditOrderItems}
                  title={canEditOrderItems ? 'ویرایش اقلام سفارش' : 'فقط سفارش جدید یا تأییدشده و پرداخت‌نشده قابل ویرایش است.'}
                  onClick={beginItemEditing}
                >
                  ویرایش اقلام
                </button>
              )}
              {detailTab === 'items' && editingItems && (
                <button type="button" className="a-btn a-btn--secondary a-btn--sm" onClick={cancelItemEditing}>
                  انصراف از ویرایش
                </button>
              )}
              <button
                type="button"
                className="a-btn a-btn--secondary a-btn--sm"
                onClick={() => void downloadOrderExcel(detail)}
              >
                <svg className="w-4 h-4 ml-1" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                دریافت اکسل سفارش
              </button>
            </div>
          </div>

          {detailTab === 'info' && (
            <div className="space-y-4">
              <div className="a-card grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="orders-detail-label">نام خریدار:</span>{' '}
                  <strong className="a-strong">{detail.customerName || 'مهمان'}</strong>
                </div>
                <div>
                  <span className="orders-detail-label">شمارهٔ همراه:</span>{' '}
                  <strong className="a-strong a-ltr">{detail.phone || '—'}</strong>
                </div>
                <div className="col-span-2">
                  <span className="orders-detail-label">آدرس تحویل:</span>{' '}
                  <span className="orders-detail-value">{detail.address || '—'}</span>
                </div>
              </div>

              {(detail.paymentInstructions || detail.total > 50_000_000) && (
                <div className="a-card">
                  <div className="a-card-head">
                    <div>
                      <h3 className="a-card-title">اطلاعات پرداخت این سفارش</h3>
                      <p className="a-card-sub">پس از ارسال، اطلاعات داخل سایت ثبت و هم‌زمان از پیامک، تلگرام و بله برای مشتری فرستاده می‌شود.</p>
                    </div>
                    <span className={`a-badge ${detail.paymentInstructions?.status === 'sent' ? 'a-badge--success' : 'a-badge--warning'}`}>
                      {detail.paymentInstructions?.status === 'sent' ? 'ارسال‌شده' : 'در انتظار اپراتور'}
                    </span>
                  </div>
                  <textarea className="a-textarea" rows={5} aria-label="اطلاعات پرداخت برای مشتری" value={paymentInstructions} onChange={(event) => setPaymentInstructions(event.target.value)} placeholder={'بانک و نام صاحب حساب\nشماره کارت\nشماره شبا یا حساب'} />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" className="a-btn a-btn--primary" disabled={sendPaymentInstructions.isPending || autoSendPaymentInstructions.isPending || paymentInstructions.trim().length < 10} aria-busy={sendPaymentInstructions.isPending || undefined} onClick={() => sendPaymentInstructions.mutate({ id: detail.id, instructions: paymentInstructions.trim() })}>
                      {sendPaymentInstructions.isPending ? 'در حال ارسال…' : 'ثبت و ارسال به مشتری'}
                    </button>
                    <button type="button" className="a-btn a-btn--secondary" disabled={sendPaymentInstructions.isPending || autoSendPaymentInstructions.isPending} aria-busy={autoSendPaymentInstructions.isPending || undefined} onClick={() => autoSendPaymentInstructions.mutate(detail.id)}>
                      {autoSendPaymentInstructions.isPending ? 'در حال انتخاب حساب…' : 'انتخاب هوشمند حساب و ارسال'}
                    </button>
                    {detail.paymentInstructions?.channels?.length ? <span className="a-note">مسیرهای ارسال: {detail.paymentInstructions.channels.join('، ')}</span> : null}
                  </div>
                </div>
              )}

              <div>
                <label className="a-label mb-2">تغییر وضعیت سفارش:</label>
                <div className="flex flex-wrap gap-2">
                  {ORDER_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={detail.status === s ? 'a-btn a-btn--primary a-btn--sm' : 'a-btn a-btn--secondary a-btn--sm'}
                      aria-pressed={detail.status === s}
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
                      aria-pressed={detail.paymentStatus === s}
                      onClick={() => patch.mutate({ id: detail.id, body: { paymentStatus: s as 'paid' | 'unpaid' | 'pending' } })}
                    >
                      {s === 'paid' ? 'پرداخت شده' : s === 'pending' ? 'در انتظار پرداخت' : 'پرداخت نشده'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="a-divider" />
              <div>
                <label className="a-label mb-1" htmlFor="order-admin-note">یادداشت مدیریت:</label>
                <div className="flex gap-2">
                  <input
                    id="order-admin-note"
                    className="a-input flex-1"
                    placeholder="یادداشت یا پیگیری…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button
                    type="button"
                    className="a-btn a-btn--primary"
                    disabled={patch.isPending}
                    aria-busy={patch.isPending || undefined}
                    onClick={() => patch.mutate({ id: detail.id, body: { note } })}
                  >
                    ذخیرهٔ یادداشت
                  </button>
                </div>
              </div>
            </div>
          )}

          {detailTab === 'items' && (
            <div className="space-y-4">
              {!canEditOrderItems && (
                <div className="a-amber-box" role="note">
                  اقلام سفارش پرداخت‌شده، لغوشده یا واردشده به مرحله آماده‌سازی و ارسال قابل ویرایش نیست.
                </div>
              )}

              {editingItems && (
                <div className="a-card space-y-3">
                  <label className="a-label" htmlFor="order-product-search">افزودن کالا با جست‌وجوی نام، کد یا SKU</label>
                  <input
                    id="order-product-search"
                    className="a-input"
                    type="search"
                    value={productSearch}
                    placeholder="حداقل بخشی از نام یا کد کالا را وارد کنید…"
                    onChange={(event) => setProductSearch(event.target.value)}
                  />
                  {productSearch.trim() && (
                    <div className="orders-search-results max-h-64 space-y-2 overflow-y-auto rounded-xl p-2">
                      {productOptions.isFetching ? (
                        <AdminState kind="loading" compact title="در حال جست‌وجو…" />
                      ) : productOptions.isError ? (
                        <AdminState kind="error" compact title="جست‌وجوی کالا انجام نشد." error={productOptions.error} onRetry={() => void productOptions.refetch()} />
                      ) : (productOptions.data?.items.length ?? 0) === 0 ? (
                        <AdminState kind="filtered" compact title="کالایی با این جست‌وجو پیدا نشد." />
                      ) : productOptions.data?.items.map((product) => {
                        const siteOnly = product.kermanStock + product.tehranStock === 0;
                        return (
                          <div key={product.productId} className="orders-search-option flex flex-wrap items-center justify-between gap-3 rounded-lg p-3">
                            <div className="min-w-0 flex-1">
                              <div className="a-strong">{product.title}</div>
                              <div className="mt-1 a-cell-sub">
                                <span className="a-ltr">{product.sku || product.productId}</span> · {formatMoney(product.price)} تومان
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="a-btn a-btn--secondary a-btn--xs"
                                disabled={product.kermanStock <= 0}
                                onClick={() => addOrderProduct(product, 'kerman')}
                              >
                                کرمان ({formatNumber(product.kermanStock)})
                              </button>
                              <button
                                type="button"
                                className="a-btn a-btn--secondary a-btn--xs"
                                disabled={product.tehranStock <= 0}
                                onClick={() => addOrderProduct(product, 'tehran')}
                              >
                                تهران ({formatNumber(product.tehranStock)})
                              </button>
                              {siteOnly && (
                                <button
                                  type="button"
                                  className="a-btn a-btn--secondary a-btn--xs"
                                  disabled={product.stock <= 0}
                                  onClick={() => addOrderProduct(product, 'site')}
                                >
                                  سایت ({formatNumber(product.stock)})
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="a-table-wrap">
                <table className="a-table">
                  <thead>
                    <tr>
                      <th>کد کالا</th>
                      <th>نام کالا</th>
                      <th>مشخصات</th>
                      <th>انبار</th>
                      <th className="a-num">تعداد</th>
                      <th className="a-num">قیمت واحد</th>
                      <th className="a-num">بهای خرید</th>
                      <th className="a-num">سود قلم</th>
                      <th className="a-num">جمع کل</th>
                      {editingItems && <th>عملیات</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(editingItems ? itemDrafts : detail.items).map((item) => {
                      const key = `${item.productId}:${item.warehouse}`;
                      return (
                        <tr key={key}>
                          <td className="a-cell-sub a-mono a-ltr">{item.sku || item.productId}</td>
                          <td className="a-strong">{item.title}</td>
                          <td className="a-cell-sub">{item.color ? `رنگ: ${item.color}` : '—'}</td>
                          <td>{WAREHOUSE_LABELS[item.warehouse]}</td>
                          <td className="a-num a-strong">
                            {editingItems ? (
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={10_000}
                                className="a-input a-ltr w-24 text-center"
                                dir="ltr"
                                aria-label={`تعداد ${item.title}`}
                                value={item.qty}
                                onChange={(event) => {
                                  const qty = Math.max(1, Math.min(10_000, Number(event.target.value) || 1));
                                  setItemDrafts((current) => current.map((draft) =>
                                    draft.productId === item.productId && draft.warehouse === item.warehouse
                                      ? { ...draft, qty }
                                      : draft,
                                  ));
                                }}
                              />
                            ) : formatNumber(item.qty)}
                          </td>
                          <td className="a-num"><Price amount={item.price} /></td>
                          <td className="a-num"><Price amount={item.costPrice ?? 0} /></td>
                          <td className={`a-num ${(item.price - (item.costPrice ?? 0)) * item.qty < 0 ? 'orders-profit--neg' : 'orders-profit--pos'}`}><Price amount={(item.price - (item.costPrice ?? 0)) * item.qty} /></td>
                          <td className="a-num a-strong"><Price amount={item.price * item.qty} /></td>
                          {editingItems && (
                            <td>
                              <button
                                type="button"
                                className="a-btn a-btn--danger a-btn--xs"
                                disabled={itemDrafts.length <= 1}
                                aria-label={`حذف ${item.title} از سفارش`}
                                onClick={() => setItemDrafts((current) => current.filter((draft) =>
                                  !(draft.productId === item.productId && draft.warehouse === item.warehouse),
                                ))}
                              >
                                حذف
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(editingItems ? itemDrafts : detail.items).length === 0 && (
                  <AdminState kind="empty" compact title="کالایی در این سفارش نیست." />
                )}
              </div>

              {editingItems && (
                <div className="orders-total-box flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
                  <div>
                    <div className="a-hint">مبلغ جدید سفارش</div>
                    <div className="orders-total-value mt-1 text-lg font-black"><Price amount={draftTotal} /></div>
                  </div>
                  <button
                    type="button"
                    className="a-btn a-btn--primary"
                    disabled={replaceItems.isPending || itemDrafts.length === 0}
                    aria-busy={replaceItems.isPending || undefined}
                    onClick={() => replaceItems.mutate({
                      id: detail.id,
                      items: itemDrafts.map((item) => ({
                        productId: item.productId,
                        warehouse: item.warehouse,
                        qty: item.qty,
                      })),
                    })}
                  >
                    {replaceItems.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ اقلام و محاسبهٔ دوباره'}
                  </button>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.kind === 'bulk' ? 'حذف سفارش‌های انتخاب‌شده' : 'حذف سفارش'}
        busy={remove.isPending || bulkRemove.isPending}
        description={
          deleteTarget?.kind === 'bulk' ? (
            <><strong>{formatNumber(deleteTarget.ids.length)}</strong> سفارش حذف می‌شود. فقط سفارش‌های لغوشده قابل حذف‌اند و سوابق مالی آن‌ها محفوظ می‌ماند.</>
          ) : (
            <>سفارش <strong className="a-ltr">#{deleteTarget?.order.orderCode}</strong> از فهرست حذف می‌شود. اقلام و سوابق مالی برای حسابرسی باقی می‌مانند.</>
          )
        }
        confirmLabel="حذف"
        onClose={() => { if (!remove.isPending && !bulkRemove.isPending) setDeleteTarget(null); }}
        onConfirm={() => {
          if (deleteTarget?.kind === 'one') remove.mutate(deleteTarget.order.id);
          else if (deleteTarget?.kind === 'bulk') bulkRemove.mutate(deleteTarget.ids);
        }}
      />
    </div>
  );
}
