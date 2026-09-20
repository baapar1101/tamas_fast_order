import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatNumber } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

interface UploadItem {
  id: number;
  filename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export function UploadsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const uploads = useQuery({
    queryKey: ['admin', 'uploads'],
    queryFn: () => api.get<{ items: UploadItem[] }>('/admin/uploads'),
  });

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<{ ok: boolean; url: string }>('/admin/uploads', fd);
      toast.ok('تصویر با موفقیت بارگذاری شد.');
      void qc.invalidateQueries({ queryKey: ['admin', 'uploads'] });
      return res.url;
    } catch (err: any) {
      toast.error(err.message || 'خطا در بارگذاری تصویر');
    } finally {
      setUploading(false);
    }
  };

  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/admin/uploads/${id}`),
    onSuccess: () => {
      toast.ok('تصویر حذف شد.');
      void qc.invalidateQueries({ queryKey: ['admin', 'uploads'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = uploads.data?.items ?? [];

  return (
    <div className="a-page a-page--uploads a-fade">
      {/* Header */}
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">مدیریت فایل‌ها و تصاویر</h2>
          <p className="a-subtitle">آپلود، مشاهده و مدیریت گالری تصاویر محصولات</p>
        </div>
        <div className="a-page-actions">
          <span className="a-badge a-badge--brand">{formatNumber(items.length)} فایل تصویر</span>
        </div>
      </section>

      {/* Upload Dropzone */}
      <section className="a-card">
        <label className="a-dropzone">
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadFile(f);
            }}
          />
          <span className="a-dropzone-icon">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
          </span>
          <span className="a-dropzone-title">
            {uploading ? 'در حال آپلود تصویر...' : 'کلیک کنید یا تصویر را به این قسمت بکشید'}
          </span>
          <span className="a-dropzone-hint">فرمت‌های مجاز: PNG, JPG, WEBP (حداکثر ۱۵ مگابایت)</span>
        </label>
      </section>

      {/* Uploads Gallery Grid */}
      <section className="a-card">
        <div className="a-card-head">
          <h3 className="a-card-title">گالری تصاویر آپلودشده</h3>
        </div>
        {uploads.isLoading ? (
          <div className="a-empty">در حال دریافت گالری تصاویر...</div>
        ) : items.length === 0 ? (
          <div className="a-empty">هیچ تصاویری هنوز بارگذاری نشده است.</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {items.map((img) => (
              <div
                key={img.id}
                className="a-card a-card--flush group flex flex-col justify-between"
              >
                <div className="a-thumb aspect-square p-2">
                  <img
                    src={img.url}
                    alt={img.filename}
                    className="max-h-full max-w-full object-contain rounded"
                    loading="lazy"
                  />
                </div>
                <div className="a-card-foot flex items-center justify-between gap-2">
                  <span className="a-muted truncate a-truncate" title={img.filename}>
                    {img.filename}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="a-icon-btn a-icon-btn--info a-icon-btn--sm"
                      onClick={() => {
                        void navigator.clipboard.writeText(img.url);
                        toast.ok('آدرس تصویر کپی شد.');
                      }}
                      title="کپی لینک"
                    >
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="a-icon-btn a-icon-btn--danger a-icon-btn--sm"
                      onClick={() => {
                        if (confirm('تصویر حذف شود؟')) remove.mutate(img.id);
                      }}
                      title="حذف"
                    >
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}