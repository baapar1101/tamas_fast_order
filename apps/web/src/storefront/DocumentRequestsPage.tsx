import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { DOCUMENT_REQUEST_STATUS_LABELS } from '@tamas/shared';
import { PrivateUploadField } from '../components/PrivateUploadField';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { useDocumentRequests } from '../lib/document-requests';

export function DocumentRequestsNotice() {
  const query = useDocumentRequests();
  const count = query.data?.items.filter((request) => request.status === 'pending').length ?? 0;
  return count > 0 ? <aside className="ds-alert ds-alert--warning doc-request-notice" role="status"><span>برای تکمیل مدارک حساب، {count.toLocaleString('fa-IR')} درخواست آپلود مجدد دارید.</span><Link className="ds-button" to="/account/documents">بررسی و ارسال مدرک</Link></aside> : query.isError ? <aside className="ds-alert">دریافت درخواست‌های مدارک انجام نشد. <button type="button" className="ds-button" onClick={() => void query.refetch()}>تلاش مجدد</button></aside> : null;
}

export function DocumentRequestsPage() {
  const query = useDocumentRequests(); const client = useQueryClient(); const toast = useToast();
  const [files, setFiles] = useState<Record<number, string>>({});
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const submit = async (id: number) => {
    setBusy(id);
    try {
      const result = await api.post<{ message: string }>(`/document-requests/${id}/submit`, { fileUrl: files[id] });
      toast.ok(result.message); setFiles((current) => ({ ...current, [id]: '' }));
      await client.invalidateQueries({ queryKey: ['document-requests'] });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'ارسال مدرک انجام نشد.'); }
    finally { setBusy(null); }
  };
  return <section className="document-recovery doc-stack"><header><h2>مدارک و درخواست‌های تکمیل حساب</h2><p className="ds-hint">فایل‌ها خصوصی هستند. مدرک جدید پس از بررسی مدیر جایگزین می‌شود و سابقهٔ قبلی حفظ خواهد شد.</p></header>
    {query.isPending ? <p role="status">در حال دریافت درخواست‌ها…</p> : query.isError ? <p role="alert" className="ds-alert ds-alert--danger">درخواست‌ها دریافت نشدند. <button type="button" className="ds-button" onClick={() => void query.refetch()}>تلاش مجدد</button></p> : !query.data?.items.length ? <p className="ds-alert">درخواستی برای تکمیل مدرک ندارید.</p> : query.data.items.map((request) => <article className="doc-history" key={request.id}>
      <div className="doc-actions"><h3>{request.documentLabel}</h3><span className="doc-badge">{DOCUMENT_REQUEST_STATUS_LABELS[request.status]}</span></div><small>درخواست #{request.id} · {new Date(request.createdAt).toLocaleDateString('fa-IR')}</small><p className="doc-message">{request.message}</p>
      {request.submissions.map((submission) => <div className="doc-submission" key={submission.id}><a href={submission.fileUrl} target="_blank" rel="noreferrer">مشاهدهٔ فایل ارسال‌شده</a><small>{{ pending: 'در انتظار بررسی مدیر', approved: 'تأیید شد', rejected: 'نیاز به اصلاح' }[submission.status]} · {new Date(submission.submittedAt).toLocaleString('fa-IR')}</small>{submission.reviewNote && <p className="doc-message">توضیح مدیر: {submission.reviewNote}</p>}</div>)}
      {request.status === 'pending' && <><PrivateUploadField label="بارگذاری نسخهٔ جدید مدرک" value={files[request.id] ?? ''} onChange={(url) => setFiles((current) => ({ ...current, [request.id]: url }))} onBusyChange={(value) => setUploading((current) => ({ ...current, [request.id]: value }))} /><button type="button" className="ds-button ds-button--primary" disabled={busy !== null || uploading[request.id] || !files[request.id]} onClick={() => void submit(request.id)}>{busy === request.id ? 'در حال ارسال…' : 'ارسال مدرک برای بررسی'}</button></>}
    </article>)}
  </section>;
}
