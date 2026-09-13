import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import type { ProductAttribute } from '@tamas/shared';

/* ------------------------------------------------------------------ *
 * Shared column bundles
 *
 * Every table the Google Sheet mirrors carries the same three columns:
 *   updatedAt     — drives last-write-wins against the sheet's own column
 *   sheetHash     — hash of the row as it last left/entered the sheet, so an
 *                   untouched row is never rewritten
 *   sheetSyncedAt — when this row and the sheet last agreed
 * ------------------------------------------------------------------ */

const syncColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  sheetHash: varchar('sheet_hash', { length: 64 }),
  sheetSyncedAt: timestamp('sheet_synced_at', { withTimezone: true }),
};

export const productStatusEnum = pgEnum('product_status', ['active', 'inactive']);
export const userRoleEnum = pgEnum('user_role', ['customer', 'admin']);
export const orderStatusEnum = pgEnum('order_status', [
  'new',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
]);
export const warehouseEnum = pgEnum('warehouse', ['kerman', 'tehran', 'site']);
export const uploadKindEnum = pgEnum('upload_kind', [
  'product',
  'brand',
  'category',
  'slide',
  'certificate',
  'other',
]);
export const syncSideEnum = pgEnum('sync_side', ['db', 'sheet']);

/* ------------------------------------------------------------------ *
 * Taxonomy
 * ------------------------------------------------------------------ */

export const brands = pgTable(
  'brands',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    faName: varchar('fa_name', { length: 160 }).notNull().default(''),
    iconUrl: varchar('icon_url', { length: 1000 }),
    sortOrder: integer('sort_order').notNull().default(0),
    ...syncColumns,
  },
  (t) => [uniqueIndex('brands_name_key').on(t.name)],
);

export const categories = pgTable(
  'categories',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    faName: varchar('fa_name', { length: 160 }).notNull().default(''),
    iconUrl: varchar('icon_url', { length: 1000 }),
    sortOrder: integer('sort_order').notNull().default(0),
    ...syncColumns,
  },
  (t) => [uniqueIndex('categories_name_key').on(t.name)],
);

/**
 * The legacy sheet kept a comma-separated `Brand` column on each category row.
 * Modelled properly here and serialised back to that shape on push.
 */
export const categoryBrands = pgTable(
  'category_brands',
  {
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    brandId: integer('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.brandId] })],
);

export const colors = pgTable(
  'colors',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 32 }).notNull(),
    name: varchar('name', { length: 160 }),
    faName: varchar('fa_name', { length: 160 }),
    ...syncColumns,
  },
  (t) => [uniqueIndex('colors_code_key').on(t.code)],
);

/* ------------------------------------------------------------------ *
 * Products
 * ------------------------------------------------------------------ */

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
    /** Natural key shared with the sheet — one row per colour variant. */
    productId: varchar('product_id', { length: 80 }).notNull(),
    sku: varchar('sku', { length: 80 }),
    title: varchar('title', { length: 400 }).notNull(),
    model: varchar('model', { length: 400 }),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    brandId: integer('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    color: varchar('color', { length: 160 }),
    colorEn: varchar('color_en', { length: 160 }),
    colorCode: varchar('color_code', { length: 32 }),
    price: bigint('price', { mode: 'number' }).notNull().default(0),
    oldPrice: bigint('old_price', { mode: 'number' }),
    discount: integer('discount').notNull().default(0),
    stock: integer('stock').notNull().default(0),
    kermanStock: integer('kerman_stock').notNull().default(0),
    tehranStock: integer('tehran_stock').notNull().default(0),
    warranty: varchar('warranty', { length: 300 }),
    sellType: varchar('sell_type', { length: 200 }),
    seller: varchar('seller', { length: 200 }),
    promotion: boolean('promotion').notNull().default(false),
    status: productStatusEnum('status').notNull().default('active'),
    imageUrl: varchar('image_url', { length: 1000 }),
    gallery: jsonb('gallery').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    attributes: jsonb('attributes').$type<ProductAttribute[]>().notNull().default(sql`'[]'::jsonb`),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Lowercased haystack (title + model + brand + colour + sku) for fast ILIKE search. */
    searchText: text('search_text').notNull().default(''),
    ...syncColumns,
  },
  (t) => [
    uniqueIndex('products_product_id_key').on(t.productId),
    index('products_category_idx').on(t.categoryId),
    index('products_brand_idx').on(t.brandId),
    index('products_title_idx').on(t.title),
    index('products_status_idx').on(t.status),
    index('products_promotion_idx').on(t.promotion),
    index('products_updated_idx').on(t.updatedAt),
    index('products_search_idx').using('gin', sql`${t.searchText} gin_trgm_ops`),
  ],
);

/* ------------------------------------------------------------------ *
 * Users, OTP and sessions
 * ------------------------------------------------------------------ */

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    phone: varchar('phone', { length: 15 }).notNull(),
    name: varchar('name', { length: 120 }).notNull().default(''),
    lastName: varchar('last_name', { length: 120 }).notNull().default(''),
    storeName: varchar('store_name', { length: 200 }).notNull().default(''),
    landline: varchar('landline', { length: 40 }).notNull().default(''),
    address: text('address').notNull().default(''),
    postalCode: varchar('postal_code', { length: 20 }).notNull().default(''),
    certificateFileUrl: varchar('certificate_file_url', { length: 1000 }).notNull().default(''),
    activity: varchar('activity', { length: 120 }).notNull().default(''),
    pageWebsite: varchar('page_website', { length: 255 }).notNull().default(''),
    isActive: boolean('is_active').notNull().default(false),
    role: userRoleEnum('role').notNull().default('customer'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...syncColumns,
  },
  (t) => [uniqueIndex('users_phone_key').on(t.phone), index('users_role_idx').on(t.role)],
);

/**
 * OTP now lives server-side. The legacy build verified the code in the browser
 * and then asked the backend for a session, which let anyone mint a session for
 * any number; the code never leaves this table in plaintext.
 */
export const otpCodes = pgTable(
  'otp_codes',
  {
    id: serial('id').primaryKey(),
    phone: varchar('phone', { length: 15 }).notNull(),
    codeHash: varchar('code_hash', { length: 64 }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    requestIp: varchar('request_ip', { length: 64 }),
  },
  (t) => [index('otp_phone_idx').on(t.phone), index('otp_expires_idx').on(t.expiresAt)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    /** Only the SHA-256 of the bearer token is stored. */
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userAgent: varchar('user_agent', { length: 400 }),
    ip: varchar('ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('sessions_token_key').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
    index('sessions_expires_idx').on(t.expiresAt),
  ],
);

/* ------------------------------------------------------------------ *
 * Orders
 * ------------------------------------------------------------------ */

export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    orderCode: varchar('order_code', { length: 40 }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    customerName: varchar('customer_name', { length: 300 }).notNull(),
    phone: varchar('phone', { length: 15 }).notNull(),
    storeName: varchar('store_name', { length: 200 }),
    address: text('address').notNull().default(''),
    total: bigint('total', { mode: 'number' }).notNull().default(0),
    status: orderStatusEnum('status').notNull().default('new'),
    paymentMethod: varchar('payment_method', { length: 100 }),
    note: text('note'),
    ...syncColumns,
  },
  (t) => [
    uniqueIndex('orders_code_key').on(t.orderCode),
    index('orders_user_idx').on(t.userId),
    index('orders_status_idx').on(t.status),
    index('orders_created_idx').on(t.createdAt),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: varchar('product_id', { length: 80 }).notNull(),
    sku: varchar('sku', { length: 80 }),
    title: varchar('title', { length: 400 }).notNull(),
    color: varchar('color', { length: 160 }),
    /** Price is frozen at checkout so later catalogue edits cannot rewrite history. */
    price: bigint('price', { mode: 'number' }).notNull().default(0),
    qty: integer('qty').notNull().default(1),
    warehouse: warehouseEnum('warehouse').notNull().default('kerman'),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

/* ------------------------------------------------------------------ *
 * Settings, uploads
 * ------------------------------------------------------------------ */

export const settings = pgTable(
  'settings',
  {
    id: serial('id').primaryKey(),
    key: varchar('key', { length: 120 }).notNull(),
    value: text('value').notNull().default(''),
    ...syncColumns,
  },
  (t) => [uniqueIndex('settings_key_key').on(t.key)],
);

export const uploads = pgTable(
  'uploads',
  {
    id: serial('id').primaryKey(),
    kind: uploadKindEnum('kind').notNull().default('other'),
    storageKey: varchar('storage_key', { length: 500 }).notNull(),
    thumbKey: varchar('thumb_key', { length: 500 }),
    originalName: varchar('original_name', { length: 400 }).notNull().default(''),
    mimeType: varchar('mime_type', { length: 120 }).notNull().default(''),
    size: integer('size').notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    checksum: varchar('checksum', { length: 64 }),
    uploadedBy: integer('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('uploads_kind_idx').on(t.kind), index('uploads_checksum_idx').on(t.checksum)],
);

/* ------------------------------------------------------------------ *
 * Sync bookkeeping
 * ------------------------------------------------------------------ */

export const syncState = pgTable(
  'sync_state',
  {
    entity: varchar('entity', { length: 40 }).primaryKey(),
    lastPulledAt: timestamp('last_pulled_at', { withTimezone: true }),
    lastPushedAt: timestamp('last_pushed_at', { withTimezone: true }),
    rowsPulled: integer('rows_pulled').notNull().default(0),
    rowsPushed: integer('rows_pushed').notNull().default(0),
    lastError: text('last_error'),
    running: boolean('running').notNull().default(false),
  },
);

export const syncConflicts = pgTable(
  'sync_conflicts',
  {
    id: serial('id').primaryKey(),
    entity: varchar('entity', { length: 40 }).notNull(),
    entityKey: varchar('entity_key', { length: 200 }).notNull(),
    field: varchar('field', { length: 120 }).notNull(),
    dbValue: text('db_value'),
    sheetValue: text('sheet_value'),
    resolvedTo: syncSideEnum('resolved_to').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sync_conflicts_entity_idx').on(t.entity), index('sync_conflicts_created_idx').on(t.createdAt)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 80 }).notNull(),
    entity: varchar('entity', { length: 60 }).notNull(),
    entityKey: varchar('entity_key', { length: 200 }),
    detail: jsonb('detail'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_created_idx').on(t.createdAt), index('audit_entity_idx').on(t.entity)],
);

/* ------------------------------------------------------------------ *
 * Relations
 * ------------------------------------------------------------------ */

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
  categoryBrands: many(categoryBrands),
}));

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
  categoryBrands: many(categoryBrands),
}));

export const categoryBrandsRelations = relations(categoryBrands, ({ one }) => ({
  category: one(categories, { fields: [categoryBrands.categoryId], references: [categories.id] }),
  brand: one(brands, { fields: [categoryBrands.brandId], references: [brands.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));
