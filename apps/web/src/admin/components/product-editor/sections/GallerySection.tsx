import type { ProductForm } from '../types';
import { ProductAccordionSection } from '../ProductAccordionSection';
import { ImagePicker } from '../../ImagePicker';

interface Props {
  form: ProductForm;
  set: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
}

export function GallerySection({ form, set }: Props) {
  return (
    <ProductAccordionSection
      id="pe-gallery-section"
      title="گالری تصاویر"
      description="حداکثر ۵ تصویر"
      summary={form.imageUrl || form.gallery.some(Boolean) ? `${(form.imageUrl ? 1 : 0) + form.gallery.filter(Boolean).length} تصویر` : 'بدون تصویر'}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {/* Main Image */}
        <div className="relative group">
          <ImagePicker
            label="تصویر اصلی"
            value={form.imageUrl}
            onChange={(url) => set('imageUrl', url)}
            kind="product"
          />
        </div>
        {/* Gallery Images */}
        {form.gallery.map((url, idx) => (
          <div key={idx} className="relative group pt-5">
            <ImagePicker
              label={`تصویر ${idx + 1}`}
              value={url}
              onChange={(url) => {
                const copy = [...form.gallery];
                copy[idx] = url;
                set('gallery', copy);
              }}
              kind="product"
            />
            <button
              type="button"
              onClick={() => {
                const copy = [...form.gallery];
                copy.splice(idx, 1);
                set('gallery', copy);
              }}
              className="absolute top-6 left-1 bg-rose-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg"
            >
              ✕
            </button>
          </div>
        ))}
        {form.gallery.length < 5 && (
          <div className="pt-5">
            <div className="a-dropzone a-dropzone--min flex items-center justify-center"
                  onClick={() => set('gallery', [...form.gallery, ''])}>
              <span className="a-muted text-xl">+</span>
            </div>
          </div>
        )}
      </div>
    </ProductAccordionSection>
  );
}
