import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { AdminState, TableState } from '../components/AdminState';
import './sms-page.css';

type InboxStatus = 'all' | 'open' | 'handled';
type InboxMessage = {
  id: number;
  fromNumber: string;
  fromPhone: string | null;
  toNumber: string;
  body: string;
  providerTime: string;
  receivedAt: string;
  handledAt: string | null;
  customer: { id: number; name: string; storeName: string } | null;
};
type InboxPage = { items: InboxMessage[]; total: number; page: number; perPage: number; unhandled: number };
type AccountInfo = { configured: boolean; account: { credit: number; availableSenders: string[] } | null };

const number = (n: number) => n.toLocaleString('fa-IR');
const STATUS_TABS: Array<[InboxStatus, string]> = [['open', 'رسیدگی‌نشده'], ['handled', 'رسیدگی‌شده'], ['all', 'همه']];

/** Incoming SMS stored by the server-side Payam Resan inbox poller. */
export function SmsInboxPanel() {
  const toast = useToast();
  const client = useQueryClient();
  const [status, setStatus] = useState<InboxStatus>('open');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const inbox = useQuery({
    queryKey: ['admin', 'sms', 'inbox', status, q, page],
    queryFn: () => api.get<InboxPage>('/admin/sms/inbox', { status, q, page }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const account = useQuery({
    queryKey: ['admin', 'sms', 'inbox', 'account'],
    queryFn: () => api.get<AccountInfo>('/admin/sms/inbox/account'),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const sync = useMutation({
    mutationFn: () => api.post<{ message: string }>('/admin/sms/inbox/sync', {}),
    onSuccess: (res) => { toast.ok(res.message); void client.invalidateQueries({ queryKey: ['admin', 'sms', 'inbox'] }); },
    onError: (err: Error) => toast.error(err.message),
  });
  const mark = useMutation({
    mutationFn: ({ id, handled }: { id: number; handled: boolean }) => api.post(`/admin/sms/inbox/${id}/handled`, { handled }),
    onSuccess: (_res, vars) => {
      toast.ok(vars.handled ? 'پیامک رسیدگی‌شده علامت خورد.' : 'پیامک به رسیدگی‌نشده‌ها برگشت.');
      void client.invalidateQueries({ queryKey: ['admin', 'sms', 'inbox'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const data = inbox.data;
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.perPage ?? 25)));
  const filtered = Boolean(q) || status !== 'all';

  return (
    <section className="a-card" aria-labelledby="sms-inbox-title">
      <div className="a-card-head a-card-head--split">
        <div>
          <h3 id="sms-inbox-title" className="a-card-title">پیامک‌های دریافتی</h3>
          <p className="a-card-desc">
            سرور صندوق پیام‌رسان را مرتب می‌خواند و هر پیامک را ذخیره می‌کند؛ فرستنده اگر مشتری باشد به حسابش وصل می‌شود.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data && <span className="a-badge a-badge--amber">{number(data.unhandled)} رسیدگی‌نشده</span>}
          {account.data?.account && (
            <span className="a-badge a-badge--neutral" title={`خطوط دریافت: ${account.data.account.availableSenders.join('، ') || '—'}`}>
              اعتبار: {number(account.data.account.credit)}
            </span>
          )}
          {account.data && !account.data.configured && <span className="a-badge a-badge--red">کلید API تنظیم نشده</span>}
          <button
            type="button"
            className="a-btn a-btn--secondary"
            disabled={sync.isPending}
            aria-busy={sync.isPending || undefined}
            onClick={() => sync.mutate()}
          >
            {sync.isPending ? 'در حال دریافت…' : 'دریافت پیامک‌های تازه'}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav className="a-segmented" aria-label="وضعیت رسیدگی">
          {STATUS_TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`a-seg${status === value ? ' a-seg--on' : ''}`}
              aria-current={status === value ? 'true' : undefined}
              onClick={() => { setStatus(value); setPage(1); }}
            >
              {label}
            </button>
          ))}
        </nav>
        <input
          className="a-input w-full sm:w-80"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="متن، شماره یا نام مشتری…"
          aria-label="جست‌وجوی پیامک‌های دریافتی"
        />
      </div>

      {inbox.isError && !data ? (
        <AdminState compact kind="error" title="پیامک‌های دریافتی دریافت نشد." error={inbox.error} onRetry={() => void inbox.refetch()} />
      ) : (
        <div className="a-table-wrap" aria-busy={inbox.isFetching || undefined}>
          <table className="a-table">
            <thead>
              <tr>
                <th>فرستنده</th>
                <th>مشتری</th>
                <th>متن</th>
                <th>زمان دریافت</th>
                <th>وضعیت</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {inbox.isPending ? (
                <TableState colSpan={6} kind="loading" title="در حال دریافت پیامک‌ها…" />
              ) : !data?.items.length ? (
                <TableState
                  colSpan={6}
                  kind={filtered ? 'filtered' : 'empty'}
                  noun="پیامک"
                  action={filtered ? (
                    <button type="button" className="a-btn a-btn--secondary a-btn--sm" onClick={() => { setSearch(''); setQ(''); setStatus('all'); setPage(1); }}>
                      پاک کردن فیلترها
                    </button>
                  ) : undefined}
                />
              ) : data.items.map((item) => (
                <tr key={item.id}>
                  <td className="a-ltr whitespace-nowrap">{item.fromPhone || item.fromNumber}</td>
                  <td>
                    {item.customer ? (
                      <span className="flex flex-col">
                        <span>{item.customer.name || 'مشتری بی‌نام'}</span>
                        {item.customer.storeName && <span className="a-note">{item.customer.storeName}</span>}
                      </span>
                    ) : <span className="a-note">ناشناس</span>}
                  </td>
                  <td className="sms-inbox-text" dir="auto">{item.body}</td>
                  <td className="whitespace-nowrap" title={item.providerTime ? `زمان سامانه: ${item.providerTime}` : undefined}>
                    {new Date(item.receivedAt).toLocaleString('fa-IR')}
                  </td>
                  <td>
                    {item.handledAt
                      ? <span className="a-badge a-badge--green">رسیدگی‌شده</span>
                      : <span className="a-badge a-badge--amber">رسیدگی‌نشده</span>}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="a-btn a-btn--secondary a-btn--xs"
                      disabled={mark.isPending}
                      aria-busy={(mark.isPending && mark.variables?.id === item.id) || undefined}
                      onClick={() => mark.mutate({ id: item.id, handled: !item.handledAt })}
                    >
                      {mark.isPending && mark.variables?.id === item.id ? 'در حال ذخیره…' : item.handledAt ? 'برگرداندن' : 'رسیدگی شد'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > 0 && (
        <footer className="a-pager">
          <span className="a-pager-info a-pager-count">{number(data.total)} پیامک</span>
          <div className="a-pager-actions">
            {pageCount > 1 && (
              <>
                <button type="button" className="a-btn a-btn--secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>صفحه قبلی</button>
                <span className="a-pager-info">صفحه {number(page)} از {number(pageCount)}</span>
                <button type="button" className="a-btn a-btn--secondary" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>صفحه بعدی</button>
              </>
            )}
          </div>
        </footer>
      )}
    </section>
  );
}
