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
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-wrap items-center justify-between gap-4 animate-fade-up">
        <div>
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">مدیریت فایل‌ها و تصاویر</h2>
          <p className="mt-1 text-xs text-slate-400">آپلود، مشاهده و مدیریت گالری تصاویر محصولات</p>
        </div>
        <div className="chip chip-brand">{formatNumber(items.length)} فایل تصویر</div>
      </section>

      {/* Upload Dropzone */}
      <section className="glass-card p-8 text-center border-2 border-dashed border-white/10 hover:border-emerald-500/40 transition-colors cursor-pointer relative">
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f);
          }}
        />
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400 mb-3">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
        </div>
        <h3 className="text-sm font-bold text-white mb-1">
          {uploading ? 'در حال آپلود تصویر...' : 'کلیک کنید یا تصویر را به این قسمت بکشید'}
        </h3>
        <p className="text-xs text-slate-500">فرمت‌های مجاز: PNG, JPG, WEBP (حداکثر ۱۵ مگابایت)</p>
      </section>

      {/* Uploads Gallery Grid */}
      <section className="glass-card p-6">
        <h3 className="text-sm font-bold text-white mb-4">گالری تصاویر آپلودشده</h3>
        {uploads.isLoading ? (
          <div className="py-12 text-center text-slate-400">در حال دریافت گالری تصاویر...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-slate-500">هیچ تصاویری هنوز بارگذاری نشده است.</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {items.map((img) => (
              <div
                key={img.id}
                className="group relative rounded-xl border border-white/[0.06] bg-[#131c2e]/60 overflow-hidden flex flex-col justify-between"
              >
                <div className="aspect-square w-full p-2 flex items-center justify-center bg-[#070b12]">
                  <img
                    src={img.url}
                    alt={img.filename}
                    className="max-h-full max-w-full object-contain rounded"
                    loading="lazy"
                  />
                </div>
                <div className="p-2 border-t border-white/[0.06] bg-[#0e1626]/80 flex items-center justify-between">
                  <span className="truncate text-[10px] text-slate-400" title={img.filename}>
                    {img.filename}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="text-[10px] text-emerald-400 hover:underline"
                      onClick={() => {
                        void navigator.clipboard.writeText(img.url);
                        toast.ok('آدرس تصویر کپی شد.');
                      }}
                      title="کپی لینک"
                    >
                      کپی
                    </button>
                    <button
                      type="button"
                      className="text-[10px] text-rose-400 hover:underline"
                      onClick={() => {
                        if (confirm('تصویر حذف شود؟')) remove.mutate(img.id);
                      }}
                      title="حذف"
                    >
                      حذف
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
