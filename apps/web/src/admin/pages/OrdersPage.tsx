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
      toast.ok('Ø³ÙØ§Ø±Ø´ Ø¨Ù‡ Ø±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø´Ø¯.');
      setDetail(res.order);
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkStatus = useMutation({
    mutationFn: (body: { ids: number[]; status: OrderStatus }) => api.post<{ changed: number }>('/admin/orders/bulk-status', body),
    onSuccess: (res) => {
      toast.ok(`${formatNumber(res.changed)} Ø³ÙØ§Ø±Ø´ ØªØºÛŒÛŒØ± ÛŒØ§ÙØª.`);
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
          <h2 className="a-title">Ù…Ø¯ÛŒØ±ÛŒØª Ø³ÙØ§Ø±Ø´â€ŒÙ‡Ø§</h2>
          <p className="a-subtitle">Ø¨Ø±Ø±Ø³ÛŒØŒ ØªØ§ÛŒÛŒØ¯ Ùˆ ØªØºÛŒÛŒØ± ÙˆØ¶Ø¹ÛŒØª Ø³ÙØ§Ø±Ø´â€ŒÙ‡Ø§ÛŒ ÙØ±ÙˆØ´Ú¯Ø§Ù‡</p>
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
            Ø®Ø±ÙˆØ¬ÛŒ Ø§Ú©Ø³Ù„ / CSV
          </button>
        </div>
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
          Ù‡Ù…Ù‡ ({formatNumber(counts.data?.total ?? 0)})
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

      {/* Search Input */}
      <section className="a-card">
        <input
          className="a-input"
          placeholder="Ø¬Ø³ØªØ¬Ùˆ Ø¯Ø± Ú©Ø¯ Ø³ÙØ§Ø±Ø´ØŒ Ù†Ø§Ù… Ù…Ø´ØªØ±ÛŒØŒ Ø´Ù…Ø§Ø±Ù‡ Ù‡Ù…Ø±Ø§Ù‡..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </section>

      {/* Bulk Operations */}
      {selected.size > 0 && (
        <section className="a-bulkbar">
          <span className="a-bulkbar-label">{formatNumber(selected.size)} Ø³ÙØ§Ø±Ø´ Ø§Ù†ØªØ®Ø§Ø¨ Ø´Ø¯Ù‡:</span>
          {ORDER_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className="a-btn a-btn--secondary a-btn--sm"
              onClick={() => bulkStatus.mutate({ ids: [...selected], status: s })}
            >
              Ø¨Ù‡ {ORDER_STATUS_LABELS[s]}
            </button>
          ))}
          <span className="a-bulkbar-spacer" />
          <button type="button" className="a-bulkbar-link" onClick={() => setSelected(new Set())}>
            Ù„ØºÙˆ Ø§Ù†ØªØ®Ø§Ø¨
          </button>
        </section>
      )}

      {/* Orders Table */}
      <section className="a-card a-card--flush">
        {orders.isLoading ? (
          <div className="a-empty">Ø¯Ø± Ø­Ø§Ù„ Ø¯Ø±ÛŒØ§ÙØª Ù„ÛŒØ³Øª Ø³ÙØ§Ø±Ø´â€ŒÙ‡Ø§...</div>
        ) : items.length === 0 ? (
          <div className="a-empty">Ù‡ÛŒÚ† Ø³ÙØ§Ø±Ø´ÛŒ ÛŒØ§ÙØª Ù†Ø´Ø¯.</div>
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
                  <th>Ú©Ø¯ Ø³ÙØ§Ø±Ø´</th>
                  <th>Ø®Ø±ÛŒØ¯Ø§Ø±</th>
                  <th>ØªØ¹Ø¯Ø§Ø¯</th>
                  <th>Ù…Ø¨Ù„Øº Ú©Ù„</th>
                  <th>ÙˆØ¶Ø¹ÛŒØª Ù¾Ø±Ø¯Ø§Ø®Øª</th>
                  <th>ÙˆØ¶Ø¹ÛŒØª Ø³ÙØ§Ø±Ø´</th>
                  <th>Ø±ÙˆØ´ Ù¾Ø±Ø¯Ø§Ø®Øª</th>
                  <th>ØªØ§Ø±ÛŒØ®</th>
                  <th>Ø¬Ø²Ø¦ÛŒØ§Øª</th>
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
                      <div className="font-bold">{o.customerName || 'Ú©Ø§Ø±Ø¨Ø± Ù…Ù‡Ù…Ø§Ù†'}</div>
                      <div className="text-[11px] text-slate-500 font-mono" dir="ltr">
                        {o.phone || 'â€”'}
                      </div>
                    </td>
                    <td className="text-center font-bold">
                      {formatNumber(o.quantity ?? 1)}
                    </td>
                    <td className="font-bold text-emerald-300"><Price amount={o.total} /></td>
                    <td>
                      <span className={`chip ${o.paymentStatus === 'paid' ? 'chip-brand' : o.paymentStatus === 'pending' ? 'chip-amber' : 'chip-rose'}`}>
                        {o.paymentStatus === 'paid' ? 'Ù¾Ø±Ø¯Ø§Ø®Øª Ø´Ø¯Ù‡' : o.paymentStatus === 'pending' ? 'Ø¯Ø± Ø§Ù†ØªØ¸Ø§Ø±' : 'Ù¾Ø±Ø¯Ø§Ø®Øª Ù†Ø´Ø¯Ù‡'}
                      </span>
                    </td>
                    <td>
                      <span className={`chip ${CHIP_TONE[o.status]}`}>
                        {ORDER_STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="text-xs text-slate-400">
                      {o.paymentMethod === 'card_to_card' ? 'Ú©Ø§Ø±Øª Ø¨Ù‡ Ú©Ø§Ø±Øª' : 'Ø¢Ù†Ù„Ø§ÛŒÙ† / Ù†Ù‚Ø¯ÛŒ'}
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
                        Ø¨Ø±Ø±Ø³ÛŒ Ùˆ ÙˆÛŒØ±Ø§ÛŒØ´
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
        <section className="a-card a-pager">
          <button type="button" className="a-btn a-btn--secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ØµÙØ­Ù‡ Ù‚Ø¨Ù„ÛŒ
          </button>
          <span className="a-pager-info">
            ØµÙØ­Ù‡ {formatNumber(page)} Ø§Ø² {formatNumber(pageCount)}
          </span>
          <button type="button" className="a-btn a-btn--secondary" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
            ØµÙØ­Ù‡ Ø¨Ø¹Ø¯ÛŒ
          </button>
        </section>
      )}

      {/* Details Modal */}
      {detail && (
        <Modal
          open={true}
          wide
          title={`Ø¬Ø²Ø¦ÛŒØ§Øª Ø³ÙØ§Ø±Ø´ #${detail.orderCode}`}
          onClose={() => setDetail(null)}
          footer={
            <button type="button" className="a-btn a-btn--secondary" onClick={() => setDetail(null)}>
              Ø¨Ø³ØªÙ†
            </button>
          }
        >
          <div className="a-tabs mb-4">
            <button
              type="button"
              className={`a-tab${detailTab === 'info' ? ' a-tab--on' : ''}`}
              onClick={() => setDetailTab('info')}
            >
              Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ø³ÙØ§Ø±Ø´
            </button>
            <button
              type="button"
              className={`a-tab${detailTab === 'items' ? ' a-tab--on' : ''}`}
              onClick={() => setDetailTab('items')}
            >
              Ø§Ù‚Ù„Ø§Ù… Ø³ÙØ§Ø±Ø´
              <span className="mr-2 rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                {detail.items.length}
              </span>
            </button>
          </div>

          {detailTab === 'info' && (
            <div className="space-y-4">
              <div className="a-card grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400">Ù†Ø§Ù… Ø®Ø±ÛŒØ¯Ø§Ø±:</span>{' '}
                  <strong className="text-white">{detail.customerName || 'Ù…Ù‡Ù…Ø§Ù†'}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Ø´Ù…Ø§Ø±Ù‡ Ù‡Ù…Ø±Ø§Ù‡:</span>{' '}
                  <strong className="text-white" dir="ltr">{detail.phone || 'â€”'}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">Ø¢Ø¯Ø±Ø³ ØªØ­ÙˆÛŒÙ„:</span>{' '}
                  <span className="text-slate-200">{detail.address || 'â€”'}</span>
                </div>
              </div>

              <div>
                <label className="a-label mb-2">ØªØºÛŒÛŒØ± ÙˆØ¶Ø¹ÛŒØª Ø³ÙØ§Ø±Ø´:</label>
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
                <label className="a-label mb-2">ÙˆØ¶Ø¹ÛŒØª Ù¾Ø±Ø¯Ø§Ø®Øª:</label>
                <div className="flex flex-wrap gap-2">
                  {['paid', 'unpaid', 'pending'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={detail.paymentStatus === s ? 'a-btn a-btn--primary a-btn--sm' : 'a-btn a-btn--secondary a-btn--sm'}
                      onClick={() => patch.mutate({ id: detail.id, body: { paymentStatus: s as 'paid' | 'unpaid' | 'pending' } })}
                    >
                      {s === 'paid' ? 'Ù¾Ø±Ø¯Ø§Ø®Øª Ø´Ø¯Ù‡' : s === 'pending' ? 'Ø¯Ø± Ø§Ù†ØªØ¸Ø§Ø± Ù¾Ø±Ø¯Ø§Ø®Øª' : 'Ù¾Ø±Ø¯Ø§Ø®Øª Ù†Ø´Ø¯Ù‡'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="a-divider" />
              <div>
                <label className="a-label mb-1">ÛŒØ§Ø¯Ø¯Ø§Ø´Øª Ù…Ø¯ÛŒØ±ÛŒØª:</label>
                <div className="flex gap-2">
                  <input
                    className="a-input flex-1"
                    placeholder="ÛŒØ§Ø¯Ø¯Ø§Ø´Øª ÛŒØ§ Ù¾ÛŒÚ¯ÛŒØ±ÛŒ..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <button
                    type="button"
                    className="a-btn a-btn--primary"
                    onClick={() => patch.mutate({ id: detail.id, body: { note } })}
                  >
                    Ø°Ø®ÛŒØ±Ù‡
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
                    <th>Ú©Ø¯ Ú©Ø§Ù„Ø§</th>
                    <th>Ù†Ø§Ù… Ú©Ø§Ù„Ø§</th>
                    <th>Ù…Ø´Ø®ØµØ§Øª</th>
                    <th>ØªØ¹Ø¯Ø§Ø¯</th>
                    <th>Ù‚ÛŒÙ…Øª ÙˆØ§Ø­Ø¯</th>
                    <th>Ø¬Ù…Ø¹ Ú©Ù„</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item) => (
                    <tr key={item.id}>
                      <td className="text-xs text-slate-400 font-mono">{item.productId}</td>
                      <td className="font-bold text-white">{item.title}</td>
                      <td className="text-xs text-slate-400">
                        {item.color ? `Ø±Ù†Ú¯: ${item.color}` : 'â€”'}
                      </td>
                      <td className="font-bold text-emerald-300 text-center">{formatNumber(item.qty)}</td>
                      <td className="text-slate-300"><Price amount={item.price} /></td>
                      <td className="font-bold text-white"><Price amount={item.price * item.qty} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detail.items.length === 0 && (
                <div className="a-empty">Ù…Ø­ØµÙˆÙ„ÛŒ Ø¯Ø± Ø§ÛŒÙ† Ø³ÙØ§Ø±Ø´ ÛŒØ§ÙØª Ù†Ø´Ø¯!</div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}