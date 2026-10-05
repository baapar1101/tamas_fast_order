import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { products } from '../../db/schema.js';
import { invalidateCatalog } from '../catalog.js';

/**
 * Public Google Sheets API URL for reading price & stock.
 * Uses API-key auth (no service account needed).
 *
 * Google Sheet is the **sole source of truth** for price and stock.
 * This function fetches the Products tab via the public REST endpoint,
 * then updates ONLY price-related and stock-related columns in Postgres.
 */

const SHEET_API_URL =
  'https://sheets.googleapis.com/v4/spreadsheets/1VjRRhxuLrr1HiEjLBNRrxXrZmk_pPjfu-s6xZY6bha4/values/Products!A1:M?key=AIzaSyAr3UZnsUJWQxbZY5m8eaAJVFh6GLer1lg&majorDimension=ROWS';

interface SheetResponse {
  range: string;
  majorDimension: string;
  values: string[][];
}

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
 * Parse a numeric value from the sheet cell. Returns 0 for empty/invalid.
 */
function parseNum(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/**
 * Fetches price & stock data from the public Google Sheet and updates the
 * database. Only touches: price, old_price, discount,
 * kerman_stock, tehran_stock, stock (computed as sum of warehouses).
 *
 * Per project rules, Google Sheet is the source of truth for price & stock.
 */
export async function syncPriceStockFromSheet(): Promise<PriceStockSyncReport> {
  if (running) {
    throw new Error('یک همگام‌سازی قیمت/موجودی در حال اجراست. صبر کنید.');
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
    // --- 1. Fetch data from Google Sheets public API ---
    const res = await fetch(SHEET_API_URL);
    if (!res.ok) {
      throw new Error(`Google Sheets API error: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as SheetResponse;
    const rows = data.values ?? [];

    if (rows.length < 2) {
      report.finishedAt = new Date().toISOString();
      return report;
    }

    // --- 2. Parse header row to find column indices ---
    const header = rows[0]!.map((h) => String(h).trim().toLowerCase());
    const colIdx = {
      productId: header.indexOf('product_id'),
      price: header.indexOf('price'),
      oldPrice: header.indexOf('old_price'),
      discount: header.indexOf('discount%'),
      kermanStock: header.indexOf('kerman_stock'),
      tehranStock: header.indexOf('tehran_stock'),
    };

    if (colIdx.productId < 0) {
      throw new Error('ستون product_id در شیت گوگل پیدا نشد.');
    }

    // --- 3. Process each data row ---
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]!;
      const productId = String(row[colIdx.productId] ?? '').trim();
      if (!productId) {
        report.skipped++;
        continue;
      }

      report.totalRows++;

      try {
        const price = colIdx.price >= 0 ? parseNum(row[colIdx.price]) : 0;
        const oldPrice = colIdx.oldPrice >= 0 ? parseNum(row[colIdx.oldPrice]) : null;
        const discount = colIdx.discount >= 0 ? parseNum(row[colIdx.discount]) : 0;
        const kermanStock = colIdx.kermanStock >= 0 ? parseNum(row[colIdx.kermanStock]) : 0;
        const tehranStock = colIdx.tehranStock >= 0 ? parseNum(row[colIdx.tehranStock]) : 0;
        const totalStock = kermanStock + tehranStock;

        // Check if product exists
        const [existing] = await db
          .select({ id: products.id })
          .from(products)
          .where(eq(products.productId, productId))
          .limit(1);

        if (existing) {
          // Update only price & stock fields — Google Sheet is source of truth
          await db
            .update(products)
            .set({
              price,
              oldPrice: oldPrice || null,
              discount,
              kermanStock,
              tehranStock,
              stock: totalStock,
              updatedAt: new Date(),
            })
            .where(eq(products.id, existing.id));
          report.updated++;
        } else {
          // Product doesn't exist in DB — skip (full sync handles creation)
          report.skipped++;
        }
      } catch (err) {
        const msg = `خطا در ردیف ${r + 1} (${productId}): ${err instanceof Error ? err.message : String(err)}`;
        report.errors.push(msg);
        if (report.errors.length > 50) break; // Don't flood
      }
    }

    // Invalidate catalog cache so storefront picks up new prices
    invalidateCatalog();

    report.finishedAt = new Date().toISOString();
    return report;
  } finally {
    running = false;
  }
}
