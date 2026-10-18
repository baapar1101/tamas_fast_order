import { useToast } from '../../components/Toast';

export function publicProductUrl(productId: string): string {
  return `${window.location.origin}/p/${encodeURIComponent(productId)}`;
}

export function previewProductUrl(productId: string): string {
  return `${window.location.origin}/admin/preview/p/${encodeURIComponent(productId)}`;
}

export async function copyPublicProductUrl(productId: string): Promise<void> {
  await navigator.clipboard.writeText(publicProductUrl(productId));
}

export function ProductLinks({ productId, active }: { productId: string; active: boolean }) {
  const toast = useToast();
  const publicUrl = publicProductUrl(productId);

  async function copy() {
    try {
      await copyPublicProductUrl(productId);
      toast.ok('لینک نهایی محصول کپی شد.');
    } catch {
      toast.error('کپی لینک ممکن نشد.');
    }
  }

  return (
    <section className="a-card" aria-label="لینک و پیش‌نمایش محصول">
      <div className="a-card-head"><h3 className="a-card-title">لینک و پیش‌نمایش محصول</h3></div>
      <div className="product-links-panel">
        <input className="a-input a-ltr" type="text" value={publicUrl} readOnly aria-label="لینک نهایی محصول" onFocus={(event) => event.currentTarget.select()} />
        <button type="button" className="a-btn a-btn--secondary" onClick={() => void copy()}>کپی لینک</button>
        <a className="a-btn a-btn--secondary" href={previewProductUrl(productId)} target="_blank" rel="noopener noreferrer">پیش‌نمایش</a>
        {active && <a className="a-btn a-btn--secondary" href={publicUrl} target="_blank" rel="noopener noreferrer">نمایش در سایت</a>}
      </div>
      {!active && <p className="product-links-hint">این محصول غیرفعال است؛ لینک عمومی تا فعال‌سازی نمایش داده نمی‌شود، اما پیش‌نمایش برای مدیر باز است.</p>}
    </section>
  );
}
