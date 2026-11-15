import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FESTIVAL_EFFECT_LABELS,
  formatNumber,
  isoToTehranJalali,
  tehranJalaliToIso,
  type FestivalConfig,
  type FestivalEffects,
  type FestivalMode,
  type FestivalStatus,
} from '@tamas/shared';
import { api } from '../../lib/api';
import { resolveImageUrl } from '../../lib/images';
import { useToast } from '../../components/Toast';

type SlideRow = { id: number; title: string | null; imageUrl: string; isActive: boolean };
type Loaded = { config: FestivalConfig; status: FestivalStatus; festivalProducts: number; slides: SlideRow[] };

const MODE_LABELS: Record<FestivalMode, string> = { off: 'خاموش', on: 'روشن', scheduled: 'زمان‌بندی خودکار' };
const EFFECT_KEYS = Object.keys(FESTIVAL_EFFECT_LABELS) as Array<keyof FestivalEffects>;

/** «۲۹ آبان ۱۴۰۵، ساعت ۱۸:۰۰» for a status line. */
function formatMoment(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: 'Asia/Tehran', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso));
}

function statusLine(status: FestivalStatus): { text: string; badge: string } {
  switch (status.phase) {
    case 'on': return { text: 'جشنواره روشن است.', badge: 'a-badge a-badge--green' };
    case 'running': return { text: `جشنواره در جریان است و ${formatMoment(status.endsAt)} خودکار خاموش می‌شود.`, badge: 'a-badge a-badge--green' };
    case 'upcoming': return { text: `جشنواره ${formatMoment(status.startsAt)} خودکار روشن می‌شود.`, badge: 'a-badge a-badge--amber' };
    case 'ended': return { text: `زمان جشنواره ${formatMoment(status.endsAt)} تمام شده است.`, badge: 'a-badge a-badge--neutral' };
    default: return { text: 'جشنواره خاموش است.', badge: 'a-badge a-badge--neutral' };
  }
}

/** One side of the schedule: a Jalali date and a time, both Tehran time. */
function MomentInput({ id, label, value, onChange }: { id: string; label: string; value: { date: string; time: string }; onChange: (next: { date: string; time: string }) => void }) {
  const invalid = Boolean(value.date || value.time) && !tehranJalaliToIso(value.date, value.time);
  return (
    <div className="a-field">
      <label className="a-label" htmlFor={`${id}-date`}>{label}</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id={`${id}-date`}
          className="a-input a-ltr"
          placeholder="1405/08/29"
          inputMode="numeric"
          value={value.date}
          aria-invalid={invalid}
          onChange={(event) => onChange({ ...value, date: event.target.value })}
        />
        <input
          className="a-input a-ltr"
          type="time"
          aria-label={`${label} — ساعت`}
          style={{ maxWidth: 130 }}
          value={value.time}
          onChange={(event) => onChange({ ...value, time: event.target.value })}
        />
      </div>
      <span className="a-hint" style={invalid ? { color: 'var(--a-red, #dc2626)' } : undefined}>
        {invalid ? 'تاریخ شمسی را به شکل ۱۴۰۵/۰۸/۲۹ و ساعت را کامل وارد کنید.' : 'تاریخ شمسی و ساعت به وقت تهران'}
      </span>
    </div>
  );
}

/**
 * Settings → Festival: switch the festival on or off, or let it run on a
 * schedule, and choose what it changes in the store.
 */
export function FestivalSettings() {
  const toast = useToast();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'festival'], queryFn: () => api.get<Loaded>('/admin/festival') });
  const [config, setConfig] = useState<FestivalConfig | null>(null);
  const [saved, setSaved] = useState('');
  const [start, setStart] = useState({ date: '', time: '' });
  const [end, setEnd] = useState({ date: '', time: '' });

  useEffect(() => {
    if (!query.data || config) return;
    setConfig(query.data.config);
    setSaved(JSON.stringify(query.data.config));
    setStart(isoToTehranJalali(query.data.config.startsAt) ?? { date: '', time: '18:00' });
    setEnd(isoToTehranJalali(query.data.config.endsAt) ?? { date: '', time: '23:59' });
  }, [query.data, config]);

  const draft = useMemo<FestivalConfig | null>(() => {
    if (!config) return null;
    return { ...config, startsAt: tehranJalaliToIso(start.date, start.time), endsAt: tehranJalaliToIso(end.date, end.time) };
  }, [config, start, end]);

  const save = useMutation({
    mutationFn: (next: FestivalConfig) => api.put<{ config: FestivalConfig; status: FestivalStatus; message: string }>('/admin/festival', next),
    onSuccess: (data) => {
      setConfig(data.config);
      setSaved(JSON.stringify(data.config));
      qc.setQueryData<Loaded>(['admin', 'festival'], (old) => (old ? { ...old, config: data.config, status: data.status } : old));
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void qc.invalidateQueries({ queryKey: ['bootstrap'] });
      toast.ok(data.message);
    },
    onError: (err: Error) => toast.error(err.message || 'ذخیرهٔ جشنواره ناموفق بود.'),
  });

  if (query.isError) return <div className="a-alert a-alert--error">دریافت تنظیمات جشنواره ناموفق بود.</div>;
  if (!config || !draft || !query.data) return <div className="a-card"><div className="a-skeleton a-skeleton--text" /></div>;

  const scheduleError = config.mode === 'scheduled'
    ? !draft.startsAt || !draft.endsAt ? 'زمان شروع و پایان را کامل وارد کنید.'
      : Date.parse(draft.endsAt) <= Date.parse(draft.startsAt) ? 'زمان پایان باید بعد از زمان شروع باشد.' : ''
    : '';
  const toSave: FestivalConfig = config.mode === 'scheduled' ? draft : { ...config, startsAt: draft.startsAt, endsAt: draft.endsAt };
  const dirty = JSON.stringify(toSave) !== saved;
  const status = query.data.status;
  const line = statusLine(status);
  const setEffect = (key: keyof FestivalEffects, value: boolean) => setConfig({ ...config, effects: { ...config.effects, [key]: value } });
  const toggleSlide = (id: number) => setConfig({
    ...config,
    festivalSlideIds: config.festivalSlideIds.includes(id) ? config.festivalSlideIds.filter((value) => value !== id) : [...config.festivalSlideIds, id],
  });
  const bannersMatter = config.effects.festivalBanners || config.effects.hideOtherBanners;

  return (
    <>
      <section className="a-card">
        <div className="a-card-head a-card-head--split">
          <div>
            <h3 className="a-card-title">جشنواره</h3>
            <p className="a-card-desc">جشنواره را دستی روشن و خاموش کنید یا برایش زمان شروع و پایان بگذارید تا خودکار اجرا شود.</p>
          </div>
          <span className={line.badge}>{status.active ? 'فعال' : 'غیرفعال'}</span>
        </div>
        <p className="a-note" style={{ marginBottom: 16 }}>{line.text}{dirty && ' (تغییرات هنوز ذخیره نشده‌اند.)'}</p>

        <div className="a-field">
          <span className="a-label">وضعیت</span>
          <div className="a-segmented" role="group" aria-label="وضعیت جشنواره">
            {(Object.keys(MODE_LABELS) as FestivalMode[]).map((mode) => (
              <button key={mode} type="button" className={`a-seg ${config.mode === mode ? 'a-seg--on' : ''}`} aria-pressed={config.mode === mode} onClick={() => setConfig({ ...config, mode })}>
                {MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        <div className="a-form-grid a-cols--2" style={{ marginTop: 12 }}>
          <div className="a-field">
            <label className="a-label" htmlFor="festival-title">نام جشنواره</label>
            <input id="festival-title" className="a-input" maxLength={80} value={config.title} onChange={(event) => setConfig({ ...config, title: event.target.value })} />
            <span className="a-hint">برای شناختن جشنواره در پنل و گزارش تغییرات.</span>
          </div>
        </div>

        {config.mode === 'scheduled' && (
          <div className="a-form-grid a-cols--2" style={{ marginTop: 12 }}>
            <MomentInput id="festival-start" label="شروع" value={start} onChange={setStart} />
            <MomentInput id="festival-end" label="پایان" value={end} onChange={setEnd} />
          </div>
        )}
        {scheduleError && <div className="a-alert a-alert--error" style={{ marginTop: 12 }}>{scheduleError}</div>}
      </section>

      <section className="a-card">
        <div className="a-card-head">
          <div>
            <h3 className="a-card-title">در زمان جشنواره چه اتفاقی بیفتد؟</h3>
            <p className="a-card-desc">هر مورد را که تیک بزنید، فقط وقتی جشنواره روشن است اعمال می‌شود.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {EFFECT_KEYS.map((key) => (
            <label key={key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" style={{ marginTop: 4 }} checked={config.effects[key]} onChange={(event) => setEffect(key, event.target.checked)} />
              <span>
                <span style={{ display: 'block', fontWeight: 600 }}>{FESTIVAL_EFFECT_LABELS[key].label}</span>
                <span className="a-hint">{FESTIVAL_EFFECT_LABELS[key].hint}</span>
                {key === 'onlyFestivalProducts' && (
                  <span className="a-hint" style={{ display: 'block' }}>
                    اکنون {formatNumber(query.data.festivalProducts)} کالای فعال «کالای جشنواره» است. این علامت را در <Link to="/admin/products">ویرایش کالا</Link> یا ستون «کالای جشنواره» ایمپورت اکسل بزنید.
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </section>

      {bannersMatter && (
        <section className="a-card">
          <div className="a-card-head">
            <div>
              <h3 className="a-card-title">بنرهای جشنواره</h3>
              <p className="a-card-desc">بنرهایی را که مخصوص جشنواره‌اند تیک بزنید. بنرها را در بخش <Link to="/admin/slides">اسلایدها</Link> بسازید؛ بنر غیرفعال هیچ‌وقت نمایش داده نمی‌شود.</p>
            </div>
          </div>
          {query.data.slides.length === 0 ? <p className="a-hint">هنوز بنری ساخته نشده است.</p> : (
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {query.data.slides.map((slide) => {
                const checked = config.festivalSlideIds.includes(slide.id);
                return (
                  <label key={slide.id} style={{ display: 'grid', gap: 6, cursor: 'pointer', opacity: slide.isActive ? 1 : 0.55 }}>
                    <img src={resolveImageUrl(slide.imageUrl)} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '4 / 1', objectFit: 'cover', borderRadius: 10, outline: checked ? '2px solid var(--a-brand)' : '1px solid var(--a-border, rgba(127,127,127,.25))' }} />
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleSlide(slide.id)} />
                      <span>{slide.title || `بنر ${formatNumber(slide.id)}`}{!slide.isActive && ' (غیرفعال)'}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="a-btn a-btn--primary" disabled={!dirty || save.isPending || Boolean(scheduleError)} onClick={() => save.mutate(toSave)}>
          {save.isPending ? 'در حال ذخیره…' : dirty ? 'ذخیرهٔ جشنواره' : 'ذخیره شده'}
        </button>
      </div>
    </>
  );
}
