import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNumber, type UploadDTO } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { absolutePhotoUrl, buildPhotoLinksWorkbook, photoNameParts, type UploadedPhoto } from '../components/photoLinks';
import './uploads-page.css';

const PER_PAGE = 48;
/** Photos sent at the same time; each one is its own request so one bad file never sinks the rest. */
const PARALLEL_UPLOADS = 3;

type KindFilter = 'product' | 'all';

interface SessionPhoto extends UploadedPhoto {
  thumbUrl: string | null;
}

interface FailedPhoto {
  fileName: string;
  message: string;
}

const loadXlsx = () => import('@e965/xlsx');
const origin = () => window.location.origin;
const today = () => new Date().toISOString().slice(0, 10);

function download(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function CopyIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  );
}

export function UploadsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<KindFilter>('product');
  const [page, setPage] = useState(1);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [session, setSession] = useState<SessionPhoto[]>([]);
  const [failed, setFailed] = useState<FailedPhoto[]>([]);

  const library = useQuery({
    queryKey: ['admin', 'uploads', kind, page],
    queryFn: () =>
      api.get<{ items: UploadDTO[]; total: number }>('/admin/uploads', {
        page,
        perPage: PER_PAGE,
        ...(kind === 'product' ? { kind: 'product' } : {}),
      }),
  });

  const copy = (text: string, message: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.ok(message),
      () => toast.error('کپی ناموفق بود؛ لینک را دستی انتخاب کنید.'),
    );
  };

  const uploadAll = async (fileList: FileList | File[] | null) => {
    const files = [...(fileList ?? [])].filter((file) => file.type.startsWith('image/'));
    if (inputRef.current) inputRef.current.value = '';
    if (!files.length) {
      toast.error('فقط فایل تصویر قابل آپلود است.');
      return;
    }
    setProgress({ done: 0, total: files.length });
    const uploaded: SessionPhoto[] = [];
    const errors: FailedPhoto[] = [];
    let next = 0;
    let done = 0;
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL_UPLOADS, files.length) }, async () => {
        while (next < files.length) {
          const file = files[next++]!;
          try {
            const form = new FormData();
            form.append('kind', 'product');
            form.append('file', file);
            const res = await api.upload<{ uploads: UploadDTO[] }>('/admin/uploads', form);
            const item = res.uploads[0];
            if (item) uploaded.push({ fileName: file.name, url: item.url, thumbUrl: item.thumbUrl });
          } catch (err) {
            errors.push({ fileName: file.name, message: err instanceof Error ? err.message : 'آپلود ناموفق بود.' });
          } finally {
            done += 1;
            setProgress({ done, total: files.length });
          }
        }
      }),
    );
    // Product by product, main photo first, then the gallery in its numbered order.
    uploaded.sort((a, b) => {
      const pa = photoNameParts(a.fileName);
      const pb = photoNameParts(b.fileName);
      return pa.code.localeCompare(pb.code, 'fa', { numeric: true }) || pa.order - pb.order;
    });
    setSession((current) => [...current, ...uploaded]);
    setFailed(errors);
    setProgress(null);
    setPage(1);
    void qc.invalidateQueries({ queryKey: ['admin', 'uploads'] });
    if (uploaded.length) toast.ok(`${formatNumber(uploaded.length)} عکس آپلود شد.`);
    if (errors.length) toast.error(`${formatNumber(errors.length)} عکس آپلود نشد.`);
  };

  const exportLinks = async (photos: UploadedPhoto[], name: string) => {
    if (!photos.length) return;
    const XLSX = await loadXlsx();
    download(buildPhotoLinksWorkbook(XLSX, photos, origin()), name);
  };

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/admin/uploads/${id}`),
    onSuccess: () => {
      toast.ok('تصویر حذف شد.');
      void qc.invalidateQueries({ queryKey: ['admin', 'uploads'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = library.data?.items ?? [];
  const total = library.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const busy = progress !== null;

  return (
    <div className="a-page a-fade uploads-page">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">فایل‌ها و رسانه</h2>
          <p className="a-subtitle">عکس کالاها را آپلود کنید و لینکشان را برای فایل اکسل ایمپورت بگیرید.</p>
        </div>
        <div className="a-page-actions">
          <Link to="/admin/product-import" className="a-btn a-btn--secondary">ایمپورت کالا با اکسل</Link>
        </div>
      </section>

      <section className="a-card up-guide">
        <div className="a-card-head">
          <h3 className="a-card-title">لینک عکس برای کالاهایی که عکس آماده ندارند</h3>
        </div>
        <ol className="up-steps">
          <li>
            <strong>نام‌گذاری:</strong> اسم هر عکس را <b>کد محصول</b> بگذارید؛ عکس‌های بیشتر همان کالا با شماره:
            <span className="up-example a-ltr">1040012345.jpg</span>
            <span className="up-example a-ltr">1040012345-2.jpg</span>
            <span className="up-example a-ltr">1040012345-3.jpg</span>
          </li>
          <li><strong>آپلود:</strong> همهٔ عکس‌ها را با هم انتخاب کنید یا داخل کادر پایین بکشید (هر عکس خودکار WebP و سبک می‌شود).</li>
          <li><strong>اکسل لینک‌ها:</strong> «دانلود اکسل لینک‌ها» را بزنید؛ برای هر کد محصول یک ردیف با ستون‌های «لینک تصویر اصلی» و «لینک تصاویر گالری» می‌گیرید.</li>
          <li><strong>در فایل ایمپورت:</strong> این دو ستون را کنار کد محصول در فایل نمونهٔ ایمپورت کپی کنید (یا با VLOOKUP روی کد محصول پر کنید) و فایل را ایمپورت کنید.</li>
        </ol>
        <p className="up-note">برای یک عکس تکی هم کافی است روی دکمهٔ کپی کنار همان عکس بزنید و لینک را در خانهٔ اکسل بچسبانید.</p>
      </section>

      <section className="a-card">
        <label
          className={`a-dropzone${over ? ' a-dropzone--over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (!busy) void uploadAll(e.dataTransfer.files);
          }}
        >
          <input ref={inputRef} type="file" accept="image/*" multiple disabled={busy} onChange={(e) => void uploadAll(e.target.files)} />
          <span className="a-dropzone-icon">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
          </span>
          <span className="a-dropzone-title">
            {busy ? `در حال آپلود ${formatNumber(progress.done)} از ${formatNumber(progress.total)}…` : 'عکس‌های کالا را انتخاب کنید یا اینجا بکشید (چند عکس با هم)'}
          </span>
          <span className="a-dropzone-hint">JPG، PNG، WebP — هر عکس حداکثر ۱۵ مگابایت</span>
          {busy && (
            <span className="up-progress" aria-hidden="true">
              <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </span>
          )}
        </label>
      </section>

      {failed.length > 0 && (
        <div className="a-alert a-alert--error">
          <strong>{formatNumber(failed.length)} عکس آپلود نشد:</strong>
          <ul className="up-failed">
            {failed.map((item) => (
              <li key={item.fileName}><span className="a-ltr">{item.fileName}</span> — {item.message}</li>
            ))}
          </ul>
        </div>
      )}

      {session.length > 0 && (
        <section className="a-card">
          <div className="a-card-head a-card-head--split">
            <div>
              <h3 className="a-card-title">عکس‌های همین نوبت ({formatNumber(session.length)})</h3>
              <p className="a-card-desc">کد محصول از اسم فایل خوانده شده است.</p>
            </div>
            <div className="up-actions">
              <button type="button" className="a-btn a-btn--primary" onClick={() => void exportLinks(session, `tamas-photo-links-${today()}.xlsx`)}>
                دانلود اکسل لینک‌ها
              </button>
              <button
                type="button"
                className="a-btn a-btn--secondary"
                onClick={() => copy(session.map((photo) => absolutePhotoUrl(photo.url, origin())).join('\n'), 'همهٔ لینک‌ها کپی شد.')}
              >
                کپی همهٔ لینک‌ها
              </button>
              <button type="button" className="a-btn a-btn--secondary" onClick={() => setSession([])}>پاک کردن فهرست</button>
            </div>
          </div>
          <div className="a-table-wrap">
            <table className="a-table up-table">
              <thead>
                <tr>
                  <th>عکس</th>
                  <th>نام فایل</th>
                  <th>کد محصول</th>
                  <th>لینک</th>
                  <th aria-label="کپی" />
                </tr>
              </thead>
              <tbody>
                {session.map((photo) => {
                  const link = absolutePhotoUrl(photo.url, origin());
                  const parts = photoNameParts(photo.fileName);
                  return (
                    <tr key={photo.url}>
                      <td><img className="up-thumb" src={photo.thumbUrl ?? photo.url} alt="" loading="lazy" /></td>
                      <td className="a-ltr">{photo.fileName}</td>
                      <td>
                        <span className="a-ltr">{parts.code}</span>
                        <span className="up-order">{parts.order === 1 ? 'عکس اصلی' : `گالری ${formatNumber(parts.order)}`}</span>
                      </td>
                      <td><span className="up-link a-ltr" title={link}>{link}</span></td>
                      <td>
                        <button type="button" className="a-icon-btn a-icon-btn--info a-icon-btn--sm" onClick={() => copy(link, 'لینک عکس کپی شد.')} title="کپی لینک">
                          <CopyIcon />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">کتابخانهٔ تصاویر</h3>
            <p className="a-card-desc">{formatNumber(total)} فایل</p>
          </div>
          <div className="up-actions">
            <div className="a-segmented" role="group" aria-label="نوع فایل">
              {(['product', 'all'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`a-seg${kind === value ? ' a-seg--on' : ''}`}
                  aria-pressed={kind === value}
                  onClick={() => {
                    setKind(value);
                    setPage(1);
                  }}
                >
                  {value === 'product' ? 'عکس کالاها' : 'همه'}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="a-btn a-btn--secondary"
              disabled={!items.length}
              onClick={() => void exportLinks(items.map((item) => ({ fileName: item.originalName, url: item.url })), `tamas-media-links-page-${page}.xlsx`)}
            >
              اکسل لینک‌های این صفحه
            </button>
          </div>
        </div>
        {library.isLoading ? (
          <div className="a-empty">در حال دریافت تصاویر…</div>
        ) : library.isError ? (
          <div className="a-empty">دریافت تصاویر ناموفق بود.</div>
        ) : items.length === 0 ? (
          <div className="a-empty">هنوز عکسی آپلود نشده است.</div>
        ) : (
          <div className="up-grid">
            {items.map((img) => {
              const link = absolutePhotoUrl(img.url, origin());
              return (
                <div key={img.id} className="up-tile">
                  <a className="up-tile-img" href={link} target="_blank" rel="noreferrer">
                    <img src={img.thumbUrl ?? img.url} alt={img.originalName} loading="lazy" />
                  </a>
                  <div className="up-tile-foot">
                    <span className="up-tile-name a-ltr" title={img.originalName}>{img.originalName}</span>
                    <button type="button" className="a-icon-btn a-icon-btn--info a-icon-btn--sm" onClick={() => copy(link, 'لینک عکس کپی شد.')} title="کپی لینک">
                      <CopyIcon />
                    </button>
                    <button
                      type="button"
                      className="a-icon-btn a-icon-btn--danger a-icon-btn--sm"
                      onClick={() => {
                        if (confirm('این عکس حذف شود؟ اگر کالایی از آن استفاده کند، عکسش خالی می‌شود.')) remove.mutate(img.id);
                      }}
                      title="حذف"
                    >
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {pages > 1 && (
          <div className="up-pager">
            <button type="button" className="a-btn a-btn--secondary a-btn--sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</button>
            <span>صفحهٔ {formatNumber(page)} از {formatNumber(pages)}</span>
            <button type="button" className="a-btn a-btn--secondary a-btn--sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>بعدی</button>
          </div>
        )}
      </section>
    </div>
  );
}
