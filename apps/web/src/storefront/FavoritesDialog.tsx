import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { resolveImageUrl } from '../lib/images';
import { useFavorites } from '../store/favorites';
import './shopping-flow.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function FavoritesDialog({ open, onClose }: Props) {
  const items = useFavorites((state) => state.items);
  const remove = useFavorites((state) => state.remove);

  return (
    <Modal open={open} onClose={onClose} title="علاقه‌مندی‌ها" size="sm">
      {items.length === 0 ? (
        <p className="fav-empty">
          هنوز کالایی را نشان نکرده‌اید.
          <br />
          با زدن قلب روی هر کالا، آن را اینجا نگه دارید.
        </p>
      ) : (
        <ul className="fav-list">
          {items.map((item) => (
            <li key={item.productId}>
              <img src={resolveImageUrl(item.imageUrl)} alt="" loading="lazy" />
              <Link to={`/p/${encodeURIComponent(item.productId)}`} onClick={onClose}>{item.title}</Link>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => remove(item.productId)}
                aria-label={`حذف ${item.title} از علاقه‌مندی‌ها`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
