import { runSync } from './sync.js';

export interface PriceStockSyncReport {
  startedAt: string;
  finishedAt: string;
  totalRows: number;
  updated: number;
  created: number;
  skipped: number;
  errors: string[];
}

let running = false;

export function isPriceStockSyncRunning(): boolean {
  return running;
}

/**
 * Publish the current site catalogue to Google Sheets. The site database is
 * the source of truth, including price and inventory. Products deleted on the
 * site are omitted from the output and therefore removed from the Sheet too.
 */
export async function syncPriceStockFromSheet(): Promise<PriceStockSyncReport> {
  if (running) {
    throw new Error('یک انتشار قیمت/موجودی در حال اجراست. صبر کنید.');
  }

  running = true;
  const startedAt = new Date();
  const report: PriceStockSyncReport = {
    startedAt: startedAt.toISOString(),
    finishedAt: '',
    totalRows: 0,
    updated: 0,
    created: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const sync = await runSync({ direction: 'push', entities: ['products'], dryRun: false });
    const productsResult = sync.entities.find((entity) => entity.entity === 'products');
    report.totalRows = productsResult?.pushed ?? 0;
    report.updated = productsResult?.pushed ?? 0;
    report.skipped = productsResult?.skipped ?? 0;
    if (productsResult?.error) report.errors.push(productsResult.error);
    report.finishedAt = new Date().toISOString();
    return report;
  } finally {
    running = false;
  }
}
