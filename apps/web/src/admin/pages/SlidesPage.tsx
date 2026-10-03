import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { ImagePicker } from '../components/ImagePicker';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface Slide {
  id: number;
  title: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SlideForm {
  title: string;
  imageUrl: string;
  mobileImageUrl: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: SlideForm = {
  title: '',
  imageUrl: '',
  mobileImageUrl: '',
  linkUrl: '',
  sortOrder: 0,
  isActive: true,
};

export function SlidesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<SlideForm>(EMPTY_FORM);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [deleteTarget, setDeleteTarget] = useState<Slide | null>(null);

  const { data: slides = [], isLoading } = useQuery<Slide[]>({
    queryKey: ['admin', 'slides'],
    queryFn: () => api.get('/admin/slides'),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'slides'] });
    void queryClient.invalidateQueries({ queryKey: ['bootstrap'] });
  };

  const saveMutation = useMutation({
    mutationFn: (data: SlideForm) => editingId ? api.put(`/admin/slides/${editingId}`, data) : api.post('/admin/slides', data),
    onSuccess: () => {
      toast.ok(editingId ? 'بنر به‌روزرسانی شد.' : 'بنر اضافه شد.');
      refresh();
      closeForm();
    },
    onError: (err: Error) => toast.error(err.message || 'خطا در ذخیره بنر'),
  });

  const toggleMutation = useMutation({
    mutationFn: (slide: Slide) => api.put(`/admin/slides/${slide.id}`, {
      title: slide.title || '',
      imageUrl: slide.imageUrl,
      mobileImageUrl: slide.mobileImageUrl || '',
      linkUrl: slide.linkUrl || '',
      sortOrder: slide.sortOrder,
      isActive: !slide.isActive,
    }),
    onSuccess: () => {
      toast.ok('وضعیت نمایش بنر تغییر کرد.');
      refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/admin/slides/${id}`),
    onSuccess: () => {
      toast.ok('بنر حذف شد.');
      setDeleteTarget(null);
      refresh();
    },
    onError: (err: Error) => toast.error(err.message || 'خطا در حذف بنر'),
  });

  function openEditor(slide?: Slide) {
    if (slide) {
      setEditingId(slide.id);
      setFormData({
        title: slide.title || '',
        imageUrl: slide.imageUrl,
        mobileImageUrl: slide.mobileImageUrl || '',
        linkUrl: slide.linkUrl || '',
        sortOrder: slide.sortOrder,
        isActive: slide.isActive,
      });
    } else {
      setEditingId(null);
      setFormData({ ...EMPTY_FORM, sortOrder: (slides[0]?.sortOrder ?? 0) + 10 });
    }
    setPreviewDevice('desktop');
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormOpen(false);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!formData.imageUrl.trim()) {
      toast.error('تصویر دسکتاپ بنر الزامی است.');
      return;
    }
    saveMutation.mutate(formData);
  }

  const previewImage = previewDevice === 'mobile' ? formData.mobileImageUrl || formData.imageUrl : formData.imageUrl;

  return (
    <div className="a-page a-fade slides-admin-page">
      <section className="a-page-head">
        <div className="a-titles">
          <h2 className="a-title">مدیریت بنرهای فروشگاه</h2>
          <p className="a-subtitle">تصاویر، لینک، ترتیب و نمایش دسکتاپ و موبایل اسلایدر صفحه اصلی</p>
        </div>
        <div className="a-page-actions">
          <span className="a-badge a-badge--neutral">{slides.length} بنر</span>
          <button type="button" className="a-btn a-btn--primary" onClick={() => openEditor()}>+ افزودن بنر</button>
        </div>
      </section>

      {formOpen && (
        <form className="a-form a-form--wide a-fade" onSubmit={handleSubmit}>
          <div className="a-form-head">
            <button type="button" className="a-form-back" onClick={closeForm} aria-label="بازگشت" title="بازگشت">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
            </button>
            <div className="a-form-title">
              {editingId ? 'ویرایش بنر' : 'افزودن بنر جدید'}
              {editingId && <span className="a-badge a-badge--neutral">#{editingId}</span>}
            </div>
            <div className="a-form-actions">
              <button type="button" className="a-btn a-btn--secondary" onClick={closeForm}>انصراف</button>
              <button type="submit" className="a-btn a-btn--primary" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'در حال ذخیره…' : 'ذخیره بنر'}
              </button>
            </div>
          </div>

          <div className="slides-editor-grid">
            <div className="slides-editor-fields">
              <section className="a-card">
                <div className="a-card-head">
                  <div>
                    <h3 className="a-card-title">محتوا و مقصد بنر</h3>
                    <p className="a-card-sub">عنوان برای متن جایگزین و دسترس‌پذیری استفاده می‌شود.</p>
                  </div>
                </div>
                <div className="a-form-grid">
                  <div className="a-field">
                    <label className="a-label" htmlFor="slide-title">عنوان بنر</label>
                    <input id="slide-title" className="a-input" value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} placeholder="مثال: جدیدترین گوشی‌های اپل" />
                  </div>
                  <div className="a-field">
                    <label className="a-label" htmlFor="slide-link">لینک مقصد</label>
                    <input id="slide-link" className="a-input a-ltr" value={formData.linkUrl} onChange={(event) => setFormData({ ...formData, linkUrl: event.target.value })} placeholder="/?brand=Apple یا https://…" dir="ltr" />
                  </div>
                  <div className="a-field">
                    <label className="a-label" htmlFor="slide-order">اولویت نمایش</label>
                    <input id="slide-order" type="number" className="a-input a-ltr" value={formData.sortOrder} onChange={(event) => setFormData({ ...formData, sortOrder: Number(event.target.value) || 0 })} />
                    <span className="a-hint">عدد بزرگ‌تر زودتر نمایش داده می‌شود.</span>
                  </div>
                </div>
              </section>

              <section className="a-card">
                <div className="a-card-head">
                  <div>
                    <h3 className="a-card-title">تصاویر واکنش‌گرا</h3>
                    <p className="a-card-sub">دسکتاپ پیشنهادی ۳۲۰۰×۸۰۰ و موبایل پیشنهادی ۱۲۰۰×۵۲۵ پیکسل.</p>
                  </div>
                </div>
                <div className="slides-image-fields">
                  <ImagePicker label="تصویر دسکتاپ (الزامی)" value={formData.imageUrl} kind="slide" onChange={(imageUrl) => setFormData({ ...formData, imageUrl })} />
                  <ImagePicker label="تصویر موبایل (اختیاری)" value={formData.mobileImageUrl} kind="slide" onChange={(mobileImageUrl) => setFormData({ ...formData, mobileImageUrl })} />
                </div>
                <p className="a-hint mt-3">اگر تصویر موبایل انتخاب نشود، نسخه دسکتاپ با برش مرکزی نمایش داده می‌شود.</p>
              </section>

              <section className="a-card">
                <div className="a-option-row">
                  <div className="a-option-copy">
                    <div className="a-option-title">نمایش در فروشگاه</div>
                    <div className="a-option-desc">با غیرفعال‌کردن، بنر ذخیره می‌ماند اما در صفحه اصلی دیده نمی‌شود.</div>
                  </div>
                  <button type="button" role="switch" aria-checked={formData.isActive} className="a-switch" onClick={() => setFormData({ ...formData, isActive: !formData.isActive })} />
                </div>
              </section>
            </div>

            <aside className="a-card slides-live-preview">
              <div className="slides-preview-head">
                <div>
                  <h3 className="a-card-title">پیش‌نمایش زنده</h3>
                  <p className="a-card-sub">تقریب نمایش در صفحه اصلی</p>
                </div>
                <div className="slides-device-toggle" role="group" aria-label="نوع پیش‌نمایش">
                  <button type="button" className={previewDevice === 'desktop' ? 'active' : ''} onClick={() => setPreviewDevice('desktop')}>دسکتاپ</button>
                  <button type="button" className={previewDevice === 'mobile' ? 'active' : ''} onClick={() => setPreviewDevice('mobile')}>موبایل</button>
                </div>
              </div>
              <div className={`slides-preview-frame slides-preview-frame--${previewDevice}`}>
                {previewImage ? <img src={previewImage} alt={formData.title || 'پیش‌نمایش بنر'} /> : <div className="slides-preview-empty">تصویر بنر را انتخاب کنید</div>}
              </div>
              <dl className="slides-preview-meta">
                <div><dt>عنوان</dt><dd>{formData.title || 'بدون عنوان'}</dd></div>
                <div><dt>مقصد</dt><dd dir="ltr">{formData.linkUrl || 'بدون لینک'}</dd></div>
              </dl>
            </aside>
          </div>
        </form>
      )}

      <section className="a-card">
        <div className="a-card-head">
          <div>
            <h3 className="a-card-title">بنرهای صفحه اصلی</h3>
            <p className="a-card-sub">همان بنرهایی که بازدیدکننده در اسلایدر فروشگاه می‌بیند.</p>
          </div>
        </div>
        {isLoading ? (
          <div className="a-empty">در حال دریافت بنرها…</div>
        ) : slides.length === 0 ? (
          <div className="a-empty">بنری ثبت نشده است. با «افزودن بنر» اولین بنر را بسازید.</div>
        ) : (
          <div className="slides-card-grid">
            {slides.map((slide) => (
              <article key={slide.id} className={`slide-admin-card${slide.isActive ? '' : ' is-inactive'}`}>
                <div className="slide-admin-media">
                  <picture>
                    {slide.mobileImageUrl && <source media="(max-width: 520px)" srcSet={slide.mobileImageUrl} />}
                    <img src={slide.imageUrl} alt={slide.title || 'بنر فروشگاه'} loading="lazy" />
                  </picture>
                  <span className={`a-badge ${slide.isActive ? 'a-badge--green' : 'a-badge--neutral'}`}>{slide.isActive ? 'در حال نمایش' : 'غیرفعال'}</span>
                  {slide.mobileImageUrl && <span className="slide-mobile-ready">نسخه موبایل</span>}
                </div>
                <div className="slide-admin-body">
                  <div className="slide-admin-title-row">
                    <div>
                      <h4>{slide.title || 'بنر بدون عنوان'}</h4>
                      <p dir="ltr">{slide.linkUrl || 'بدون لینک'}</p>
                    </div>
                    <span className="slide-sort">اولویت {slide.sortOrder}</span>
                  </div>
                  <div className="slide-admin-actions">
                    <button type="button" className="a-btn a-btn--primary a-btn--sm" onClick={() => openEditor(slide)}>ویرایش و پیش‌نمایش</button>
                    <button type="button" className="a-btn a-btn--secondary a-btn--sm" disabled={toggleMutation.isPending} onClick={() => toggleMutation.mutate(slide)}>{slide.isActive ? 'غیرفعال‌کردن' : 'فعال‌کردن'}</button>
                    <button type="button" className="a-btn a-btn--danger a-btn--sm" onClick={() => setDeleteTarget(slide)}>حذف</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="حذف بنر"
        busy={deleteMutation.isPending}
        description={<>بنر <strong>«{deleteTarget?.title || 'بدون عنوان'}»</strong> حذف شود؟ بلافاصله از اسلایدر فروشگاه خارج خواهد شد.</>}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
