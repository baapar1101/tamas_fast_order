import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { UploadDTO, UploadKind } from '@tamas/shared';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';

interface Props {
  label: string;
  value: string;
  kind: UploadKind;
  onChange: (url: string) => void;
}

/**
 * A URL field with an upload button attached. Uploading returns the stored
 * URL and writes it straight into the field, so an editor never has to leave
 * the form to add a picture.
 */
export function ImagePicker({ label, value, kind, onChange }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);
      const res = await api.upload<{ uploads: UploadDTO[] }>('/admin/uploads', form);
      const uploaded = res.uploads[0];
      if (uploaded) {
        onChange(uploaded.url);
        toast.ok('تصویر آپلود شد.');
        void qc.invalidateQueries({ queryKey: ['admin', 'uploads'] });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'آپلود ناموفق بود.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-400">{label}</label>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {value && (
          <img
            src={value}
            alt=""
            className="h-12 w-12 rounded-lg object-cover bg-slate-900 border border-white/[0.06] shrink-0 mx-auto sm:mx-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
            }}
          />
        )}
        <input
          className="huma-input flex-1 w-full sm:min-w-[200px] text-left font-mono"
          dir="ltr"
          placeholder="/uploads/… یا آدرس کامل تصویر"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button type="button" className="huma-btn-secondary flex-1 sm:flex-none justify-center" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? '…' : 'آپلود'}
          </button>
          {value && (
            <button type="button" className="huma-btn-secondary !bg-rose-500/15 !text-rose-300 !px-3 shrink-0" onClick={() => onChange('')} aria-label="حذف تصویر">
              ✕
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void upload(e.target.files)}
      />
    </div>
  );
}
