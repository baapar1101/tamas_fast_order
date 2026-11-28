import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ADMIN_BACKGROUND_PRESETS,
  DEFAULT_ADMIN_BACKGROUND,
  parseAdminBackground,
  type AdminBackground,
} from '@tamas/shared';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api } from '../../lib/api';
import { SmokeyBackground } from './SmokeyBackground';
import './admin-backdrop.css';

const CACHE_KEY = 'tamas_admin_background';
const QUERY_KEY = ['admin', 'me', 'background'] as const;

function readCache(): AdminBackground | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? parseAdminBackground(raw) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(value: AdminBackground) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {}
}

/**
 * The signed-in admin's saved backdrop. The last one seen in this browser is
 * shown at once (no flash of the default) while the server copy loads.
 */
export function useAdminBackground(): AdminBackground {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<{ background: AdminBackground }>('/admin/me/background');
      writeCache(res.background);
      return res.background;
    },
    placeholderData: readCache,
    staleTime: 5 * 60_000,
  });
  return query.data ?? DEFAULT_ADMIN_BACKGROUND;
}

interface BackdropProps {
  background: AdminBackground;
  theme: 'dark' | 'light';
}

/** Fills the window behind the panel. */
export function AdminBackdrop({ background, theme }: BackdropProps) {
  if (background.mode === 'animated' || (background.mode === 'image' && !background.imageUrl)) {
    return (
      <SmokeyBackground
        className="fixed inset-0 z-0 pointer-events-auto"
        bgColor={theme === 'light' ? '#e2e8f0' : '#000000'}
        color={theme === 'light' ? '#d1d5db' : '#030b14'}
      />
    );
  }
  const sceneStyle: CSSProperties = {};
  if (background.mode === 'image') sceneStyle.backgroundImage = `url(${JSON.stringify(background.imageUrl)})`;
  if (background.blur > 0) {
    sceneStyle.filter = `blur(${background.blur}px)`;
    // Blur softens the edges inward; overscan hides the faded border.
    sceneStyle.inset = `-${background.blur * 2}px`;
  }
  return (
    <div className="admin-backdrop" aria-hidden="true">
      <div
        className={`admin-backdrop__scene ${background.mode === 'image' ? 'admin-backdrop__scene--photo' : `admin-backdrop--${background.preset}`}`}
        style={sceneStyle}
      />
      <div className="admin-backdrop__dim" style={{ opacity: background.dim / 100 }} />
    </div>
  );
}

interface PickerProps {
  open: boolean;
  onClose: () => void;
  /** Shows a choice behind the dialog before it is saved; null restores the saved one. */
  onPreview: (value: AdminBackground | null) => void;
}

/** Lets the admin pick the animated default, a built-in scene or their own photo. */
export function AdminBackgroundPicker({ open, onClose, onPreview }: PickerProps) {
  const toast = useToast();
  const qc = useQueryClient();
  const saved = useAdminBackground();
  const [draft, setDraft] = useState<AdminBackground>(saved);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setDraft(saved);
    // Reset only when the dialog opens, not on every refetch while editing.
  }, [open]);

  function update(patch: Partial<AdminBackground>) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      onPreview(next);
      return next;
    });
  }

  function close() {
    onPreview(null);
    onClose();
  }

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.upload<{ url: string }>('/admin/me/background/image', form);
      update({ mode: 'image', imageUrl: res.url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'آپلود عکس ناموفق بود.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function save(value: AdminBackground) {
    setSaving(true);
    try {
      const res = await api.put<{ background: AdminBackground }>('/admin/me/background', value);
      qc.setQueryData(QUERY_KEY, res.background);
      writeCache(res.background);
      toast.ok('پس‌زمینه ذخیره شد.');
      onPreview(null);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ذخیره پس‌زمینه ناموفق بود.');
    } finally {
      setSaving(false);
    }
  }

  const busy = uploading || saving;

  return (
    <Modal
      open={open}
      size="lg"
      title="پس‌زمینه پنل مدیریت"
      busy={busy}
      onClose={close}
      footer={
        <>
          <button type="button" className="a-btn a-btn--primary" disabled={busy} onClick={() => void save(draft)}>
            {saving ? 'در حال ذخیره…' : 'ذخیره'}
          </button>
          <button type="button" className="a-btn a-btn--secondary" disabled={busy} onClick={close}>
            انصراف
          </button>
          <button
            type="button"
            className="a-btn a-btn--ghost admin-bg-picker__reset"
            disabled={busy}
            onClick={() => void save({ ...DEFAULT_ADMIN_BACKGROUND, imageUrl: draft.imageUrl })}
          >
            بازگشت به پیش‌فرض
          </button>
        </>
      }
    >
      <div className="admin-bg-picker">
        <p className="a-hint">پس‌زمینه فقط برای حساب خودتان است و در همهٔ دستگاه‌ها همراهتان می‌ماند.</p>

        <div className="admin-bg-picker__grid" role="radiogroup" aria-label="نوع پس‌زمینه">
          <button
            type="button"
            role="radio"
            aria-checked={draft.mode === 'animated'}
            className={`admin-bg-tile${draft.mode === 'animated' ? ' is-active' : ''}`}
            onClick={() => update({ mode: 'animated' })}
          >
            <span className="admin-bg-tile__swatch admin-bg-tile__swatch--animated" />
            <span className="admin-bg-tile__label">دود متحرک</span>
          </button>

          {ADMIN_BACKGROUND_PRESETS.map((preset) => {
            const active = draft.mode === 'preset' && draft.preset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`admin-bg-tile${active ? ' is-active' : ''}`}
                onClick={() => update({ mode: 'preset', preset: preset.id })}
              >
                <span className={`admin-bg-tile__swatch admin-backdrop--${preset.id}`} />
                <span className="admin-bg-tile__label">{preset.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            role="radio"
            aria-checked={draft.mode === 'image'}
            className={`admin-bg-tile${draft.mode === 'image' ? ' is-active' : ''}`}
            disabled={uploading}
            onClick={() => (draft.imageUrl ? update({ mode: 'image' }) : fileRef.current?.click())}
          >
            {draft.imageUrl ? (
              <span className="admin-bg-tile__swatch admin-bg-tile__swatch--photo" style={{ backgroundImage: `url(${JSON.stringify(draft.imageUrl)})` }} />
            ) : (
              <span className="admin-bg-tile__swatch admin-bg-tile__swatch--empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
              </span>
            )}
            <span className="admin-bg-tile__label">{uploading ? 'در حال آپلود…' : 'عکس خودم'}</span>
          </button>
        </div>

        <div className="admin-bg-picker__upload">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            hidden
            onChange={(event) => void upload(event.target.files)}
          />
          <button type="button" className="a-btn a-btn--secondary a-btn--sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {draft.imageUrl ? 'انتخاب عکس دیگر' : 'آپلود عکس از کامپیوتر یا گوشی'}
          </button>
          <span className="a-hint">JPG، PNG یا WebP. عکس‌های افقی با کیفیت بالا بهتر جا می‌افتند.</span>
        </div>

        {draft.mode !== 'animated' && (
          <div className="admin-bg-picker__sliders">
            <label className="a-field">
              <span className="a-label">
                تیرگی برای خوانایی متن <span className="admin-bg-picker__value">{draft.dim.toLocaleString('fa-IR')}٪</span>
              </span>
              <input type="range" min={0} max={90} step={5} value={draft.dim} onChange={(event) => update({ dim: Number(event.target.value) })} />
            </label>
            <label className="a-field">
              <span className="a-label">
                محو کردن <span className="admin-bg-picker__value">{draft.blur.toLocaleString('fa-IR')}</span>
              </span>
              <input type="range" min={0} max={24} step={1} value={draft.blur} onChange={(event) => update({ blur: Number(event.target.value) })} />
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}
