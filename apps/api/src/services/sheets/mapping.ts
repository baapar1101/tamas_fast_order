import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { SyncEntity } from '@tamas/shared';
import { normalizePhone } from '@tamas/shared';
import { db } from '../../db/client.js';
import {
  brands,
  categories,
  categoryBrands,
  colors,
  orderItems,
  orders,
  products,
  settings,
  users,
} from '../../db/schema.js';
import { buildSearchText } from '../catalog.js';

/**
 * Every tab carries an `updated_at` column. It is what makes the two-way sync
 * honest: whichever side has the newer timestamp wins, and both sides can see
 * why. Editing a cell by hand and leaving `updated_at` alone still works —
 * the row hash catches the change and the sync stamps a fresh timestamp.
 */
export const UPDATED_AT_COLUMN = 'updated_at';

export type SheetCells = Record<string, string>;

/** One row as it exists in the database, rendered into sheet columns. */
export interface DbSideRow {
  key: string;
  updatedAt: Date;
  cells: SheetCells;
  /**
   * Hash of the row the last time the two sides agreed. Comparing it against
   * both current hashes is what tells a genuine sheet-side hand edit apart
   * from a stale sheet row, without trusting the `updated_at` cell.
   */
  sheetHash: string | null;
}

export type ApplyOutcome = 'created' | 'updated' | 'skipped';

export interface EntityMapping {
  entity: SyncEntity;
  tab: string;
  columns: string[];
  keyColumn: string;
  /** Physical table and key column, used for the bulk sync-marker update. */
  tableName: string;
  keyDbColumn: string;
  /** Set for tabs holding personal data, gated behind SHEETS_SYNC_PRIVATE_DATA. */
  private?: boolean;
  /** Columns a person may edit in the sheet; everything else is pushed only. */
  editableColumns: string[];
  loadDbRows(): Promise<DbSideRow[]>;
  applySheetRow(key: string, cells: SheetCells, updatedAt: Date): Promise<ApplyOutcome>;
}

function* chunk<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

/**
 * Records "these rows now match the sheet" for a whole batch in one statement
 * per chunk — a per-row UPDATE would be thousands of round trips on a real
 * catalogue.
 */
export async function markSynced(
  mapping: EntityMapping,
  rows: Array<{ key: string; hash: string }>,
): Promise<void> {
  if (rows.length === 0) return;
  // Table and column names come from the constants in this file, never input.
  const table = sql.raw(`"${mapping.tableName}"`);
  const keyCol = sql.raw(`"${mapping.keyDbColumn}"`);

  for (const part of chunk(rows, 500)) {
    // Both columns are cast explicitly: without a type, Postgres cannot infer
    // one for a parameter inside a VALUES list. The timestamp comes from
    // now() rather than a bound Date — drizzle's raw-SQL path cannot serialise
    // a Date, and silently failing here would leave every row without a
    // baseline, which quietly turns every later sheet edit into a conflict.
    const tuples = sql.join(
      part.map((r) => sql`(${r.key}::text, ${r.hash}::text)`),
      sql`, `,
    );
    await db.execute(sql`
      update ${table} as t
         set sheet_hash = v.hash,
             sheet_synced_at = now()
        from (values ${tuples}) as v(key, hash)
       where t.${keyCol} = v.key
    `);
  }
}

/* ------------------------------------------------------------------ *
 * Cell helpers
 * ------------------------------------------------------------------ */

const str = (v: unknown): string => (v == null ? '' : String(v).trim());
const num = (v: unknown): number => {
  const n = Number(str(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const bool = (v: unknown): boolean => {
  const s = str(v).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'بله';
};
const boolCell = (v: boolean): string => (v ? 'TRUE' : 'FALSE');
const iso = (d: Date | null | undefined): string => (d ? d.toISOString() : '');

/** Attributes live in the sheet as two parallel `a | b | c` columns, as before. */
function packAttributes(list: Array<{ key: string; value: string }>): { keys: string; values: string } {
  return {
    keys: list.map((a) => a.key).join(' | '),
    values: list.map((a) => a.value).join(' | '),
  };
}

function unpackAttributes(keys: string, values: string): Array<{ key: string; value: string }> {
  const ks = str(keys) ? str(keys).split('|').map((s) => s.trim()) : [];
  const vs = str(values) ? str(values).split('|').map((s) => s.trim()) : [];
  return ks
    .map((k, i) => ({ key: k, value: vs[i] ?? '' }))
    .filter((a) => a.key.length > 0);
}

const splitList = (v: string): string[] =>
  str(v)
    .split(/[,،;|]+/)
    .map((s) => s.trim())
    .filter(Boolean);

/* ------------------------------------------------------------------ *
 * Lookup caches, rebuilt at the start of every sync pass
 * ------------------------------------------------------------------ */

interface Lookups {
  categoryByName: Map<string, number>;
  brandByName: Map<string, number>;
  categoryNameById: Map<number, string>;
  brandNameById: Map<number, string>;
}

let lookups: Lookups | null = null;

export async function refreshLookups(): Promise<Lookups> {
  const [cats, brs] = await Promise.all([
    db.select({ id: categories.id, name: categories.name, faName: categories.faName }).from(categories),
    db.select({ id: brands.id, name: brands.name, faName: brands.faName }).from(brands),
  ]);

  const categoryByName = new Map<string, number>();
  const categoryNameById = new Map<number, string>();
  for (const c of cats) {
    categoryByName.set(c.name.toLowerCase(), c.id);
    if (c.faName) categoryByName.set(c.faName.toLowerCase(), c.id);
    categoryNameById.set(c.id, c.name);
  }

  const brandByName = new Map<string, number>();
  const brandNameById = new Map<number, string>();
  for (const b of brs) {
    brandByName.set(b.name.toLowerCase(), b.id);
    if (b.faName) brandByName.set(b.faName.toLowerCase(), b.id);
    brandNameById.set(b.id, b.name);
  }

  lookups = { categoryByName, brandByName, categoryNameById, brandNameById };
  return lookups;
}

function L(): Lookups {
  if (!lookups) throw new Error('lookups not loaded — call refreshLookups() first');
  return lookups;
}

/** Creates the taxonomy row on demand so a brand typed into the sheet just works. */
async function ensureBrand(name: string): Promise<number | null> {
  const clean = str(name);
  if (!clean) return null;
  const hit = L().brandByName.get(clean.toLowerCase());
  if (hit) return hit;
  const [created] = await db
    .insert(brands)
    .values({ name: clean, faName: clean })
    .onConflictDoUpdate({ target: brands.name, set: { updatedAt: new Date() } })
    .returning({ id: brands.id });
  if (created) {
    L().brandByName.set(clean.toLowerCase(), created.id);
    L().brandNameById.set(created.id, clean);
    return created.id;
  }
  return null;
}

async function ensureCategory(name: string): Promise<number | null> {
  const clean = str(name);
  if (!clean) return null;
  const hit = L().categoryByName.get(clean.toLowerCase());
  if (hit) return hit;
  const [created] = await db
    .insert(categories)
    .values({ name: clean, faName: clean })
    .onConflictDoUpdate({ target: categories.name, set: { updatedAt: new Date() } })
    .returning({ id: categories.id });
  if (created) {
    L().categoryByName.set(clean.toLowerCase(), created.id);
    L().categoryNameById.set(created.id, clean);
    return created.id;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Products
 * ------------------------------------------------------------------ */

const PRODUCT_COLUMNS = ['product_id', 'Category', 'Brand', 'title', 'model', 'color', 'sku', 'RIAL PRICE', 'price', 'old_price', 'sell_type', 'discount%', 'kerman_stock', 'tehran_stock', 'warranty', 'promotion', 'status', 'image_url', 'attribute_key', 'attribute_value'];

export const productMapping: EntityMapping = {
  entity: 'products',
  tab: 'Products',
  columns: PRODUCT_COLUMNS,
  keyColumn: 'product_id',
  tableName: 'products',
  keyDbColumn: 'product_id',
  editableColumns: PRODUCT_COLUMNS.filter((c) => c !== 'product_id'),

  async loadDbRows() {
    const rows = await db.select().from(products).where(isNull(products.deletedAt));
    return rows.map((r) => {
      const attrs = packAttributes(r.attributes ?? []);
      return {
        key: r.productId,
        updatedAt: r.updatedAt,
        sheetHash: r.sheetHash,
        cells: {
          product_id: r.productId,
          Category: r.categoryId ? (L().categoryNameById.get(r.categoryId) ?? '') : '',
          Brand: r.brandId ? (L().brandNameById.get(r.brandId) ?? '') : '',
          title: r.title,
          model: r.model ?? '',
          color: r.color ?? '',
          color_en: r.colorEn ?? '',
          color_code: r.colorCode ?? '',
          sku: r.sku ?? '',
          price: String(r.price),
          'RIAL PRICE': String(r.price * 10),
          old_price: r.oldPrice == null ? '' : String(r.oldPrice),
          'discount%': String(r.discount),
          kerman_stock: String(r.kermanStock),
          tehran_stock: String(r.tehranStock),
          warranty: r.warranty ?? '',
          sell_type: r.sellType ?? '',
          seller: r.seller ?? '',
          promotion: boolCell(r.promotion),
          status: r.status,
          image_url: r.imageUrl ?? '',
          gallery: (r.gallery ?? []).join(' | '),
          attribute_key: attrs.keys,
          attribute_value: attrs.values,
          sort_order: String(r.sortOrder),
          [UPDATED_AT_COLUMN]: iso(r.updatedAt),
        },
      };
    });
  },

  async applySheetRow(key, cells, updatedAt) {
    const title = str(cells.title) || str(cells.model) || key;
    const categoryId = await ensureCategory(str(cells.Category));
    const brandId = await ensureBrand(str(cells.Brand));
    const brandLabel = brandId ? (L().brandNameById.get(brandId) ?? '') : '';

    const values = {
      productId: key,
      sku: str(cells.sku) || null,
      title,
      model: str(cells.model) || null,
      categoryId,
      brandId,
      color: str(cells.color) || null,
      colorEn: str(cells.color_en) || null,
      colorCode: str(cells.color_code) || null,
      price: str(cells.price) ? num(cells.price) : (str(cells['RIAL PRICE']) ? Math.trunc(num(cells['RIAL PRICE']) / 10) : 0),
      oldPrice: str(cells.old_price) ? num(cells.old_price) : null,
      discount: num(cells.discount ?? cells['discount%']),
      stock: num(cells.stock),
      kermanStock: num(cells.kerman_stock),
      tehranStock: num(cells.tehran_stock),
      warranty: str(cells.warranty) || null,
      sellType: str(cells.sell_type) || null,
      seller: str(cells.seller) || null,
      promotion: bool(cells.promotion),
      status: (str(cells.status).toLowerCase() === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
      imageUrl: str(cells.image_url) || null,
      gallery: splitList(cells.gallery ?? ''),
      attributes: unpackAttributes(cells.attribute_key ?? '', cells.attribute_value ?? ''),
      sortOrder: num(cells.sort_order),
      searchText: buildSearchText([title, cells.model, brandLabel, cells.color, cells.color_en, cells.sku, key]),
      updatedAt,
      deletedAt: null,
    };

    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.productId, key))
      .limit(1);

    if (existing) {
      await db.update(products).set(values).where(eq(products.id, existing.id));
      return 'updated';
    }
    await db.insert(products).values(values);
    return 'created';
  },
};

/* ------------------------------------------------------------------ *
 * Categories / Brands / Colors
 * ------------------------------------------------------------------ */

const CATEGORY_COLUMNS = ['category_name', 'category_fa_name', 'icon_url', 'Brand'];

export const categoryMapping: EntityMapping = {
  entity: 'categories',
  tab: 'Categories',
  columns: CATEGORY_COLUMNS,
  keyColumn: 'category_name',
  tableName: 'categories',
  keyDbColumn: 'name',
  editableColumns: CATEGORY_COLUMNS.filter((c) => c !== 'category_name'),

  async loadDbRows() {
    const rows = await db.select().from(categories).where(isNull(categories.deletedAt));
    const links = await db
      .select({ categoryId: categoryBrands.categoryId, brandName: brands.name })
      .from(categoryBrands)
      .innerJoin(brands, eq(brands.id, categoryBrands.brandId));

    const byCategory = new Map<number, string[]>();
    for (const l of links) {
      const list = byCategory.get(l.categoryId) ?? [];
      list.push(l.brandName);
      byCategory.set(l.categoryId, list);
    }

    return rows.map((r) => ({
      key: r.name,
      updatedAt: r.updatedAt,
      sheetHash: r.sheetHash,
      cells: {
        category_name: r.name,
        category_fa_name: r.faName,
        icon_url: r.iconUrl ?? '',
        Brand: (byCategory.get(r.id) ?? []).join(', '),
        sort_order: String(r.sortOrder),
        [UPDATED_AT_COLUMN]: iso(r.updatedAt),
      },
    }));
  },

  async applySheetRow(key, cells, updatedAt) {
    const values = {
      name: key,
      faName: str(cells.category_fa_name) || key,
      iconUrl: str(cells.icon_url) || null,
      sortOrder: num(cells.sort_order),
      updatedAt,
      deletedAt: null,
    };

    const [existing] = await db.select({ id: categories.id }).from(categories).where(eq(categories.name, key)).limit(1);
    let id: number;
    let outcome: ApplyOutcome;
    if (existing) {
      await db.update(categories).set(values).where(eq(categories.id, existing.id));
      id = existing.id;
      outcome = 'updated';
    } else {
      const [created] = await db.insert(categories).values(values).returning({ id: categories.id });
      if (!created) return 'skipped';
      id = created.id;
      outcome = 'created';
    }

    // Rebuild the category↔brand links from the comma list in the sheet.
    const wanted = splitList(cells.Brand ?? '');
    const brandIds: number[] = [];
    for (const name of wanted) {
      const bid = await ensureBrand(name);
      if (bid) brandIds.push(bid);
    }
    await db.delete(categoryBrands).where(eq(categoryBrands.categoryId, id));
    if (brandIds.length > 0) {
      await db
        .insert(categoryBrands)
        .values(brandIds.map((brandId) => ({ categoryId: id, brandId })))
        .onConflictDoNothing();
    }
    return outcome;
  },
};

const BRAND_COLUMNS = ['brand_name', 'brand_fa_name', 'icon_url'];

export const brandMapping: EntityMapping = {
  entity: 'brands',
  tab: 'Brands',
  columns: BRAND_COLUMNS,
  keyColumn: 'brand_name',
  tableName: 'brands',
  keyDbColumn: 'name',
  editableColumns: BRAND_COLUMNS.filter((c) => c !== 'brand_name'),

  async loadDbRows() {
    const rows = await db.select().from(brands).where(isNull(brands.deletedAt));
    return rows.map((r) => ({
      key: r.name,
      updatedAt: r.updatedAt,
      sheetHash: r.sheetHash,
      cells: {
        brand_name: r.name,
        brand_fa_name: r.faName,
        icon_url: r.iconUrl ?? '',
        sort_order: String(r.sortOrder),
        [UPDATED_AT_COLUMN]: iso(r.updatedAt),
      },
    }));
  },

  async applySheetRow(key, cells, updatedAt) {
    const values = {
      name: key,
      faName: str(cells.brand_fa_name) || key,
      iconUrl: str(cells.icon_url) || null,
      sortOrder: num(cells.sort_order),
      updatedAt,
      deletedAt: null,
    };
    const [existing] = await db.select({ id: brands.id }).from(brands).where(eq(brands.name, key)).limit(1);
    if (existing) {
      await db.update(brands).set(values).where(eq(brands.id, existing.id));
      return 'updated';
    }
    await db.insert(brands).values(values);
    return 'created';
  },
};

const COLOR_COLUMNS = ['color_name', 'color_fa_name', 'color_code'];

export const colorMapping: EntityMapping = {
  entity: 'colors',
  tab: 'Colors',
  columns: COLOR_COLUMNS,
  keyColumn: 'color_code',
  tableName: 'colors',
  keyDbColumn: 'code',
  editableColumns: COLOR_COLUMNS.filter((c) => c !== 'color_code'),

  async loadDbRows() {
    const rows = await db.select().from(colors).where(isNull(colors.deletedAt));
    return rows.map((r) => ({
      key: r.code,
      updatedAt: r.updatedAt,
      sheetHash: r.sheetHash,
      cells: {
        color_code: r.code,
        color_fa_name: r.faName ?? '',
        color_name: r.name ?? '',
        [UPDATED_AT_COLUMN]: iso(r.updatedAt),
      },
    }));
  },

  async applySheetRow(key, cells, updatedAt) {
    const values = {
      code: key,
      faName: str(cells.color_fa_name) || null,
      name: str(cells.color_name) || null,
      updatedAt,
      deletedAt: null,
    };
    const [existing] = await db.select({ id: colors.id }).from(colors).where(eq(colors.code, key)).limit(1);
    if (existing) {
      await db.update(colors).set(values).where(eq(colors.id, existing.id));
      return 'updated';
    }
    await db.insert(colors).values(values);
    return 'created';
  },
};

/* ------------------------------------------------------------------ *
 * Users
 * ------------------------------------------------------------------ */

const USER_COLUMNS = ['name', 'last_name', 'Store_name', 'phone_number', 'mobile_number', 'address', 'postal_code', 'certificate_file_url', 'activity', 'page_website', 'actived'];

export const userMapping: EntityMapping = {
  entity: 'users',
  tab: 'Users',
  columns: USER_COLUMNS,
  keyColumn: 'mobile_number',
  tableName: 'users',
  keyDbColumn: 'phone',
  private: true,
  // `actived` is the one people flip by hand to approve a shop.
  editableColumns: [
    'name',
    'last_name',
    'Store_name',
    'phone_number',
    'address',
    'postal_code',
    'certificate_file_url',
    'activity',
    'page_website',
    'actived',
    UPDATED_AT_COLUMN,
  ],

  async loadDbRows() {
    const rows = await db.select().from(users).where(isNull(users.deletedAt));
    return rows.map((r) => ({
      key: r.phone,
      updatedAt: r.updatedAt,
      sheetHash: r.sheetHash,
      cells: {
        mobile_number: r.phone,
        name: r.name,
        last_name: r.lastName,
        Store_name: r.storeName,
        phone_number: r.landline,
        address: r.address,
        postal_code: r.postalCode,
        certificate_file_url: r.certificateFileUrl,
        activity: r.activity ?? '',
        page_website: r.pageWebsite ?? '',
        actived: boolCell(r.isActive),
        role: r.role,
        [UPDATED_AT_COLUMN]: iso(r.updatedAt),
      },
    }));
  },

  async applySheetRow(key, cells, updatedAt) {
    const phone = normalizePhone(key);
    if (!phone) return 'skipped';

    // `role` is deliberately not read back from the sheet: a stray edit there
    // must never be able to hand someone the admin panel.
    const values = {
      phone,
      name: str(cells.name),
      lastName: str(cells.last_name),
      storeName: str(cells.Store_name),
      landline: str(cells.phone_number),
      address: str(cells.address),
      postalCode: str(cells.postal_code),
      certificateFileUrl: str(cells.certificate_file_url),
      activity: str(cells.activity),
      pageWebsite: str(cells.page_website),
      isActive: bool(cells.actived),
      updatedAt,
      deletedAt: null,
    };

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
    if (existing) {
      await db.update(users).set(values).where(eq(users.id, existing.id));
      return 'updated';
    }
    await db.insert(users).values(values);
    return 'created';
  },
};

/* ------------------------------------------------------------------ *
 * Orders
 * ------------------------------------------------------------------ */

const ORDER_COLUMNS = ['order_id', 'created_at', 'customer_name', 'phone', 'address', 'items_json', 'total', 'payment', 'status'];

const ORDER_STATUS_SET = new Set(['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled']);

export const orderMapping: EntityMapping = {
  entity: 'orders',
  tab: 'Orders',
  columns: ORDER_COLUMNS,
  keyColumn: 'order_id',
  tableName: 'orders',
  keyDbColumn: 'order_code',
  private: true,
  /* Orders are created by the shop, never by the sheet. Only the two columns
   * someone actually works with there come back. */
  editableColumns: ['status', 'payment', 'note', UPDATED_AT_COLUMN],

  async loadDbRows() {
    const rows = await db.select().from(orders).where(isNull(orders.deletedAt));
    if (rows.length === 0) return [];

    const items = await db
      .select()
      .from(orderItems)
      .where(
        inArray(
          orderItems.orderId,
          rows.map((r) => r.id),
        ),
      );

    const byOrder = new Map<number, typeof items>();
    for (const it of items) {
      const list = byOrder.get(it.orderId) ?? [];
      list.push(it);
      byOrder.set(it.orderId, list);
    }

    return rows.map((r) => ({
      key: r.orderCode,
      updatedAt: r.updatedAt,
      sheetHash: r.sheetHash,
      cells: {
        order_id: r.orderCode,
        created_at: iso(r.createdAt),
        customer_name: r.customerName,
        phone: r.phone,
        store_name: r.storeName ?? '',
        address: r.address,
        items_json: JSON.stringify(
          (byOrder.get(r.id) ?? []).map((i) => ({
            product_id: i.productId,
            sku: i.sku,
            title: i.title,
            color: i.color,
            price: i.price,
            qty: i.qty,
            warehouse: i.warehouse,
          })),
        ),
        total_price: String(r.total),
        payment: r.paymentMethod ?? '',
        status: r.status,
        note: r.note ?? '',
        [UPDATED_AT_COLUMN]: iso(r.updatedAt),
      },
    }));
  },

  async applySheetRow(key, cells, updatedAt) {
    const [existing] = await db.select({ id: orders.id }).from(orders).where(eq(orders.orderCode, key)).limit(1);

    const rawStatus = str(cells.status).toLowerCase();
    const parsedStatus = ORDER_STATUS_SET.has(rawStatus) ? (rawStatus as any) : 'new';

    if (!existing) {
      let items: any[] = [];
      try {
        items = JSON.parse(str(cells.items_json) || '[]');
      } catch {}
      
      const [created] = await db.insert(orders).values({
        orderCode: key,
        customerName: str(cells.customer_name) || 'مشتری نامشخص',
        phone: str(cells.phone) || '00000000000',
        storeName: str(cells.store_name) || null,
        address: str(cells.address) || '',
        total: Number(str(cells.total_price)) || 0,
        status: parsedStatus,
        paymentMethod: str(cells.payment) || null,
        note: str(cells.note) || null,
        createdAt: str(cells.date) ? new Date(str(cells.date)) : updatedAt,
        updatedAt,
      }).returning();
      
      if (created && items.length > 0) {
        await db.insert(orderItems).values(
          items.map(i => ({
            orderId: created.id,
            productId: String(i.product_id || ''),
            sku: i.sku ? String(i.sku) : null,
            title: String(i.title || 'محصول نامشخص'),
            color: i.color ? String(i.color) : null,
            price: Number(i.price) || 0,
            qty: Number(i.qty) || 1,
            warehouse: i.warehouse || 'kerman',
          }))
        );
      }
      return 'created';
    }

    const patch: Record<string, unknown> = {
      updatedAt,
      note: str(cells.note) || null,
      paymentMethod: str(cells.payment) || null,
      status: parsedStatus,
    };

    await db.update(orders).set(patch).where(eq(orders.id, existing.id));
    return 'updated';
  },
};

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

const SETTING_COLUMNS = ['key', 'value'];

export const settingMapping: EntityMapping = {
  entity: 'settings',
  tab: 'Settings',
  columns: SETTING_COLUMNS,
  keyColumn: 'key',
  tableName: 'settings',
  keyDbColumn: 'key',
  editableColumns: ['value', UPDATED_AT_COLUMN],

  async loadDbRows() {
    const rows = await db.select().from(settings).where(isNull(settings.deletedAt));
    return rows.map((r) => ({
      key: r.key,
      updatedAt: r.updatedAt,
      sheetHash: r.sheetHash,
      cells: { key: r.key, value: r.value, [UPDATED_AT_COLUMN]: iso(r.updatedAt) },
    }));
  },

  async applySheetRow(key, cells, updatedAt) {
    const value = str(cells.value);
    const [existing] = await db.select({ id: settings.id }).from(settings).where(eq(settings.key, key)).limit(1);
    if (existing) {
      await db.update(settings).set({ value, updatedAt, deletedAt: null }).where(eq(settings.id, existing.id));
      return 'updated';
    }
    await db.insert(settings).values({ key, value, updatedAt });
    return 'created';
  },
};

export const MAPPINGS: Record<SyncEntity, EntityMapping> = {
  products: productMapping,
  categories: categoryMapping,
  brands: brandMapping,
  colors: colorMapping,
  users: userMapping,
  orders: orderMapping,
  settings: settingMapping,
};

/** Order matters: taxonomy has to land before the products that reference it. */
export const SYNC_ORDER: SyncEntity[] = ['brands', 'categories', 'colors', 'products', 'users', 'orders', 'settings'];

export { and, isNull };
