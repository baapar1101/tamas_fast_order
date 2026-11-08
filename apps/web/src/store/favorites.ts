import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FavoriteItem {
  productId: string;
  title: string;
  imageUrl: string | null;
  addedAt: number;
}

interface FavoritesState {
  items: FavoriteItem[];
  toggle: (item: Omit<FavoriteItem, 'addedAt'>) => boolean;
  remove: (productId: string) => void;
}

const MAX_FAVORITES = 200;

/**
 * Favourites live on this device only. A small snapshot (title + image) is
 * kept so the list renders without another catalog request; the product page
 * is still the source of truth for price and stock.
 */
export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle(item) {
        const exists = get().items.some((entry) => entry.productId === item.productId);
        if (exists) {
          set({ items: get().items.filter((entry) => entry.productId !== item.productId) });
          return false;
        }
        set({ items: [{ ...item, addedAt: Date.now() }, ...get().items].slice(0, MAX_FAVORITES) });
        return true;
      },
      remove(productId) {
        set({ items: get().items.filter((entry) => entry.productId !== productId) });
      },
    }),
    { name: 'tamas_favorites_v1' },
  ),
);
