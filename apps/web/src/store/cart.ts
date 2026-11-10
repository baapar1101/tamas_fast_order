import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProductDTO, Warehouse } from '@tamas/shared';
import { trackFunnel } from '../lib/funnel';

export interface CartLine {
  /** productId + warehouse: the same item from two warehouses is two lines. */
  key: string;
  productId: string;
  title: string;
  color: string | null;
  colorCode: string | null;
  imageUrl: string | null;
  price: number;
  qty: number;
  warehouse: Warehouse;
  maxStock: number;
}

interface CartState {
  lines: CartLine[];
  /** Order note typed in the cart; carried into checkout and sent with the order. */
  note: string;
  setNote: (note: string) => void;
  add: (product: ProductDTO, warehouse: Warehouse, qty?: number) => { ok: boolean; message?: string };
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

export function stockFor(product: ProductDTO, warehouse: Warehouse): number {
  const split = product.kermanStock + product.tehranStock;
  if (split > 0) {
    if (warehouse === 'kerman') return product.kermanStock;
    if (warehouse === 'tehran') return product.tehranStock;
    return split;
  }
  return product.stock;
}

export function totalStock(product: Pick<ProductDTO, 'stock' | 'kermanStock' | 'tehranStock'>): number {
  const split = product.kermanStock + product.tehranStock;
  return split > 0 ? split : product.stock;
}

/** Match the storefront's purchase availability before exposing a product price. */
export function isProductUnavailable(product: Pick<ProductDTO, 'status' | 'stock' | 'kermanStock' | 'tehranStock'>): boolean {
  return product.status !== 'active' || totalStock(product) <= 0;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      note: '',

      setNote(note) {
        set({ note: note.slice(0, 1000) });
      },

      add(product, warehouse, qty = 1) {
        const max = stockFor(product, warehouse);
        if (max < 1) return { ok: false, message: 'موجودی این انبار به اتمام رسیده است.' };

        const key = `${product.productId}::${warehouse}`;
        const lines = [...get().lines];
        const index = lines.findIndex((l) => l.key === key);

        if (index >= 0) {
          const line = lines[index]!;
          if (line.qty + qty > max) {
            return { ok: false, message: `حداکثر موجودی این انبار ${max} عدد است.` };
          }
          lines[index] = { ...line, qty: line.qty + qty, price: product.price, maxStock: max };
        } else {
          lines.push({
            key,
            productId: product.productId,
            title: product.title,
            color: product.color,
            colorCode: product.colorCode,
            imageUrl: product.imageUrl,
            // Price is snapshotted for display only; the server re-reads it at
            // checkout, so a stale cart can never set the price.
            price: product.price,
            qty: Math.min(qty, max),
            warehouse,
            maxStock: max,
          });
        }
        set({ lines });
        trackFunnel('add_to_cart', { productId: product.productId });
        return { ok: true };
      },

      setQty(key, qty) {
        set({
          lines: get()
            .lines.map((l) => (l.key === key ? { ...l, qty: Math.max(0, Math.min(qty, l.maxStock)) } : l))
            .filter((l) => l.qty > 0),
        });
      },

      remove(key) {
        set({ lines: get().lines.filter((l) => l.key !== key) });
      },

      clear() {
        set({ lines: [], note: '' });
      },
    }),
    { name: 'tamas_cart_v2' },
  ),
);

export const cartTotal = (lines: CartLine[]): number => lines.reduce((sum, l) => sum + l.price * l.qty, 0);
export const cartCount = (lines: CartLine[]): number => lines.reduce((sum, l) => sum + l.qty, 0);
