import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { AdminState, TableState } from '../components/AdminState';
import './sms-page.css';

type Customer = { id: number; name: string; lastName: string; storeName: string; phone: string };
type Draft = { body: string; audience: 'all' | 'selected'; userIds: number[] };
type Preview = { count: number; sample: { name: string; phone: string }[]; previewToken: string };
type Campaign = {
  id: number; body: string; audience: string; status: string; total: number; createdAt: string;
  stats: Record<string, number>;
};
type Delivery = { id: number; name: string | null; lastName: string | null; phone: string; status: string; error: string | null; sentAt: string | null };
const number = (n: number) => n.toLocaleString('fa-IR');
const statusLabel: Record<string, string> = { queued: 'در صف', sending: 'در حال ارسال', completed: 'تمام‌شده', cancelled: 'لغوشده' };

export function SmsCampaignPanel() {
  const toast = useToast();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft>({ body: '', audience: 'all', userIds: [] });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState<Customer[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => clearTimeout(timer); }, [search]);

  const customers = useQuery({
    queryKey: ['admin', 'sms', 'customers', debouncedSearch],
    queryFn: () => api.get<{ items: Customer[] }>('/admin/sms/customers', { q: debouncedSearch }),
    enabled: draft.audience === 'selected',
  });
  const campaigns = useQuery({
    queryKey: ['admin', 'sms', 'campaigns'],
    queryFn: () => api.get<{ items: Campaign[] }>('/admin/sms/campaigns'),
    refetchInterval: 5000,
  });
  const deliveries = useQuery({
    queryKey: ['admin', 'sms', 'campaign', detailId, detailPage],
    queryFn: () => api.get<{ items: Delivery[]; total: number; perPage: number }>(`/admin/sms/campaigns/${detailId}/deliveries`, { page: detailPage }),
    enabled: detailId !== null,
    refetchInterval: detailId !== null ? 5000 : false,
  });
  const previewMutation = useMutation({
    mutationFn: () => api.post<Preview>('/admin/sms/campaigns/preview', draft),
    onSuccess: setPreview,
    onError: (error: Error) => toast.error(error.message),
  });
  const sendMutation = useMutation({
    mutationFn: () => api.post<{ campaign: { id: number; total: number } }>('/admin/sms/campaigns', { ...draft, previewToken: preview!.previewToken, requestId }),
    onSuccess: (result) => {
      toast.ok(`ارسال برای ${number(result.campaign.total)} مشتری در صف قرار گرفت.`);
      setDraft({ body: '', audience: 'all', userIds: [] });
      setSelected([]);
      setPreview(null);
      setRequestId(crypto.randomUUID());
      void client.invalidateQueries({ queryKey: ['admin', 'sms', 'campaigns'] });
    },
    onError: (error: Error) => { setPreview(null); toast.error(error.message); },
  });
  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.post(`/admin/sms/campaigns/${id}/cancel`, {}),
    onSuccess: () => { toast.ok('موارد باقی‌مانده در صف لغو شد.'); void client.invalidateQueries({ queryKey: ['admin', 'sms', 'campaigns'] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const update = (next: Draft) => { setDraft(next); setPreview(null); setRequestId(crypto.randomUUID()); };
  const toggleCustomer = (customer: Customer) => {
    const exists = draft.userIds.includes(customer.id);
    update({ ...draft, userIds: exists ? draft.userIds.filter(id => id !== customer.id) : [...draft.userIds, customer.id] });
    setSelected(current => exists ? current.filter(item => item.id !== customer.id) : [...current, customer]);
  };

  return <>
    <section className="a-card">
      <div className="a-card-head">
        <h3 className="a-card-title">ارسال پیامک به مشتریان</h3>
        <p className="a-card-desc">متن دلخواه را به همهٔ مشتریان فعال یا مشتریان انتخابی بفرستید. مدیران، اپراتورها و حساب‌های غیرفعال گیرنده نیستند.</p>
      </div>
      <div className="space-y-4">
        <label className="block space-y-2 text-sm">
          <span>گیرندگان</span>
          <select className="a-input w-full sm:w-80" value={draft.audience} onChange={event => {
            const audience = event.target.value as Draft['audience'];
            update({ ...draft, audience, userIds: [] }); setSelected([]);
          }}>
            <option value="all">همهٔ مشتریان فعال</option>
            <option value="selected">مشتریان انتخابی</option>
          </select>
        </label>
        {draft.audience === 'selected' && <div className="space-y-3">
          <input className="a-input w-full sm:w-96" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="نام، نام فروشگاه یا شماره موبایل…" aria-label="جست‌وجوی مشتری" />
          {selected.length > 0 && <div className="flex flex-wrap gap-2">{selected.map(customer =>
            <button key={customer.id} type="button" className="a-badge a-badge--brand" onClick={() => toggleCustomer(customer)} title="حذف از گیرندگان" aria-label={`حذف ${customer.name || customer.storeName || customer.phone} از گیرندگان`}>{customer.name || customer.storeName || customer.phone} <span aria-hidden="true">×</span></button>
          )}</div>}
          <div className="sms-box max-h-56 overflow-y-auto">
            {customers.isPending ? <AdminState compact kind="loading" /> : customers.isError ? <AdminState compact kind="error" error={customers.error} onRetry={() => void customers.refetch()} /> : customers.data?.items.length === 0 ? <AdminState compact kind={debouncedSearch ? 'filtered' : 'empty'} noun="مشتری" /> : customers.data?.items.map(customer =>
              <label key={customer.id} className="sms-box-row flex cursor-pointer items-center gap-3 p-3 text-sm">
                <input type="checkbox" checked={draft.userIds.includes(customer.id)} onChange={() => toggleCustomer(customer)} />
                <span>{[customer.name, customer.lastName].filter(Boolean).join(' ') || customer.storeName || 'مشتری'}</span>
                <span className="a-note a-ltr">{customer.phone}</span>
              </label>
            )}
          </div>
          <p className="a-note">حداکثر ۳۰ مشتری در هر صفحهٔ جست‌وجو نمایش داده می‌شود؛ جست‌وجو کنید و انتخاب‌ها را نگه دارید.</p>
        </div>}
        <label className="block space-y-2 text-sm">
          <span>متن پیامک</span>
          <textarea className="a-textarea w-full" rows={4} dir="rtl" maxLength={1000} value={draft.body} onChange={event => update({ ...draft, body: event.target.value })} placeholder="متن پیام را بنویسید…" />
          <span className="a-note">{number(draft.body.length)} / {number(1000)} نویسه · هزینهٔ ارسال به تعداد پیامک‌های محاسبه‌شده توسط درگاه بستگی دارد.</span>
        </label>
        <button type="button" className="a-btn a-btn--secondary" disabled={!draft.body.trim() || (draft.audience === 'selected' && !draft.userIds.length) || previewMutation.isPending} aria-busy={previewMutation.isPending || undefined} onClick={() => previewMutation.mutate()}>
          {previewMutation.isPending ? 'در حال شمارش…' : 'پیش‌نمایش گیرندگان'}
        </button>
        {preview && <div className="sms-box p-4 space-y-3" role="status">
          <strong>ارسال به {number(preview.count)} شمارهٔ معتبر</strong>
          <p className="a-note">نمونه: {preview.sample.map(item => `${item.name} (${item.phone})`).join('، ') || '—'}</p>
          <p className="a-note">پس از تأیید، پیام‌ها در صف قرار می‌گیرند. ارسال‌شده‌ها قابل بازگرداندن نیستند.</p>
          <button type="button" className="a-btn a-btn--primary" disabled={preview.count === 0 || sendMutation.isPending} aria-busy={sendMutation.isPending || undefined} onClick={() => sendMutation.mutate()}>
            {sendMutation.isPending ? 'در حال ثبت…' : `تأیید و ارسال به ${number(preview.count)} مشتری`}
          </button>
        </div>}
      </div>
    </section>
    <section className="a-card">
      <div className="a-card-head"><h3 className="a-card-title">تاریخچهٔ ارسال گروهی</h3></div>
      {campaigns.isError && !campaigns.data ? <AdminState compact kind="error" error={campaigns.error} onRetry={() => void campaigns.refetch()} /> : campaigns.isPending ? <AdminState compact kind="loading" /> : !campaigns.data?.items.length ? <AdminState compact kind="empty" title="هنوز ارسال گروهی ثبت نشده است." /> : <div className="a-table-wrap"><table className="a-table"><thead><tr><th>متن</th><th className="a-num">گیرندگان</th><th>وضعیت</th><th className="a-num">پذیرفته / نامشخص / ارسال‌نشده</th><th>تاریخ</th><th>عملیات</th></tr></thead><tbody>
        {campaigns.data.items.map(campaign => <tr key={campaign.id}>
          <td className="max-w-64 truncate" title={campaign.body}>{campaign.body}</td>
          <td className="a-num">{number(campaign.total)}</td>
          <td>{statusLabel[campaign.status] || campaign.status}</td>
          <td className="a-num">{number(campaign.stats.accepted || 0)} / {number(campaign.stats.unknown || 0)} / {number((campaign.stats.skipped || 0) + (campaign.stats.cancelled || 0))}</td>
          <td>{new Date(campaign.createdAt).toLocaleString('fa-IR')}</td>
          <td><div className="flex flex-wrap gap-2"><button type="button" className="a-btn a-btn--secondary a-btn--xs" aria-expanded={detailId === campaign.id} onClick={() => { setDetailId(detailId === campaign.id ? null : campaign.id); setDetailPage(1); }}>جزئیات</button>{['queued', 'sending'].includes(campaign.status) && <button type="button" className="a-btn a-btn--secondary a-btn--xs" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate(campaign.id)}>لغو باقی‌مانده</button>}</div></td>
        </tr>)}
      </tbody></table></div>}
      {detailId !== null && <div className="mt-5 space-y-3">
        <h4 className="text-sm font-semibold">گزارش گیرندگان ارسال شمارهٔ {number(detailId)}</h4>
        {deliveries.isError && !deliveries.data ? <AdminState compact kind="error" error={deliveries.error} onRetry={() => void deliveries.refetch()} /> : deliveries.isPending ? <AdminState compact kind="loading" /> : <>
          <div className="a-table-wrap"><table className="a-table"><thead><tr><th>مشتری</th><th>شماره</th><th>وضعیت</th><th>زمان پذیرش</th></tr></thead><tbody>
            {deliveries.data?.items.length === 0 ? <TableState colSpan={4} kind="empty" noun="گیرنده" /> : deliveries.data?.items.map(item => <tr key={item.id}><td>{[item.name, item.lastName].filter(Boolean).join(' ') || 'حساب حذف‌شده'}</td><td className="a-ltr">{item.phone}</td><td>{({ queued: 'در صف', processing: 'در حال ارسال', accepted: 'پذیرفته‌شده توسط درگاه', unknown: 'نتیجه نامشخص', skipped: 'حساب یا شماره تغییر کرده', cancelled: 'لغوشده' } as Record<string, string>)[item.status] || item.status}</td><td>{item.sentAt ? new Date(item.sentAt).toLocaleString('fa-IR') : '—'}</td></tr>)}
          </tbody></table></div>
          <div className="flex items-center gap-3"><button type="button" className="a-btn a-btn--secondary a-btn--xs" disabled={detailPage === 1} onClick={() => setDetailPage(detailPage - 1)}>قبلی</button><span className="a-note">صفحهٔ {number(detailPage)} از {number(Math.max(1, Math.ceil((deliveries.data?.total || 0) / 30)))}</span><button type="button" className="a-btn a-btn--secondary a-btn--xs" disabled={detailPage * 30 >= (deliveries.data?.total || 0)} onClick={() => setDetailPage(detailPage + 1)}>بعدی</button></div>
        </>}
      </div>}
    </section>
  </>;
}
