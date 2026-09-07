/**
 * Tiny in-process TTL cache. The catalogue is read far more than it is written
 * and a single API node serves the whole shop, so this removes almost every
 * repeat query without dragging in Redis.
 */
interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
  ) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next();
      if (!oldest.done) this.store.delete(oldest.value);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  async wrap(key: string, producer: () => Promise<T>): Promise<T> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await producer();
    this.set(key, value);
    return value;
  }

  clear(): void {
    this.store.clear();
  }
}

/** Cleared whenever the catalogue is written so stale pages never outlive an edit. */
export const catalogCache = new TtlCache<unknown>(60_000, 300);
