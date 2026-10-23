import { useId, useState } from 'react';
import { api } from '../lib/api';

export function PrivateUploadField({ label, value, onChange, onBusyChange }: {
  label: string; value: string; onChange: (url: string) => void; onBusyChange?: (busy: boolean) => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="ds-field private-upload-field">
    <label className="ds-label" htmlFor={id}>{label}</label>
    <input id={id} className="ds-control" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy}
      aria-describedby={`${id}-hint`} aria-invalid={Boolean(error)}
      onChange={async (event) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (!file) return;
        setError(''); setBusy(true); onBusyChange?.(true);
        try {
          const form = new FormData(); form.append('file', file);
          const result = await api.upload<{ url: string }>('/uploads', form);
          onChange(result.url);
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'بارگذاری انجام نشد. دوباره تلاش کنید.'); }
        finally { input.value = ''; setBusy(false); onBusyChange?.(false); }
      }} />
    <span id={`${id}-hint`} className="ds-hint">فایل خصوصی است و فقط شما و مسئول مجاز پرونده به آن دسترسی دارید.</span>
    {busy && <span role="status" className="ds-hint">در حال بارگذاری…</span>}
    {error && <span role="alert" className="ds-alert ds-alert--danger">{error}</span>}
    {value.startsWith('/api/files/') && <a className="ds-button ds-button--sm" href={value} target="_blank" rel="noreferrer">مشاهده فایل بارگذاری‌شده</a>}
  </div>;
}
