import type { OrderStatus, Warehouse } from '@tamas/shared';

export type InventoryQuantities = Record<Warehouse, number>;

export interface InventoryAllocation {
  allocation: InventoryQuantities;
  available: InventoryQuantities;
}

/** Map a logical warehouse request to the stock buckets that physically hold it. */
export function allocateInventory(
  levels: { kermanStock: number; tehranStock: number; stock: number },
  requested: InventoryQuantities,
): InventoryAllocation {
  const splitStock = levels.kermanStock + levels.tehranStock;
  if (splitStock <= 0) {
    const total = requested.kerman + requested.tehran + requested.site;
    return {
      allocation: { kerman: 0, tehran: 0, site: total },
      available: { kerman: levels.stock, tehran: levels.stock, site: levels.stock },
    };
  }

  const remainingKerman = Math.max(0, levels.kermanStock - requested.kerman);
  const remainingTehran = Math.max(0, levels.tehranStock - requested.tehran);
  const genericFromKerman = Math.min(requested.site, remainingKerman);
  const genericFromTehran = requested.site - genericFromKerman;
  return {
    allocation: {
      kerman: requested.kerman + genericFromKerman,
      tehran: requested.tehran + genericFromTehran,
      site: 0,
    },
    available: {
      kerman: levels.kermanStock,
      tehran: levels.tehranStock,
      site: remainingKerman + remainingTehran,
    },
  };
}

export type InventoryTransitionEffect = 'none' | 'commit' | 'release';
export type InventoryTransitionDecision =
  | { valid: true; effect: InventoryTransitionEffect }
  | { valid: false; reason: 'cancelled_is_terminal' | 'committed_cannot_be_reserved' };

/** `new` is reserving; every accepted status is final inventory consumption. */
export function decideInventoryTransition(from: OrderStatus, to: OrderStatus): InventoryTransitionDecision {
  if (from === to) return { valid: true, effect: 'none' };
  if (from === 'cancelled') return { valid: false, reason: 'cancelled_is_terminal' };
  if (to === 'new' && from !== 'new') return { valid: false, reason: 'committed_cannot_be_reserved' };
  if (from === 'new' && to === 'cancelled') return { valid: true, effect: 'release' };
  if (from === 'new') return { valid: true, effect: 'commit' };
  return { valid: true, effect: 'none' };
}
