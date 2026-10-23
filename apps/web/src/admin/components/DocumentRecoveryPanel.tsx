import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DOCUMENT_REQUEST_STATUS_LABELS, type DocumentHealthDTO, type DocumentRequestDTO } from '@tamas/shared';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { documentHasIssue, useDocumentHealth } from '../../lib/document-requests';

const deliveryLabel: Record<string, string> = { registered: 'ثبت در پنل', accepted: 'پذیرفته‌شده توسط سرویس', not_requested: 'انتخاب نشده', not_sent: 'ارسال نشد / اتصال غیرفعال', failed: 'خطای ارسال' };
export function DocumentRecoveryPanel() {
  const query = useDocumentHealth();
  const client = useQueryClient(); const toast = useToast();
  const [filter, setFilter] = useState('issues'); const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DocumentHealthDTO | null>(null);
  const [message, setMessage] = useState('فایل قبلی در دسترس نیست. لطفاً نسخهٔ خوانا و معتبر همین مدرک را مجدداً در بخش مدارک حساب بارگذاری کنید.');
  const [sms, setSms] = useState(false); const [bots, setBots] = useState(false);
  const [review, setReview] = useState<{ document: DocumentHealthDTO; request: DocumentRequestDTO } | null>(null);
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const items = query.data?.items ?? [];
  const issues = items.filter(documentHasIssue);
  const filtered = items.filter((item) => (filter === 'all' || (filter === 'issues' ? documentHasIssue(item) : item.requests.length > 0)) &&
    `${item.userName} ${item.userStoreName} ${item.uploadId} ${item.originalName}`.toLocaleLowerCase('fa').includes(search.trim().toLocaleLowerCase('fa')));
  const refresh = async () => { await client.invalidateQueries({ queryKey: ['document-health'] }); await client.invalidateQueries({ queryKey: ['document-requests'] }); };
  const create = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await api.post<{ delivery: Record<string, string>; message: string }>('/admin/document-requests', { uploadId: selected.uploadId, message, notifySms: sms, notifyBots: bots });
      toast.ok(result.message);
      if (Object.values(result.delivery).some((status) => status === 'failed' || status === 'not_sent')) toast.error('درخواست ثبت شد، اما بعضی اعلان‌های بیرونی ارسال نشد؛ نتیجه در تاریخچه مشخص است.');
      setSelected(null); await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'ثبت درخواست انجام نشد.'); }
    finally { setBusy(false); }
  };
  const reviewRequest = async (action: 'approve' | 'reject' | 'cancel') => {
    if (!review) return;
    setBusy(true);
    try {
      const result = await api.patch<{ message: string }>(`/admin/document-requests/${review.request.id}`, { action, note });
      toast.ok(result.message); setReview(null); await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'تغییر درخواست انجام نشد.'); }
    finally { setBusy(false); }
  };
  return <section className="document-recovery" aria-label="سلامت و تکمیل مدارک">
    <div className="doc-summary">
      <div><span>مدارک نیازمند پیگیری</span><strong>{issues.length.toLocaleString('fa-IR')}</strong></div>
      <div><span>حساب‌های مرتبط</span><strong>{new Set(issues.map((item) => item.userId).filter(Boolean)).size.toLocaleString('fa-IR')}</strong></div>
      <div><span>در انتظار بررسی مدیر</span><strong>{items.flatMap((item) => item.requests).filter((item) => item.status === 'submitted').length.toLocaleString('fa-IR')}</strong></div>
    </div>
    <p className="ds-alert">این فهرست از وجود واقعی فایل در فضای خصوصی ساخته می‌شود. «بدون ارجاع فعال» یعنی فایل به پروندهٔ فعلی متصل نیست و مالک از رکورد آپلود مشخص شده؛ پیش از درخواست، کاربرد آن را بررسی کنید. حساب‌های مدیریتی جدا از مشتری علامت دارند.</p>
    <div className="doc-toolbar">
      <label className="ds-field"><span className="ds-label">جستجوی حساب یا شناسهٔ فایل</span><input className="ds-control" type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label className="ds-field"><span className="ds-label">نمایش</span><select className="ds-control" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="issues">نیازمند پیگیری</option><option value="requests">دارای درخواست / تاریخچه</option><option value="all">همهٔ مدارک خصوصی</option></select></label>
      <button className="a-btn a-btn--secondary" type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>بررسی مجدد فایل‌ها</button>
    </div>
    {query.isPending ? <p role="status">در حال بررسی فضای خصوصی مدارک…</p> : query.isError ? <p role="alert" className="ds-alert ds-alert--danger">دریافت وضعیت مدارک انجام نشد. دوباره تلاش کنید.</p> : <div className="doc-table-scroll">
      <table className="a-table"><caption className="doc-table-caption">سلامت مدارک و درخواست‌های آپلود مجدد</caption><thead><tr><th>حساب و نقش</th><th>مدرک</th><th>محل استفاده</th><th>وضعیت فایل</th><th>درخواست / عملیات</th></tr></thead><tbody>
        {filtered.map((item) => {
          const active = item.requests.find((request) => ['pending', 'submitted'].includes(request.status));
          const missing = item.availability === 'missing' || item.thumbnailAvailability === 'missing';
          return <tr key={item.uploadId}>
            <td><strong>{item.userName}</strong><small>{item.userStoreName} · حساب #{item.userId ?? '—'}</small><span className={`doc-badge${item.userRole === 'customer' ? '' : ' doc-badge--warning'}`}>{item.userRole === 'customer' ? 'مشتری' : item.userRole === 'admin' ? 'مدیر' : item.userRole === 'operator' ? 'اپراتور' : 'مالک نامشخص'}</span></td>
            <td>فایل #{item.uploadId}<small className="doc-filename" dir="auto">{item.originalName}</small>{item.availability === 'available' && <a href={item.fileUrl} target="_blank" rel="noreferrer">مشاهدهٔ خصوصی</a>}</td>
            <td>{item.references.length ? item.references.map((ref) => <small key={`${ref.source}-${ref.recordId}-${ref.label}`}>{ref.label} · #{ref.recordId}</small>) : <span className="doc-badge doc-badge--warning">بدون ارجاع فعال</span>}{item.ownerSource === 'conflict' && <small>تعارض مالکیت؛ درخواست مسدود است</small>}</td>
            <td><span className={`doc-badge${documentHasIssue(item) ? ' doc-badge--danger' : ''}`}>{item.resolved ? 'جایگزین تأیید شده' : item.availability === 'missing' ? 'اصل فایل مفقود' : item.availability === 'unavailable' ? 'خطای فنی دسترسی' : item.thumbnailAvailability === 'missing' ? 'بندانگشتی مفقود' : item.thumbnailAvailability === 'unavailable' ? 'خطای فنی بندانگشتی' : 'موجود'}</span></td>
            <td><div className="doc-actions">{active ? <button type="button" className="a-btn a-btn--secondary" onClick={() => { setReview({ document: item, request: active }); setNote(''); }}>{DOCUMENT_REQUEST_STATUS_LABELS[active.status]}</button> : missing && !item.resolved && <button type="button" className="a-btn a-btn--primary" disabled={!item.userId} onClick={() => { setSelected(item); setSms(false); setBots(false); }}>درخواست آپلود مجدد</button>}
              {item.requests.length > 0 && <button type="button" className="a-btn a-btn--ghost" onClick={() => { setReview({ document: item, request: active ?? item.requests[0]! }); setNote(''); }}>تاریخچه ({item.requests.length.toLocaleString('fa-IR')})</button>}</div></td>
          </tr>;
        })}
        {!filtered.length && <tr><td colSpan={5}>موردی با این فیلتر یافت نشد.</td></tr>}
      </tbody></table>
    </div>}
    <Modal open={Boolean(selected)} title="درخواست آپلود مجدد مدرک" onClose={() => setSelected(null)} busy={busy} size="md" footer={<><button className="ds-button" type="button" disabled={busy} onClick={() => setSelected(null)}>انصراف</button><button className="ds-button ds-button--primary" type="button" disabled={busy || message.trim().length < 5} onClick={() => void create()}>{busy ? 'در حال ثبت…' : 'ثبت درخواست برای این حساب'}</button></>}>
      {selected && <div className="doc-stack"><p>گیرنده: <strong>{selected.userName}</strong> · فایل #{selected.uploadId}</p>{selected.userRole !== 'customer' && <p className="ds-alert ds-alert--warning">این حساب مدیریتی است، نه مشتری.</p>}{!selected.references.length && <p className="ds-alert ds-alert--warning">این فایل ارجاع فعالی ندارد؛ فقط در صورت نیاز واقعی درخواست ثبت کنید.</p>}
        <label className="ds-field"><span className="ds-label">توضیح قابل مشاهده برای صاحب حساب</span><textarea className="ds-control" rows={4} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
        <p className="ds-hint">درخواست همیشه در پنل حساب ثبت می‌شود. اعلان بیرونی فقط با انتخاب شما و طبق تنظیمات سرویس و ترجیحات کاربر ارسال می‌شود؛ اطلاعات خود مدرک ارسال نمی‌شود.</p>
        <label className="doc-check"><input type="checkbox" checked={sms} onChange={(event) => setSms(event.target.checked)} />اطلاع‌رسانی پیامکی</label><label className="doc-check"><input type="checkbox" checked={bots} onChange={(event) => setBots(event.target.checked)} />اطلاع‌رسانی تلگرام و بله</label>
      </div>}
    </Modal>
    <Modal open={Boolean(review)} title="پیگیری و بررسی مدرک جایگزین" onClose={() => setReview(null)} busy={busy} size="lg" footer={review && ['pending', 'submitted'].includes(review.request.status) ? <>
      <button className="ds-button" type="button" disabled={busy} onClick={() => void reviewRequest('cancel')}>لغو درخواست</button>
      {review.request.status === 'submitted' && <><button className="ds-button" type="button" disabled={busy || note.trim().length < 3} onClick={() => void reviewRequest('reject')}>رد و درخواست اصلاح</button><button className="ds-button ds-button--primary" type="button" disabled={busy} onClick={() => void reviewRequest('approve')}>تأیید و جایگزینی مدرک</button></>}
    </> : undefined}>
      {review && <div className="doc-stack"><p><strong>{review.document.userName}</strong> · درخواست #{review.request.id} · {DOCUMENT_REQUEST_STATUS_LABELS[review.request.status]}</p><p className="doc-message">{review.request.message}</p><p className="ds-hint">صرفاً ارجاع مدرک پس از تأیید شما عوض می‌شود؛ سقف اعتبار، وضعیت پرونده و وضعیت مالی رسیدها تغییر نمی‌کنند.</p>
        <dl className="doc-delivery">{Object.entries(review.request.notificationDelivery).map(([channel, status]) => <div key={channel}><dt>{{ inApp: 'پنل حساب', sms: 'پیامک', telegram: 'تلگرام', bale: 'بله' }[channel] ?? channel}</dt><dd>{deliveryLabel[status] ?? status}</dd></div>)}</dl>
        {review.document.requests.map((request) => <section className="doc-history" key={request.id}><h3>درخواست #{request.id} · {DOCUMENT_REQUEST_STATUS_LABELS[request.status]}</h3><small>{new Date(request.createdAt).toLocaleString('fa-IR')}</small><p className="doc-message">{request.message}</p>{!request.submissions.length && <p className="ds-hint">هنوز مدرکی ارسال نشده است.</p>}{request.submissions.map((submission) => <div className="doc-submission" key={submission.id}><a href={submission.fileUrl} target="_blank" rel="noreferrer">مشاهدهٔ مدرک جدید #{submission.uploadId}</a><span>{{ pending: 'در انتظار بررسی', approved: 'تأییدشده', rejected: 'ردشده' }[submission.status]} · {new Date(submission.submittedAt).toLocaleString('fa-IR')}</span>{submission.reviewNote && <p className="doc-message">{submission.reviewNote}</p>}</div>)}</section>)}
        {['pending', 'submitted'].includes(review.request.status) && <label className="ds-field"><span className="ds-label">توضیح بررسی (برای رد الزامی است و مشتری آن را می‌بیند)</span><textarea className="ds-control" rows={3} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} /></label>}
      </div>}
    </Modal>
  </section>;
}
