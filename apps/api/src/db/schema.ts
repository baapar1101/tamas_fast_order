import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
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
import type { PaymentPlanQuote, ProductAttribute } from '@tamas/shared';

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
export const userRoleEnum = pgEnum('user_role', ['customer', 'admin', 'operator']);
export const orderStatusEnum = pgEnum('order_status', [
  'new',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
]);
export const paymentStatusEnum = pgEnum('payment_status', ['paid', 'unpaid', 'pending']);
export const warehouseEnum = pgEnum('warehouse', ['kerman', 'tehran', 'site']);
export const inventoryReservationStatusEnum = pgEnum('inventory_reservation_status', [
  'reserved',
  'committed',
  'released',
]);
export const uploadKindEnum = pgEnum('upload_kind', [
  'product',
  'brand',
  'category',
  'slide',
  'certificate',
  'other',
]);
export const syncSideEnum = pgEnum('sync_side', ['db', 'sheet']);
export const paymentGatewayEnum = pgEnum('payment_gateway', ['zarinpal', 'mellat', 'saman', 'pasargad', 'card_to_card', 'aqayepardakht', 'wallet']);
export const paymentTransactionStatusEnum = pgEnum('payment_transaction_status', ['pending', 'success', 'failed']);
export const walletDirectionEnum = pgEnum('wallet_direction', ['credit', 'debit']);
export const walletTransactionTypeEnum = pgEnum('wallet_transaction_type', ['deposit', 'purchase', 'refund', 'adjustment', 'withdrawal']);
export const commentStatusEnum = pgEnum('comment_status', ['pending', 'approved', 'rejected']);
export const creditStatusEnum = pgEnum('credit_status', ['pending', 'reviewing', 'active', 'action_required']);
export const chequeStatusEnum = pgEnum('cheque_status', ['pending', 'passed', 'bounced', 'returned']);
export const installmentReceiptStatusEnum = pgEnum('installment_receipt_status', ['pending', 'approved', 'rejected']);
export const creditReportExtractionStatusEnum = pgEnum('credit_report_extraction_status', ['parsed', 'needs_review', 'failed']);
export const crmSyncEntityEnum = pgEnum('crm_sync_entity', ['order', 'product', 'person', 'chat_message']);
export const crmSyncActionEnum = pgEnum('crm_sync_action', ['create', 'update', 'delete', 'sync']);
export const crmSyncStatusEnum = pgEnum('crm_sync_status', ['success', 'error', 'pending', 'skipped']);
export const discountKindEnum = pgEnum('discount_kind', ['percent', 'fixed', 'free_shipping']);
export const paymentInstructionStatusEnum = pgEnum('payment_instruction_status', ['pending', 'sent']);

/* ------------------------------------------------------------------ *
 * Credit Applications & Cheques
 * ------------------------------------------------------------------ */

export const creditApplications = pgTable(
  'credit_applications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    nationalId: varchar('national_id', { length: 20 }).notNull(),
    businessType: varchar('business_type', { length: 100 }).notNull(),
    nationalCardUrl: text('national_card_url').notNull(),
    businessDocsUrl: text('business_docs_url').notNull(),
    checkImageUrl: text('check_image_url').notNull(),
    bankStatementUrl: text('bank_statement_url'),
    referralInfo: text('referral_info'),
    status: creditStatusEnum('status').notNull().default('pending'),
    rejectionReason: text('rejection_reason'),
    adminCreditScore: integer('admin_credit_score').notNull().default(0),
    assignedCreditLimit: bigint('assigned_credit_limit', { mode: 'number' }).notNull().default(0),
    internalNotes: text('internal_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('credit_applications_user_idx').on(t.userId),
    index('credit_applications_status_idx').on(t.status),
  ],
);

export const creditApplicationsRelations = relations(creditApplications, ({ one }) => ({
  user: one(users, { fields: [creditApplications.userId], references: [users.id] }),
}));

export const creditReportSnapshots = pgTable(
  'credit_report_snapshots',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    creditApplicationId: integer('credit_application_id').references(() => creditApplications.id, { onDelete: 'set null' }),
    fileUrl: text('file_url').notNull(),
    originalName: varchar('original_name', { length: 400 }).notNull().default(''),
    reportNumber: varchar('report_number', { length: 80 }),
    reportDate: varchar('report_date', { length: 40 }),
    extractedNationalId: varchar('extracted_national_id', { length: 20 }),
    extractedFullName: varchar('extracted_full_name', { length: 240 }),
    extractedMobile: varchar('extracted_mobile', { length: 20 }),
    score: integer('score'),
    riskGrade: varchar('risk_grade', { length: 20 }),
    riskLevel: varchar('risk_level', { length: 80 }),
    goodPayerMinBasisPoints: integer('good_payer_min_basis_points'),
    goodPayerMaxBasisPoints: integer('good_payer_max_basis_points'),
    bouncedChequeCount: integer('bounced_cheque_count'),
    extractionStatus: creditReportExtractionStatusEnum('extraction_status').notNull().default('parsed'),
    extractionVersion: integer('extraction_version').notNull().default(1),
    confidence: integer('confidence').notNull().default(0),
    warnings: jsonb('warnings').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('credit_report_snapshots_user_idx').on(t.userId),
    index('credit_report_snapshots_application_idx').on(t.creditApplicationId),
    index('credit_report_snapshots_expires_idx').on(t.expiresAt),
    index('credit_report_snapshots_report_user_idx').on(t.userId, t.reportNumber),
  ],
);

export const creditReportSnapshotsRelations = relations(creditReportSnapshots, ({ one }) => ({
  user: one(users, { fields: [creditReportSnapshots.userId], references: [users.id] }),
  creditApplication: one(creditApplications, { fields: [creditReportSnapshots.creditApplicationId], references: [creditApplications.id] }),
}));

export const creditCheques = pgTable(
  'credit_cheques',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    creditApplicationId: integer('credit_application_id')
      .references(() => creditApplications.id, { onDelete: 'set null' }),
    orderId: integer('order_id')
      .references(() => orders.id, { onDelete: 'set null' }),
    chequeNumber: varchar('cheque_number', { length: 80 }).notNull(),
    bankName: varchar('bank_name', { length: 120 }).notNull(),
    accountHolder: varchar('account_holder', { length: 160 }).notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    dueDate: varchar('due_date', { length: 30 }).notNull(),
    status: chequeStatusEnum('status').notNull().default('pending'),
    imageUrl: text('image_url'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('credit_cheques_user_idx').on(t.userId),
    index('credit_cheques_status_idx').on(t.status),
    index('credit_cheques_due_date_idx').on(t.dueDate),
  ],
);

export const creditChequesRelations = relations(creditCheques, ({ one }) => ({
  user: one(users, { fields: [creditCheques.userId], references: [users.id] }),
  creditApplication: one(creditApplications, { fields: [creditCheques.creditApplicationId], references: [creditApplications.id] }),
}));

export const installmentReceipts = pgTable(
  'installment_receipts',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    installmentIndex: integer('installment_index').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    dueDate: varchar('due_date', { length: 30 }).notNull(),
    receiptUrl: text('receipt_url').notNull(),
    trackingCode: varchar('tracking_code', { length: 120 }),
    note: text('note'),
    status: installmentReceiptStatusEnum('status').notNull().default('pending'),
    rejectionReason: text('rejection_reason'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: integer('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('installment_receipts_order_installment_key').on(t.orderId, t.installmentIndex),
    index('installment_receipts_user_idx').on(t.userId),
    index('installment_receipts_status_idx').on(t.status),
    index('installment_receipts_due_date_idx').on(t.dueDate),
  ],
);

export const installmentReminderDeliveries = pgTable(
  'installment_reminder_deliveries',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    installmentIndex: integer('installment_index').notNull(),
    reminderDate: varchar('reminder_date', { length: 10 }).notNull(),
    reminderSlot: integer('reminder_slot').notNull(),
    deliveredChannels: jsonb('delivered_channels').$type<{ telegram: boolean; bale: boolean; sms: boolean }>().notNull().default(sql`'{"telegram":false,"bale":false,"sms":false}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('installment_reminders_daily_slot_key').on(t.userId, t.reminderDate, t.reminderSlot),
    index('installment_reminders_user_idx').on(t.userId),
    index('installment_reminders_date_idx').on(t.reminderDate),
  ],
);


/* ------------------------------------------------------------------ *
 * Warehouses & Attributes
 * ------------------------------------------------------------------ */

export const warehouses = pgTable(
  'warehouses',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 80 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    ...syncColumns,
  },
  (t) => [uniqueIndex('warehouses_code_key').on(t.code)],
);

export const attributes = pgTable(
  'attributes',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    type: varchar('type', { length: 20 }).notNull().default('text'),
    options: jsonb('options').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    ...syncColumns,
  },
  (t) => [uniqueIndex('attributes_name_key').on(t.name)],
);

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
    parentProductId: varchar('parent_product_id', { length: 80 }),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    brandId: integer('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    color: varchar('color', { length: 160 }),
    colorEn: varchar('color_en', { length: 160 }),
    colorCode: varchar('color_code', { length: 32 }),
    price: bigint('price', { mode: 'number' }).notNull().default(0),
    /** Latest unit acquisition cost, used for inventory valuation and profit snapshots. */
    costPrice: bigint('cost_price', { mode: 'number' }).notNull().default(0),
    oldPrice: bigint('old_price', { mode: 'number' }),
    discount: integer('discount').notNull().default(0),
    stock: integer('stock').notNull().default(0),
    kermanStock: integer('kerman_stock').notNull().default(0),
    tehranStock: integer('tehran_stock').notNull().default(0),
    otherStocks: jsonb('other_stocks').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    warranty: varchar('warranty', { length: 300 }),
    sellType: varchar('sell_type', { length: 200 }),
    seller: varchar('seller', { length: 200 }),
    promotion: boolean('promotion').notNull().default(false),
    status: productStatusEnum('status').notNull().default('active'),
    subTitle: varchar('sub_title', { length: 400 }),
    description: text('description'),
    keywords: varchar('keywords', { length: 500 }),
    slug: varchar('slug', { length: 200 }),
    ribbon: varchar('ribbon', { length: 50 }),
    type: varchar('type', { length: 50 }).notNull().default('physical'),
    weight: integer('weight').notNull().default(0),
    dimensions: varchar('dimensions', { length: 100 }),
    tracking: boolean('tracking').notNull().default(true),
    imageUrl: varchar('image_url', { length: 1000 }),
    gallery: jsonb('gallery').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    attributes: jsonb('attributes').$type<ProductAttribute[]>().notNull().default(sql`'[]'::jsonb`),
    /** Imported editorial rating, normalized to the storefront's 0–5 scale. */
    rating: integer('rating'),
    ratingCount: integer('rating_count').notNull().default(0),
    externalDataUpdatedAt: timestamp('external_data_updated_at', { withTimezone: true }),
    bundleItems: jsonb('bundle_items').$type<{ productId: string, qty: number }[]>().notNull().default(sql`'[]'::jsonb`),
    digikalaLink: varchar('digikala_link', { length: 1000 }),
    targetSiteUrl: varchar('target_site_url', { length: 1000 }),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Lowercased haystack (title + model + brand + colour + sku) for fast ILIKE search. */
    searchText: text('search_text').notNull().default(''),
    ...syncColumns,
  },
  (t) => [
    uniqueIndex('products_product_id_key').on(t.productId),
    index('products_category_idx').on(t.categoryId),
    index('products_brand_idx').on(t.brandId),
    index('products_parent_idx').on(t.parentProductId),
    index('products_title_idx').on(t.title),
    index('products_status_idx').on(t.status),
    index('products_promotion_idx').on(t.promotion),
    index('products_updated_idx').on(t.updatedAt),
    index('products_search_idx').using('gin', sql`${t.searchText} gin_trgm_ops`),
  ],
);

/** Supplier/competitor websites that admins may attach to products for stock and price monitoring. */
export const trackingSites = pgTable(
  'tracking_sites',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    baseUrl: varchar('base_url', { length: 1000 }),
    priceUnit: varchar('price_unit', { length: 10 }).notNull().default('toman'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('tracking_sites_name_key').on(t.name)],
);

export const productTrackingLinks = pgTable(
  'product_tracking_links',
  {
    id: serial('id').primaryKey(),
    productDbId: integer('product_db_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    siteId: integer('site_id').notNull().references(() => trackingSites.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 1000 }).notNull(),
    lastPrice: bigint('last_price', { mode: 'number' }),
    inStock: boolean('in_stock'),
    quantity: integer('quantity').notNull().default(0),
    statusText: varchar('status_text', { length: 500 }),
    lastError: varchar('last_error', { length: 1000 }),
    checkedAt: timestamp('checked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('product_tracking_links_product_site_key').on(t.productDbId, t.siteId),
    index('product_tracking_links_product_idx').on(t.productDbId),
    index('product_tracking_links_site_idx').on(t.siteId),
  ],
);

/* ------------------------------------------------------------------ *
 * Access Groups & Permissions
 * ------------------------------------------------------------------ */

export const accessGroups = pgTable(
  'access_groups',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    permissions: jsonb('permissions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('access_groups_name_key').on(t.name)],
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
    nationalCode: varchar('national_code', { length: 20 }).notNull().default(''),
    birthDate: varchar('birth_date', { length: 20 }).notNull().default(''),
    fatherName: varchar('father_name', { length: 120 }).notNull().default(''),
    isVerifiedIdentity: boolean('is_verified_identity').notNull().default(false),
    isActive: boolean('is_active').notNull().default(false),
    role: userRoleEnum('role').notNull().default('customer'),
    accessGroupId: integer('access_group_id').references(() => accessGroups.id, { onDelete: 'set null' }),
    passwordHash: varchar('password_hash', { length: 255 }),
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
 * Customer Telegram bot linking
 * ------------------------------------------------------------------ */

export const customerTelegramAccounts = pgTable(
  'customer_telegram_accounts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    telegramUserId: varchar('telegram_user_id', { length: 32 }).notNull(),
    chatId: varchar('chat_id', { length: 32 }).notNull(),
    username: varchar('username', { length: 120 }),
    firstName: varchar('first_name', { length: 160 }),
    lastName: varchar('last_name', { length: 160 }),
    notificationsEnabled: boolean('notifications_enabled').notNull().default(true),
    notificationPreferences: jsonb('notification_preferences').$type<Record<string, boolean>>().notNull().default(sql`'{}'::jsonb`),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('customer_telegram_accounts_user_key').on(t.userId),
    uniqueIndex('customer_telegram_accounts_telegram_user_key').on(t.telegramUserId),
    index('customer_telegram_accounts_chat_idx').on(t.chatId),
  ],
);

export const customerTelegramLinkTokens = pgTable(
  'customer_telegram_link_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('customer_telegram_link_tokens_hash_key').on(t.tokenHash),
    index('customer_telegram_link_tokens_user_idx').on(t.userId),
    index('customer_telegram_link_tokens_expires_idx').on(t.expiresAt),
  ],
);

/** Domestic customer-bot identity. Kept separate from Telegram so either service can be disconnected independently. */
export const customerBaleAccounts = pgTable(
  'customer_bale_accounts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    baleUserId: varchar('bale_user_id', { length: 32 }).notNull(),
    chatId: varchar('chat_id', { length: 32 }).notNull(),
    username: varchar('username', { length: 120 }),
    firstName: varchar('first_name', { length: 160 }),
    lastName: varchar('last_name', { length: 160 }),
    notificationsEnabled: boolean('notifications_enabled').notNull().default(true),
    notificationPreferences: jsonb('notification_preferences').$type<Record<string, boolean>>().notNull().default(sql`'{}'::jsonb`),
    linkedAt: timestamp('linked_at', { withTimezone: true }).notNull().defaultNow(),
    lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('customer_bale_accounts_user_key').on(t.userId),
    uniqueIndex('customer_bale_accounts_bale_user_key').on(t.baleUserId),
    index('customer_bale_accounts_chat_idx').on(t.chatId),
  ],
);

export const customerBaleLinkTokens = pgTable(
  'customer_bale_link_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('customer_bale_link_tokens_hash_key').on(t.tokenHash),
    index('customer_bale_link_tokens_user_idx').on(t.userId),
    index('customer_bale_link_tokens_expires_idx').on(t.expiresAt),
  ],
);

export const discountCodes = pgTable(
  'discount_codes',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 40 }).notNull(),
    kind: discountKindEnum('kind').notNull(),
    value: bigint('value', { mode: 'number' }).notNull().default(0),
    firstOrderOnly: boolean('first_order_only').notNull().default(false),
    minOrderAmount: bigint('min_order_amount', { mode: 'number' }).notNull().default(0),
    maxDiscountAmount: bigint('max_discount_amount', { mode: 'number' }),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    usageLimit: integer('usage_limit').notNull().default(1),
    usedCount: integer('used_count').notNull().default(0),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('discount_codes_code_key').on(t.code),
    index('discount_codes_user_idx').on(t.userId),
    index('discount_codes_active_idx').on(t.isActive),
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
    /** Sum of catalogue line prices before payment discounts or service fees. */
    subtotal: bigint('subtotal', { mode: 'number' }).notNull().default(0),
    total: bigint('total', { mode: 'number' }).notNull().default(0),
    quantity: integer('quantity').notNull().default(1),
    status: orderStatusEnum('status').notNull().default('new'),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('unpaid'),
    paymentMethod: varchar('payment_method', { length: 100 }),
    /** Immutable snapshot of the selected payment rule at checkout time. */
    paymentPlan: jsonb('payment_plan').$type<PaymentPlanQuote>(),
    discountCode: varchar('discount_code', { length: 40 }),
    discountAmount: bigint('discount_amount', { mode: 'number' }).notNull().default(0),
    freeShipping: boolean('free_shipping').notNull().default(false),
    note: text('note'),
    acquisitionSource: varchar('acquisition_source', { length: 120 }),
    acquisitionMedium: varchar('acquisition_medium', { length: 120 }),
    acquisitionCampaign: varchar('acquisition_campaign', { length: 200 }),
    acquisitionReferrer: text('acquisition_referrer'),
    acquisitionLandingPage: text('acquisition_landing_page'),
    ...syncColumns,
  },
  (t) => [
    uniqueIndex('orders_code_key').on(t.orderCode),
    index('orders_user_idx').on(t.userId),
    index('orders_status_idx').on(t.status),
    index('orders_created_idx').on(t.createdAt),
    index('orders_acquisition_source_idx').on(t.acquisitionSource),
  ],
);

export const discountRedemptions = pgTable(
  'discount_redemptions',
  {
    id: serial('id').primaryKey(),
    discountCodeId: integer('discount_code_id').notNull().references(() => discountCodes.id, { onDelete: 'restrict' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    discountAmount: bigint('discount_amount', { mode: 'number' }).notNull().default(0),
    freeShipping: boolean('free_shipping').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('discount_redemptions_order_key').on(t.orderId),
    index('discount_redemptions_code_idx').on(t.discountCodeId),
    index('discount_redemptions_user_idx').on(t.userId),
  ],
);

export const orderPaymentInstructions = pgTable(
  'order_payment_instructions',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    status: paymentInstructionStatusEnum('status').notNull().default('pending'),
    accountId: varchar('account_id', { length: 80 }),
    instructions: text('instructions'),
    channels: jsonb('channels').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    sentBy: integer('sent_by').references(() => users.id, { onDelete: 'set null' }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('order_payment_instructions_order_key').on(t.orderId), index('order_payment_instructions_status_idx').on(t.status)],
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
    /** Acquisition cost frozen at checkout for auditable historical profit. */
    costPrice: bigint('cost_price', { mode: 'number' }).notNull().default(0),
    qty: integer('qty').notNull().default(1),
    warehouse: warehouseEnum('warehouse').notNull().default('kerman'),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

/**
 * Exact physical units held for an order. Bundle rows point at their real
 * component products, so releasing an order never depends on a bundle's
 * current (and possibly edited) composition.
 */
export const inventoryReservations = pgTable(
  'inventory_reservations',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    warehouse: warehouseEnum('warehouse').notNull(),
    quantity: integer('quantity').notNull(),
    status: inventoryReservationStatusEnum('status').notNull().default('reserved'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    committedAt: timestamp('committed_at', { withTimezone: true }),
    releasedAt: timestamp('released_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('inventory_reservations_order_product_warehouse_key').on(t.orderId, t.productId, t.warehouse),
    index('inventory_reservations_order_status_idx').on(t.orderId, t.status),
    index('inventory_reservations_product_status_idx').on(t.productId, t.status),
  ],
);

/* ------------------------------------------------------------------ *
 * Wallets — the account is a cached balance; the immutable ledger is
 * the source of truth. Every mutation is performed while row-locked.
 * ------------------------------------------------------------------ */

export const walletAccounts = pgTable(
  'wallet_accounts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    balance: bigint('balance', { mode: 'number' }).notNull().default(0),
    lifetimeCredit: bigint('lifetime_credit', { mode: 'number' }).notNull().default(0),
    lifetimeDebit: bigint('lifetime_debit', { mode: 'number' }).notNull().default(0),
    isFrozen: boolean('is_frozen').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('wallet_accounts_user_key').on(t.userId), index('wallet_accounts_balance_idx').on(t.balance)],
);

export const walletTransactions = pgTable(
  'wallet_transactions',
  {
    id: serial('id').primaryKey(),
    walletId: integer('wallet_id').notNull().references(() => walletAccounts.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
    direction: walletDirectionEnum('direction').notNull(),
    type: walletTransactionTypeEnum('type').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    balanceAfter: bigint('balance_after', { mode: 'number' }).notNull(),
    description: text('description').notNull(),
    reference: varchar('reference', { length: 200 }),
    idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('wallet_transactions_idempotency_key').on(t.idempotencyKey),
    index('wallet_transactions_user_created_idx').on(t.userId, t.createdAt),
    index('wallet_transactions_order_idx').on(t.orderId),
  ],
);

/* ------------------------------------------------------------------ *
 * Payments & Transactions
 * ------------------------------------------------------------------ */

export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    amount: bigint('amount', { mode: 'number' }).notNull().default(0),
    gateway: paymentGatewayEnum('gateway').notNull().default('card_to_card'),
    refId: varchar('ref_id', { length: 200 }),
    trackingCode: varchar('tracking_code', { length: 200 }),
    status: paymentTransactionStatusEnum('status').notNull().default('pending'),
    cardPan: varchar('card_pan', { length: 50 }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('payments_order_idx').on(t.orderId),
    index('payments_user_idx').on(t.userId),
    index('payments_status_idx').on(t.status),
    index('payments_created_idx').on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ *
 * Comments & Reviews
 * ------------------------------------------------------------------ */

export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    guestName: varchar('guest_name', { length: 150 }),
    guestEmail: varchar('guest_email', { length: 150 }),
    rating: integer('rating').notNull().default(5),
    content: text('content').notNull(),
    replyTo: integer('reply_to'),
    status: commentStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('comments_product_idx').on(t.productId),
    index('comments_status_idx').on(t.status),
    index('comments_created_idx').on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ *
 * Customer support chat
 * ------------------------------------------------------------------ */

export const customerChatConversations = pgTable(
  'customer_chat_conversations',
  {
    id: serial('id').primaryKey(),
    visitorTokenHash: varchar('visitor_token_hash', { length: 64 }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    firstName: varchar('first_name', { length: 120 }).notNull(),
    lastName: varchar('last_name', { length: 120 }).notNull().default(''),
    email: varchar('email', { length: 200 }),
    phone: varchar('phone', { length: 20 }).notNull(),
    pageUrl: text('page_url'),
    deviceType: varchar('device_type', { length: 20 }).notNull().default('desktop'),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('customer_chat_conversations_token_key').on(t.visitorTokenHash),
    index('customer_chat_conversations_status_idx').on(t.status, t.lastMessageAt),
    index('customer_chat_conversations_user_idx').on(t.userId),
  ],
);

export const customerChatMessages = pgTable(
  'customer_chat_messages',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => customerChatConversations.id, { onDelete: 'cascade' }),
    senderRole: varchar('sender_role', { length: 20 }).notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('customer_chat_messages_conversation_idx').on(t.conversationId, t.createdAt),
  ],
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
    privateScope: varchar('private_scope', { length: 20 }).$type<'credit' | 'payment'>(),
    privateOwnerId: integer('private_owner_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('uploads_kind_idx').on(t.kind), index('uploads_checksum_idx').on(t.checksum),
    index('uploads_private_owner_idx').on(t.privateOwnerId),
    check('uploads_private_scope_check', sql`${t.privateScope} IS NULL OR ${t.privateScope} IN ('credit', 'payment')`),
  ],
);

/* ------------------------------------------------------------------ *
 * Sync bookkeeping
 * ------------------------------------------------------------------ */

export const documentReuploadRequests = pgTable('document_reupload_requests', {
  id: serial('id').primaryKey(),
  originalUploadId: integer('original_upload_id').notNull().references(() => uploads.id, { onDelete: 'restrict' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  requestedBy: integer('requested_by').references(() => users.id, { onDelete: 'set null' }),
  documentLabel: varchar('document_label', { length: 400 }).notNull(),
  message: text('message').notNull(),
  status: varchar('status', { length: 20 }).$type<'pending' | 'submitted' | 'completed' | 'cancelled'>().notNull().default('pending'),
  notificationDelivery: jsonb('notification_delivery').$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('document_reupload_user_idx').on(t.userId),
  uniqueIndex('document_reupload_open_idx').on(t.originalUploadId).where(sql`${t.status} IN ('pending', 'submitted')`),
  check('document_reupload_status_check', sql`${t.status} IN ('pending', 'submitted', 'completed', 'cancelled')`),
]);

export const documentReuploadSubmissions = pgTable('document_reupload_submissions', {
  id: serial('id').primaryKey(),
  requestId: integer('request_id').notNull().references(() => documentReuploadRequests.id, { onDelete: 'restrict' }),
  uploadId: integer('upload_id').notNull().references(() => uploads.id, { onDelete: 'restrict' }),
  status: varchar('status', { length: 20 }).$type<'pending' | 'approved' | 'rejected'>().notNull().default('pending'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewedBy: integer('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewNote: text('review_note'),
}, (t) => [
  index('document_reupload_submission_request_idx').on(t.requestId),
  uniqueIndex('document_reupload_pending_submission_idx').on(t.requestId).where(sql`${t.status} = 'pending'`),
  check('document_reupload_submission_status_check', sql`${t.status} IN ('pending', 'approved', 'rejected')`),
]);

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

export const crmSyncLogs = pgTable(
  'crm_sync_logs',
  {
    id: serial('id').primaryKey(),
    entity: crmSyncEntityEnum('entity').notNull(),
    entityKey: varchar('entity_key', { length: 200 }).notNull(),
    action: crmSyncActionEnum('action').notNull(),
    status: crmSyncStatusEnum('status').notNull(),
    remoteId: varchar('remote_id', { length: 200 }),
    error: text('error'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    response: jsonb('response').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    durationMs: integer('duration_ms'),
  },
  (t) => [
    index('crm_sync_logs_entity_idx').on(t.entity, t.entityKey),
    index('crm_sync_logs_status_idx').on(t.status),
    index('crm_sync_logs_created_idx').on(t.createdAt),
  ]
);

/* ------------------------------------------------------------------ *
 * Slides (Banners)
 * ------------------------------------------------------------------ */

export const slides = pgTable(
  'slides',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }),
    imageUrl: varchar('image_url', { length: 1000 }).notNull(),
    mobileImageUrl: varchar('mobile_image_url', { length: 1000 }),
    linkUrl: varchar('link_url', { length: 1000 }),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('slides_active_sort_idx').on(t.isActive, t.sortOrder)]
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
  payments: many(payments),
  discountRedemption: one(discountRedemptions),
  paymentInstructions: one(orderPaymentInstructions),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  orders: many(orders),
  sessions: many(sessions),
  payments: many(payments),
  comments: many(comments),
  customerTelegramAccount: one(customerTelegramAccounts),
  customerBaleAccount: one(customerBaleAccounts),
  accessGroup: one(accessGroups, { fields: [users.accessGroupId], references: [accessGroups.id] }),
}));

export const customerTelegramAccountsRelations = relations(customerTelegramAccounts, ({ one }) => ({
  user: one(users, { fields: [customerTelegramAccounts.userId], references: [users.id] }),
}));

export const customerTelegramLinkTokensRelations = relations(customerTelegramLinkTokens, ({ one }) => ({
  user: one(users, { fields: [customerTelegramLinkTokens.userId], references: [users.id] }),
}));

export const customerBaleAccountsRelations = relations(customerBaleAccounts, ({ one }) => ({
  user: one(users, { fields: [customerBaleAccounts.userId], references: [users.id] }),
}));

export const customerBaleLinkTokensRelations = relations(customerBaleLinkTokens, ({ one }) => ({
  user: one(users, { fields: [customerBaleLinkTokens.userId], references: [users.id] }),
}));

export const discountCodesRelations = relations(discountCodes, ({ one, many }) => ({
  user: one(users, { fields: [discountCodes.userId], references: [users.id] }),
  redemptions: many(discountRedemptions),
}));

export const discountRedemptionsRelations = relations(discountRedemptions, ({ one }) => ({
  code: one(discountCodes, { fields: [discountRedemptions.discountCodeId], references: [discountCodes.id] }),
  order: one(orders, { fields: [discountRedemptions.orderId], references: [orders.id] }),
}));

export const orderPaymentInstructionsRelations = relations(orderPaymentInstructions, ({ one }) => ({
  order: one(orders, { fields: [orderPaymentInstructions.orderId], references: [orders.id] }),
}));

export const accessGroupsRelations = relations(accessGroups, ({ many }) => ({
  users: many(users),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
  user: one(users, { fields: [payments.userId], references: [users.id] }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  product: one(products, { fields: [comments.productId], references: [products.id] }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
  parent: one(comments, { fields: [comments.replyTo], references: [comments.id], relationName: 'replies' }),
  replies: many(comments, { relationName: 'replies' }),
}));

export const customerChatConversationsRelations = relations(customerChatConversations, ({ one, many }) => ({
  user: one(users, { fields: [customerChatConversations.userId], references: [users.id] }),
  messages: many(customerChatMessages),
}));

export const customerChatMessagesRelations = relations(customerChatMessages, ({ one }) => ({
  conversation: one(customerChatConversations, {
    fields: [customerChatMessages.conversationId],
    references: [customerChatConversations.id],
  }),
}));

/** Native notification registrations are tied to a live login session. */
export const nativePushDevices = pgTable('native_push_devices', {
  installationId: varchar('installation_id', { length: 36 }).primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionHash: varchar('session_hash', { length: 64 }).notNull(),
  token: text('token').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('native_push_devices_user_idx').on(t.userId)]);
