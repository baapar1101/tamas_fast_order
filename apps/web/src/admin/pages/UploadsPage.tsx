import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UploadDTO, UploadKind } from '@tamas/shared';
import { UPLOAD_KINDS, formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

const KIND_LABELS: Record<UploadKind, string> = {
  product: 'محصول',
  brand: 'برند',
  category: 'دسته‌بندی',
  slide: 'اسلاید',
  certificate: 'جواز کسب',
  other: 'سایر',
};

interface UploadsResponse {
  items: UploadDTO[];
  total: number;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${formatNumber(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 1024))} KB`;
  return `${formatNumber(Math.round((bytes / 1024 / 1024) * 10) / 10)} MB`;
}

export function UploadsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<UploadKind>('product');
  const [filter, setFilter] = useState<UploadKind | 'all'>('all');
  const [page, setPage] = useState(1);
  const [dragging, setDragging] = useState(false);

  const uploads = useQuery({
    queryKey: ['admin', 'uploads', filter, page],
    queryFn: () => api.get<UploadsResponse>('/admin/uploads', { kind: filter === 'all' ? undefined : filter, page, perPage: 40 }),
    placeholderData: (prev) => prev,
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      form.append('kind', kind);
      // The API accepts many files per request, so a folder drop is one round trip.
      for (const file of files) form.append('file', file);
      return api.upload<{ uploads: UploadDTO[]; message: string }>('/admin/uploads', form);
    },
    onSuccess: (res) => {
      toast.ok(res.message);
      void qc.invalidateQueries({ queryKey: ['admin', 'uploads'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/admin/uploads/${id}`),
    onSuccess: () => {
      toast.ok('فایل حذف شد.');
      void qc.invalidateQueries({ queryKey: ['admin', 'uploads'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = uploads.data?.items ?? [];
  const total = uploads.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 40));

  function handleFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length > 0) upload.mutate(files);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <>
      <div className="admin-head">
        <h1>فایل‌ها و تصاویر</h1>
        <span className="badge">{formatNumber(total)} فایل</span>
      </div>

      <div className="filters-bar">
        <label htmlFor="up-kind" className="muted">دسته آپلود</label>
        <select id="up-kind" className="select" style={{ width: 'auto' }} value={kind} onChange={(e) => setKind(e.target.value as UploadKind)}>
          {UPLOAD_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <label htmlFor="up-filter" className="muted">نمایش</label>
        <select
          id="up-filter"
          className="select"
          style={{ width: 'auto' }}
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as UploadKind | 'all');
            setPage(1);
          }}
        >
          <option value="all">همه</option>
          {UPLOAD_KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      <div
        className={`dropzone${dragging ? ' drag' : ''}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
        }}
      >
        {upload.isPending ? (
          <b>در حال آپلود…</b>
        ) : (
          <>
            <b>فایل‌ها را اینجا رها کنید یا کلیک کنید</b>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              تصاویر (JPG, PNG, WebP, GIF, AVIF) و PDF — تصاویر خودکار به WebP فشرده و بندانگشتی می‌شوند.
            </div>
          </>
        )}
      </div>

      <input ref={fileRef} type="file" hidden multiple accept="image/*,application/pdf" onChange={(e) => handleFiles(e.target.files)} />

      {uploads.isLoading ? (
        <div className="skeleton" style={{ height: 260 }} />
      ) : items.length === 0 ? (
        <div className="card empty">هنوز فایلی آپلود نشده است.</div>
      ) : (
        <div className="upload-grid">
          {items.map((u) => (
            <div className="upload-tile" key={u.id}>
              {u.mimeType === 'application/pdf' ? (
                <a
                  href={u.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'grid', placeItems: 'center', aspectRatio: '1', background: 'var(--surface-2)', fontSize: 30 }}
                >
                  📄
                </a>
              ) : (
                <a href={u.url} target="_blank" rel="noreferrer">
                  <img src={u.thumbUrl || u.url} alt={u.originalName} loading="lazy" />
                </a>
              )}
              <div className="actions">
                <button
                  type="button"
                  className="btn sm"
                  title="کپی آدرس"
                  onClick={() => {
                    void navigator.clipboard.writeText(u.url).then(
                      () => toast.ok('آدرس کپی شد.'),
                      () => toast.error('کپی ممکن نشد.'),
                    );
                  }}
                >
                  کپی
                </button>
                <button
                  type="button"
                  className="btn sm danger"
                  title="حذف"
                  onClick={() => {
                    if (confirm('این فایل برای همیشه حذف شود؟')) remove.mutate(u.id);
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="meta" title={u.originalName}>
                {u.originalName}
                <div className="faint">
                  {KIND_LABELS[u.kind]} · {humanSize(u.size)}
                  {u.width ? ` · ${u.width}×${u.height}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="pager">
          <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</button>
          <span className="muted">صفحه {formatNumber(page)} از {formatNumber(pageCount)}</span>
          <button type="button" className="btn" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>بعدی</button>
        </div>
      )}
    </>
  );
}
