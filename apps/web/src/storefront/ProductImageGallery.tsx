import { memo, useState } from 'react';
import { useImageFallback } from '../lib/images';

interface Props {
  images: string[];
  title: string;
  mode: 'grid' | 'list';
  onPreview: (url: string) => void;
}

function areProductImageGalleryPropsEqual(previous: Props, next: Props): boolean {
  const keys = Object.keys(previous) as Array<keyof Props>;
  if (keys.length !== Object.keys(next).length) return false;
  for (const key of keys) {
    if (key !== 'images' && previous[key] !== next[key]) return false;
  }

  if (previous.images === next.images) return true;
  if (previous.images.length !== next.images.length) return false;
  for (let i = 0; i < previous.images.length; i++) {
    if (previous.images[i] !== next.images[i]) return false;
  }
  return true;
}

export const ProductImageGallery = memo(function ProductImageGallery({ images, title, mode, onPreview }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0] ?? '/logo.png';
  return (
    <div className={`catalog-image-gallery catalog-image-gallery--${mode}`}>
      <button type="button" className="catalog-image-gallery__hero" onClick={() => onPreview(active)} aria-label={`نمایش بزرگ تصویر ${title}`}>
        <img className={mode === 'grid' ? 'card-thumb' : 'product-thumb'} src={active} alt={title} loading="lazy" decoding="async" onError={useImageFallback} />
      </button>
      {images.length > 1 ? (
        <div className="catalog-image-gallery__thumbs" aria-label={`تمام تصاویر ${title}`}>
          {images.map((image, index) => (
            <button key={image} type="button" className={`catalog-image-gallery__thumb${index === activeIndex ? ' is-active' : ''}`} onClick={() => setActiveIndex(index)} aria-label={`تصویر ${index + 1} از ${images.length}`}>
              <img src={image} alt="" loading="lazy" decoding="async" onError={useImageFallback} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}, areProductImageGalleryPropsEqual);
