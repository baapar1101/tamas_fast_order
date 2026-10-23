import { Modal } from '../components/Modal';

/** Use the shared dialog lifecycle for keyboard, focus return, and scroll lock. */
export function ProductImagePreview({ src, onClose }: { src: string | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(src)} title="بزرگ‌نمایی تصویر محصول" onClose={onClose} size="xl">
      {src && <img className="catalog-preview-image" src={src} alt="تصویر بزرگ محصول" />}
    </Modal>
  );
}
