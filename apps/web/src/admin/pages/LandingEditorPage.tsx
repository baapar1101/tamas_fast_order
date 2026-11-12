import { useEffect, useMemo, useState, type ReactNode } from 'react';
import './landing-editor.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_LANDING_CONFIG,
  LANDING_BENEFIT_ICONS,
  LANDING_FEATURED_SOURCES,
  LANDING_SECTION_LABELS,
  newLandingSection,
  type LandingBenefitIcon,
  type LandingConfig,
  type LandingFeaturedSource,
  type LandingSection,
  type LandingSectionType,
} from '@tamas/shared';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { useBootstrap } from '../../storefront/hooks';
import { ConfirmDialog } from '../components/ConfirmDialog';

const BENEFIT_ICON_LABELS: Record<LandingBenefitIcon, string> = {
  warehouse: 'انبار',
  price: 'قیمت',
  credit: 'اعتبار',
  speed: 'سرعت',
  support: 'پشتیبانی',
  shield: 'اطمینان',
  truck: 'ارسال',
  sparkles: 'ویژه',
};

const FEATURED_SOURCE_LABELS: Record<LandingFeaturedSource, string> = {
  promotion: 'کالاهای «پیشنهاد ویژه»',
  newest: 'جدیدترین کالاها',
  category: 'یک دسته‌بندی',
  brand: 'یک برند',
};

const SECTION_HINTS: Record<LandingSectionType, string> = {
  wholesale: 'کارت بزرگ و پرنور ورود به فروشگاه عمده.',
  featured: 'کالاهای موجود از فهرست واقعی فروشگاه؛ قیمت فقط برای همکار تأییدشده.',
  banners: 'همان بنرهای فعال بخش «بنرها»، به‌صورت کارت‌های بزرگ.',
  categories: 'دسته‌بندی‌های فروشگاه با تصویرشان؛ هر کارت به همان دسته می‌رود.',
  brands: 'نوار متحرک لوگوی برندها؛ هر لوگو به کالاهای همان برند می‌رود.',
  benefits: 'کارت‌های مزیت. فقط ادعای واقعی بنویسید.',
  steps: 'مراحل سفارش عمده.',
  cta: 'دعوت پایانی به خرید، پایین صفحه.',
};

const lines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);

function Field({ label, children, full = false, hint }: { label: string; children: ReactNode; full?: boolean; hint?: string }) {
  return (
    <div className={`a-field${full ? ' a-field--full' : ''}`}>
      <label className="a-label">{label}</label>
      {children}
      {hint && <p className="a-hint">{hint}</p>}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return <button type="button" role="switch" className="a-switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}

function SectionFields({ section, onChange }: { section: LandingSection; onChange: (next: LandingSection) => void }) {
  const bootstrap = useBootstrap();
  const categories = bootstrap.data?.categories ?? [];
  const brands = bootstrap.data?.brands ?? [];
  const titleField = 'title' in section && (
    <Field label="عنوان" full={section.type === 'brands'}>
      <input className="a-input" maxLength={100} value={section.title} onChange={(event) => onChange({ ...section, title: event.target.value })} />
    </Field>
  );
  const subtitleField = 'subtitle' in section && (
    <Field label="زیرعنوان">
      <input className="a-input" maxLength={200} value={section.subtitle} onChange={(event) => onChange({ ...section, subtitle: event.target.value })} />
    </Field>
  );

  switch (section.type) {
    case 'wholesale':
      return (
        <div className="a-form-grid a-cols--2">
          {titleField}
          <Field label="متن دکمه"><input className="a-input" maxLength={40} value={section.buttonLabel} onChange={(event) => onChange({ ...section, buttonLabel: event.target.value })} /></Field>
          <Field label="توضیح" full><textarea className="a-textarea" rows={2} maxLength={300} value={section.text} onChange={(event) => onChange({ ...section, text: event.target.value })} /></Field>
          <Field label="نکته‌ها (هر خط یک مورد، حداکثر ۶)" full>
            <textarea className="a-textarea" rows={3} value={section.points.join('\n')} onChange={(event) => onChange({ ...section, points: lines(event.target.value).slice(0, 6) })} />
          </Field>
        </div>
      );
    case 'featured':
      return (
        <div className="a-form-grid a-cols--2">
          {titleField}
          {subtitleField}
          <Field label="منبع کالاها">
            <select className="a-select" value={section.source} onChange={(event) => onChange({ ...section, source: event.target.value as LandingFeaturedSource, value: '' })}>
              {LANDING_FEATURED_SOURCES.map((source) => <option key={source} value={source}>{FEATURED_SOURCE_LABELS[source]}</option>)}
            </select>
          </Field>
          {section.source === 'category' && (
            <Field label="دسته‌بندی">
              <select className="a-select" value={section.value} onChange={(event) => onChange({ ...section, value: event.target.value })}>
                <option value="">انتخاب کنید…</option>
                {categories.map((category) => <option key={category.id} value={category.name}>{category.faName}</option>)}
              </select>
            </Field>
          )}
          {section.source === 'brand' && (
            <Field label="برند">
              <select className="a-select" value={section.value} onChange={(event) => onChange({ ...section, value: event.target.value })}>
                <option value="">انتخاب کنید…</option>
                {brands.map((brand) => <option key={brand.id} value={brand.name}>{brand.faName || brand.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="تعداد کالا (۴ تا ۱۲)">
            <input className="a-input a-ltr" type="number" min={4} max={12} value={section.limit} onChange={(event) => onChange({ ...section, limit: Math.min(12, Math.max(4, Number(event.target.value) || 8)) })} />
          </Field>
        </div>
      );
    case 'banners':
      return <div className="a-form-grid a-cols--2">{titleField}{subtitleField}</div>;
    case 'categories':
      return (
        <div className="a-form-grid a-cols--2">
          {titleField}
          {subtitleField}
          <Field label="تعداد دسته (۳ تا ۱۲)">
            <input className="a-input a-ltr" type="number" min={3} max={12} value={section.limit} onChange={(event) => onChange({ ...section, limit: Math.min(12, Math.max(3, Number(event.target.value) || 6)) })} />
          </Field>
        </div>
      );
    case 'brands':
      return <div className="a-form-grid a-cols--2">{titleField}</div>;
    case 'benefits':
      return (
        <div className="a-page-stack">
          <div className="a-form-grid a-cols--2">{titleField}{subtitleField}</div>
          {section.items.map((item, index) => {
            const setItem = (next: typeof item) => onChange({ ...section, items: section.items.map((current, i) => (i === index ? next : current)) });
            return (
              <div key={index} className="a-form-grid a-cols--3 landing-editor__item">
                <Field label={`آیکون مزیت ${index + 1}`}>
                  <select className="a-select" value={item.icon} onChange={(event) => setItem({ ...item, icon: event.target.value as LandingBenefitIcon })}>
                    {LANDING_BENEFIT_ICONS.map((icon) => <option key={icon} value={icon}>{BENEFIT_ICON_LABELS[icon]}</option>)}
                  </select>
                </Field>
                <Field label="عنوان"><input className="a-input" maxLength={60} value={item.title} onChange={(event) => setItem({ ...item, title: event.target.value })} /></Field>
                <Field label="توضیح"><input className="a-input" maxLength={200} value={item.text} onChange={(event) => setItem({ ...item, text: event.target.value })} /></Field>
                <button type="button" className="a-btn a-btn--danger a-btn--xs" onClick={() => onChange({ ...section, items: section.items.filter((_, i) => i !== index) })}>حذف این مزیت</button>
              </div>
            );
          })}
          {section.items.length < 6 && (
            <button type="button" className="a-btn a-btn--secondary a-btn--xs" onClick={() => onChange({ ...section, items: [...section.items, { icon: 'sparkles', title: 'مزیت جدید', text: '' }] })}>+ افزودن مزیت</button>
          )}
        </div>
      );
    case 'steps':
      return (
        <div className="a-page-stack">
          <div className="a-form-grid a-cols--2">{titleField}</div>
          {section.items.map((item, index) => {
            const setItem = (next: typeof item) => onChange({ ...section, items: section.items.map((current, i) => (i === index ? next : current)) });
            return (
              <div key={index} className="a-form-grid a-cols--3 landing-editor__item">
                <Field label={`عنوان قدم ${index + 1}`}><input className="a-input" maxLength={60} value={item.title} onChange={(event) => setItem({ ...item, title: event.target.value })} /></Field>
                <Field label="توضیح" full><input className="a-input" maxLength={200} value={item.text} onChange={(event) => setItem({ ...item, text: event.target.value })} /></Field>
                <button type="button" className="a-btn a-btn--danger a-btn--xs" onClick={() => onChange({ ...section, items: section.items.filter((_, i) => i !== index) })}>حذف این قدم</button>
              </div>
            );
          })}
          {section.items.length < 5 && (
            <button type="button" className="a-btn a-btn--secondary a-btn--xs" onClick={() => onChange({ ...section, items: [...section.items, { title: 'قدم جدید', text: '' }] })}>+ افزودن قدم</button>
          )}
        </div>
      );
    case 'cta':
      return (
        <div className="a-form-grid a-cols--2">
          {titleField}
          <Field label="متن دکمه"><input className="a-input" maxLength={40} value={section.buttonLabel} onChange={(event) => onChange({ ...section, buttonLabel: event.target.value })} /></Field>
          <Field label="توضیح" full><textarea className="a-textarea" rows={2} maxLength={260} value={section.text} onChange={(event) => onChange({ ...section, text: event.target.value })} /></Field>
        </div>
      );
  }
}

/** Admin editor for the home page landing: on/off, hero copy, and the order and content of every section. */
export function LandingEditorPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['admin', 'landing'],
    queryFn: () => api.get<{ config: LandingConfig }>('/admin/landing'),
  });
  const [config, setConfig] = useState<LandingConfig | null>(null);
  const [saved, setSaved] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [newType, setNewType] = useState<LandingSectionType>('featured');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (query.data && config === null) {
      setConfig(query.data.config);
      setSaved(JSON.stringify(query.data.config));
    }
  }, [query.data, config]);

  const dirty = useMemo(() => config !== null && JSON.stringify(config) !== saved, [config, saved]);

  const save = useMutation({
    mutationFn: (next: LandingConfig) => api.put<{ config: LandingConfig; message: string }>('/admin/landing', next),
    onSuccess: (data) => {
      setConfig(data.config);
      setSaved(JSON.stringify(data.config));
      toast.ok(data.message);
      void queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
    },
    onError: (err: Error) => toast.error(err.message || 'ذخیرهٔ صفحهٔ اصلی ناموفق بود.'),
  });

  if (query.isLoading || !config) {
    return <div className="a-page a-fade"><div className="a-card"><div className="a-skeleton a-skeleton--text" /></div></div>;
  }
  if (query.isError) {
    return <div className="a-page"><div className="a-alert a-alert--error">دریافت تنظیمات صفحهٔ اصلی ناموفق بود.</div></div>;
  }

  const setHero = (patch: Partial<LandingConfig['hero']>) => setConfig({ ...config, hero: { ...config.hero, ...patch } });
  const setSection = (index: number, next: LandingSection) =>
    setConfig({ ...config, sections: config.sections.map((section, i) => (i === index ? next : section)) });
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= config.sections.length) return;
    const sections = [...config.sections];
    [sections[index], sections[target]] = [sections[target]!, sections[index]!];
    setConfig({ ...config, sections });
  };
  const addSection = () => {
    const sectionId = `${newType}-${Date.now().toString(36)}`;
    setConfig({ ...config, sections: [...config.sections, newLandingSection(newType, sectionId)] });
    setOpenId(sectionId);
  };

  return (
    <div className="a-page a-page--form a-fade">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">صفحهٔ اصلی (لندینگ)</h2>
          <p className="a-subtitle">بخش‌های صفحهٔ اول سایت را روشن و خاموش کنید، جابه‌جا کنید و متن‌هایشان را تغییر دهید. کالاها، بنرها، دسته‌ها و برندها از خود فروشگاه می‌آیند.</p>
        </div>
        <div className="a-page-actions">
          <a className="a-btn a-btn--secondary" href="/" target="_blank" rel="noreferrer">مشاهدهٔ صفحه</a>
          <button type="button" className="a-btn a-btn--primary" disabled={!dirty || save.isPending} onClick={() => save.mutate(config)}>
            {save.isPending ? 'در حال ذخیره…' : dirty ? 'ذخیرهٔ تغییرات' : 'ذخیره شده'}
          </button>
        </div>
      </section>

      <div className="a-page-stack">
        <section className="a-card">
          <div className="a-card-head a-card-head--split">
            <div><h3 className="a-card-title">نمایش صفحهٔ اصلی</h3><p className="a-card-desc">اگر خاموش باشد، آدرس اصلی سایت مثل قبل مستقیم فروشگاه را باز می‌کند.</p></div>
            <Switch label="نمایش صفحهٔ اصلی" checked={config.enabled} onChange={(enabled) => setConfig({ ...config, enabled })} />
          </div>
          <div className="a-card-head a-card-head--split">
            <div><h3 className="a-card-title">همکاران تأییدشده مستقیم به فروشگاه بروند</h3><p className="a-card-desc">همکاری که وارد شده و حسابش تأیید است، با باز کردن سایت مستقیم به فروشگاه عمده می‌رود؛ مهمان‌ها صفحهٔ اصلی را می‌بینند.</p></div>
            <Switch label="همکاران مستقیم به فروشگاه" checked={config.partnersSkipLanding} onChange={(partnersSkipLanding) => setConfig({ ...config, partnersSkipLanding })} />
          </div>
        </section>

        <section className="a-card">
          <div className="a-card-head"><div><h3 className="a-card-title">بخش بالای صفحه</h3><p className="a-card-desc">تیتر، دکمه‌ها و بنرهای متحرک. تیتر به شکل «ابتدا + کلمهٔ چرخان + انتها» نمایش داده می‌شود.</p></div></div>
          <div className="a-form-grid a-cols--2">
            <Field label="برچسب بالای تیتر"><input className="a-input" maxLength={60} value={config.hero.badge} onChange={(event) => setHero({ badge: event.target.value })} /></Field>
            <Field label="ابتدای تیتر"><input className="a-input" maxLength={60} value={config.hero.titleBefore} onChange={(event) => setHero({ titleBefore: event.target.value })} /></Field>
            <Field label="کلمه‌های چرخان (هر خط یکی، حداکثر ۶)">
              <textarea className="a-textarea" rows={3} value={config.hero.rotatingWords.join('\n')} onChange={(event) => setHero({ rotatingWords: lines(event.target.value).slice(0, 6) })} />
            </Field>
            <Field label="انتهای تیتر"><input className="a-input" maxLength={80} value={config.hero.titleAfter} onChange={(event) => setHero({ titleAfter: event.target.value })} /></Field>
            <Field label="توضیح زیر تیتر" full><textarea className="a-textarea" rows={2} maxLength={260} value={config.hero.subtitle} onChange={(event) => setHero({ subtitle: event.target.value })} /></Field>
            <Field label="دکمهٔ اصلی (ورود به خرید عمده)"><input className="a-input" maxLength={40} value={config.hero.primaryLabel} onChange={(event) => setHero({ primaryLabel: event.target.value })} /></Field>
            <Field label="دکمهٔ دوم (ورود / ثبت‌نام)"><input className="a-input" maxLength={40} value={config.hero.secondaryLabel} onChange={(event) => setHero({ secondaryLabel: event.target.value })} /></Field>
          </div>
          <div className="a-card-head a-card-head--split mt-4">
            <div><h4 className="a-card-title">نمایش بنرها کنار تیتر</h4><p className="a-card-desc">بنرهای فعال بخش «بنرها» در قاب متحرک کنار تیتر.</p></div>
            <Switch label="نمایش بنرها کنار تیتر" checked={config.hero.showSlides} onChange={(showSlides) => setHero({ showSlides })} />
          </div>
        </section>

        <section className="a-card">
          <div className="a-card-head a-card-head--split">
            <div><h3 className="a-card-title">بخش‌ها و ترتیب نمایش</h3><p className="a-card-desc">از بالا به پایین به همین ترتیب در صفحه می‌آیند.</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="a-select" value={newType} onChange={(event) => setNewType(event.target.value as LandingSectionType)} aria-label="نوع بخش جدید">
                {(Object.keys(LANDING_SECTION_LABELS) as LandingSectionType[]).map((type) => <option key={type} value={type}>{LANDING_SECTION_LABELS[type]}</option>)}
              </select>
              <button type="button" className="a-btn a-btn--secondary" disabled={config.sections.length >= 16} onClick={addSection}>+ افزودن بخش</button>
            </div>
          </div>

          <div className="a-page-stack">
            {config.sections.length === 0 && <div className="a-empty">هیچ بخشی نیست؛ فقط بخش بالای صفحه نمایش داده می‌شود.</div>}
            {config.sections.map((section, index) => {
              const open = openId === section.id;
              return (
                <div key={section.id} className={`a-card landing-editor__section${section.enabled ? '' : ' is-off'}`}>
                  <div className="a-card-head a-card-head--split">
                    <button type="button" className="landing-editor__toggle" aria-expanded={open} onClick={() => setOpenId(open ? null : section.id)}>
                      <span className="a-badge a-badge--neutral">{index + 1}</span>
                      <span>
                        <strong>{LANDING_SECTION_LABELS[section.type]}</strong>
                        {'title' in section && section.title && <span className="a-card-desc"> — {section.title}</span>}
                        <span className="a-card-desc landing-editor__hint">{SECTION_HINTS[section.type]}</span>
                      </span>
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className="a-btn a-btn--secondary a-btn--xs" disabled={index === 0} onClick={() => move(index, -1)} aria-label="بالاتر">▲</button>
                      <button type="button" className="a-btn a-btn--secondary a-btn--xs" disabled={index === config.sections.length - 1} onClick={() => move(index, 1)} aria-label="پایین‌تر">▼</button>
                      <button type="button" className="a-btn a-btn--danger a-btn--xs" onClick={() => setConfig({ ...config, sections: config.sections.filter((_, i) => i !== index) })}>حذف</button>
                      <Switch label={`نمایش ${LANDING_SECTION_LABELS[section.type]}`} checked={section.enabled} onChange={(enabled) => setSection(index, { ...section, enabled })} />
                    </div>
                  </div>
                  {open && <SectionFields section={section} onChange={(next) => setSection(index, next)} />}
                </div>
              );
            })}
          </div>
        </section>

        <section className="a-card">
          <div className="a-card-head a-card-head--split">
            <div><h3 className="a-card-title">بازگشت به حالت پیش‌فرض</h3><p className="a-card-desc">همهٔ متن‌ها و بخش‌ها به حالت اولیه برمی‌گردند (تا ذخیره نکنید، روی سایت اعمال نمی‌شود).</p></div>
            <button type="button" className="a-btn a-btn--danger" onClick={() => setConfirmReset(true)}>بازگشت به پیش‌فرض</button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="بازگشت به حالت پیش‌فرض؟"
        description="همهٔ تغییرات این صفحه با حالت اولیه جایگزین می‌شود. بعد از آن باید «ذخیرهٔ تغییرات» را بزنید."
        confirmLabel="بله، پیش‌فرض"
        onConfirm={() => { setConfig(DEFAULT_LANDING_CONFIG); setConfirmReset(false); }}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  );
}
