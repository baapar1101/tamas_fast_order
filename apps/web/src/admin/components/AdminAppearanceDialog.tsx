import type { ReactNode } from 'react';
import { ADMIN_BACKGROUND_PRESETS, type AdminBackground } from '@tamas/shared';
import { Modal } from '../../components/Modal';
import {
  GLASS_LEVELS,
  setAdminAppearance,
  useAdminAppearance,
  type AdminDensity,
  type AdminSkin,
  type AdminThemePref,
} from '../appearance';
import { lensSupported } from '../lens';
import './admin-appearance.css';

const fa = (n: number) => n.toLocaleString('fa-IR');

const THEMES: { id: AdminThemePref; label: string; icon: string }[] = [
  { id: 'light', label: 'روشن', icon: 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z' },
  { id: 'system', label: 'سیستم', icon: 'M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z' },
  { id: 'dark', label: 'تیره', icon: 'M21.752 15.002A9.718 9.718 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z' },
];

function Section({ icon, title, hint, children }: { icon: string; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="a-card admin-appearance__section">
      <h3 className="admin-appearance__title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        {title}
      </h3>
      {children}
      {hint && <p className="a-hint">{hint}</p>}
    </section>
  );
}

function Segments<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { id: T; label: string; icon?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="a-segmented admin-appearance__seg" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          className={`a-seg${value === option.id ? ' a-seg--on' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.icon && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={option.icon} />
            </svg>
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function LevelSlider({ label, value, low, high, disabled, onChange }: {
  label: string;
  value: number;
  low: string;
  high: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="admin-appearance__slider">
      <span className="admin-appearance__slider-head">
        <span>{label}</span>
        <span className="admin-appearance__value">{fa(value)} از {fa(GLASS_LEVELS)}</span>
      </span>
      <input
        type="range"
        min={1}
        max={GLASS_LEVELS}
        step={1}
        value={value}
        disabled={disabled}
        aria-valuetext={`${fa(value)} از ${fa(GLASS_LEVELS)}`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="admin-appearance__ends" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </span>
    </label>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  background: AdminBackground;
  onPickBackground: () => void;
}

/** «ظاهر پنل»: theme, density, skin, background and glass. Each choice applies and saves at once. */
export function AdminAppearanceDialog({ open, onClose, background, onPickBackground }: Props) {
  const appearance = useAdminAppearance();
  const glass = appearance.skin === 'glass';
  const backgroundLabel =
    background.mode === 'animated'
      ? 'دود متحرک'
      : background.mode === 'image'
        ? 'عکس خودم'
        : ADMIN_BACKGROUND_PRESETS.find((preset) => preset.id === background.preset)?.label ?? '';
  const summary = [
    glass ? 'پوستهٔ شیشه‌ای' : 'پوستهٔ ساده',
    appearance.density === 'compact' ? 'تراکم فشرده' : 'تراکم معمولی',
    `پس‌زمینهٔ ${backgroundLabel}`,
  ].join(' · ');

  return (
    <Modal
      open={open}
      size="lg"
      title="ظاهر پنل"
      onClose={onClose}
      footer={
        <button type="button" className="a-btn a-btn--primary" onClick={onClose}>
          بستن
        </button>
      }
    >
      <div className="admin-appearance">
        <p className="admin-appearance__lead">
          ظاهر پنل فقط برای خودتان روی همین مرورگر: تم، تراکم، پوسته و پس‌زمینه. هر انتخاب همان لحظه ذخیره می‌شود.
        </p>
        <p className="admin-appearance__summary">{summary}</p>

        <Section icon="M12 3v2.25M12 18.75V21M3 12h2.25M18.75 12H21M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" title="تم" hint={appearance.theme === 'system' ? 'از تنظیمات دستگاه پیروی می‌کند.' : undefined}>
          <Segments label="تم" value={appearance.theme} options={THEMES} onChange={(theme) => setAdminAppearance({ theme })} />
        </Section>

        <Section icon="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" title="تراکم" hint="«فشرده» روی دسکتاپ سطرهای بیشتری را در یک صفحه جا می‌دهد.">
          <Segments<AdminDensity>
            label="تراکم"
            value={appearance.density}
            options={[{ id: 'normal', label: 'معمولی' }, { id: 'compact', label: 'فشرده' }]}
            onChange={(density) => setAdminAppearance({ density })}
          />
        </Section>

        <Section
          icon="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3"
          title="پوسته"
          hint={glass ? 'همهٔ صفحه‌ها، منو، فرم‌ها، دکمه‌ها و ویجت‌ها شیشه‌ای می‌شوند و پس‌زمینه پشت همه‌جا دیده می‌شود.' : 'سطح‌های مات و یکدست، بدون پس‌زمینهٔ پیدا.'}
        >
          <div className="admin-appearance__skins" role="radiogroup" aria-label="پوسته">
            {(['plain', 'glass'] as AdminSkin[]).map((skin) => (
              <button
                key={skin}
                type="button"
                role="radio"
                aria-checked={appearance.skin === skin}
                className={`admin-appearance__skin admin-appearance__skin--${skin}${appearance.skin === skin ? ' is-active' : ''}`}
                onClick={() => setAdminAppearance({ skin })}
              >
                <span className="admin-appearance__skin-preview" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                {skin === 'glass' ? 'شیشه‌ای' : 'ساده'}
              </button>
            ))}
          </div>
        </Section>

        <Section icon="m2.25 15.75 5.16-5.16a2.25 2.25 0 0 1 3.18 0l5.16 5.16m-1.5-1.5 1.41-1.41a2.25 2.25 0 0 1 3.18 0l2.91 2.91M3.75 21h16.5A1.5 1.5 0 0 0 21.75 19.5V4.5A1.5 1.5 0 0 0 20.25 3H3.75A1.5 1.5 0 0 0 2.25 4.5v15A1.5 1.5 0 0 0 3.75 21Z" title="پس‌زمینه" hint="پس‌زمینه به حساب شما ذخیره می‌شود و در همهٔ دستگاه‌ها همراهتان می‌ماند.">
          <div className="admin-appearance__background">
            <span className="admin-appearance__background-name">{backgroundLabel}</span>
            <button type="button" className="a-btn a-btn--secondary" onClick={onPickBackground}>
              تغییر پس‌زمینه
            </button>
          </div>
        </Section>

        <Section icon="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" title="شیشه" hint={glass ? undefined : 'برای تنظیم شیشه، پوستهٔ «شیشه‌ای» را انتخاب کنید.'}>
          <LevelSlider label="مات بودن شیشه" value={appearance.frost} low="خیلی کم" high="کامل" disabled={!glass} onChange={(frost) => setAdminAppearance({ frost })} />
          <LevelSlider label="رنگ شیشه" value={appearance.tint} low="شیشه‌ای‌تر" high="رنگ پوسته" disabled={!glass} onChange={(tint) => setAdminAppearance({ tint })} />
          <p className="a-hint">رنگ صفحه‌ها، فرم‌ها و منوها: به سمت {fa(10)} رنگ پیش‌فرض پوستهٔ تیره یا روشن، به سمت {fa(1)} شیشهٔ شفاف.</p>
          <div className="admin-appearance__switch-row">
            <span>
              <strong>اعوجاج شیشه</strong>
              <small>{lensSupported() ? 'لبهٔ شیشه آنچه پشتش است را موج می‌دهد.' : 'این مرورگر از اعوجاج شیشه پشتیبانی نمی‌کند؛ فقط در کروم و اج دیده می‌شود.'}</small>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={appearance.bend}
              aria-label="اعوجاج شیشه"
              disabled={!glass}
              className={`admin-switch${appearance.bend ? ' is-on' : ''}`}
              onClick={() => setAdminAppearance({ bend: !appearance.bend })}
            >
              <span />
            </button>
          </div>
        </Section>
      </div>
    </Modal>
  );
}
