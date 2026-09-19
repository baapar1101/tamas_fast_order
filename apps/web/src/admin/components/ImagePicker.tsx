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
  const previewUrl = value
    ? value.startsWith('http') || value.startsWith('/')
      ? value
      : kind === 'brand' || kind === 'category'
        ? `/assets/${kind}/${value}`
        : `/uploads/${value}`
    : '';

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
    <div className="a-field">
      <span className="a-label">{label}</span>
      <div className="a-image-picker-row">
        {previewUrl && (
          <img
            src={previewUrl}
            alt=""
            className="a-image-preview"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
            }}
          />
        )}
        <input
          className="a-input a-ltr a-mono flex-1 w-full sm:min-w-[200px]"
          placeholder="/uploads/… یا آدرس کامل تصویر"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button type="button" className="a-btn a-btn--secondary flex-1 sm:flex-none justify-center" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? 'در حال آپلود…' : 'آپلود'}
          </button>
          {value && (
            <button type="button" className="a-btn a-btn--danger a-btn--sm shrink-0" onClick={() => onChange('')} aria-label="حذف تصویر">
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