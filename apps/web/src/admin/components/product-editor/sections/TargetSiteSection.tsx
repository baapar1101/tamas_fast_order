import type { TrackingSiteDTO } from '@tamas/shared';
import { formatNumber } from '@tamas/shared';
import type { ProductForm } from '../types';
import { ProductAccordionSection } from '../ProductAccordionSection';

interface Props {
  form: ProductForm;
  trackingSites: TrackingSiteDTO[];
  setTrackingUrl: (siteId: number, url: string) => void;
}

export function TargetSiteSection({ form, trackingSites, setTrackingUrl }: Props) {
  return (
    <ProductAccordionSection
      id="pe-target-site-section"
      title="سایت‌های رهگیری قیمت و موجودی"
      description="برای هر محصول حداکثر سه لینک از سایت‌های تعریف‌شده ثبت کنید"
      summary={form.trackingLinks.length ? `${formatNumber(form.trackingLinks.length)} سایت متصل` : 'تنظیم نشده'}
      className="pe-accordion--accent"
    >
      <div className="p-4">
        {trackingSites.length === 0 ? (
          <p className="a-empty">ابتدا از بخش «سایت‌های رهگیری» حداقل یک سایت اضافه کنید.</p>
        ) : (
          <div className="a-form-grid">
            {trackingSites.map((site) => {
              const link = form.trackingLinks.find((item) => item.siteId === site.id);
              const disabled = !link && form.trackingLinks.length >= 3;
              return (
                <div className="a-field" key={site.id}>
                  <label className="a-label" htmlFor={`pe-tracking-site-${site.id}`}>
                    لینک محصول در {site.name}
                  </label>
                  <input
                    id={`pe-tracking-site-${site.id}`}
                    type="url"
                    className="a-input a-ltr"
                    placeholder={site.baseUrl ? `${site.baseUrl.replace(/\/$/, '')}/product/...` : 'https://example.com/product/...'}
                    value={link?.url ?? ''}
                    disabled={disabled}
                    onChange={(event) => setTrackingUrl(site.id, event.target.value)}
                  />
                  {disabled && <small className="a-help">حداکثر سه سایت انتخاب شده است.</small>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ProductAccordionSection>
  );
}
