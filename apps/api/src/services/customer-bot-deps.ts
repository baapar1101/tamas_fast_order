import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import { catalogQuerySchema, type SavedCartLineDTO } from '@tamas/shared';
import { db } from '../db/client.js';
import { creditCheques, customerBotSessions, users, walletAccounts } from '../db/schema.js';
import { findOrCreateUser, type UserRow } from './auth.js';
import { quoteCartPaymentTerms } from './cart-quote.js';
import { findProductByPublicId, listCategories, queryProducts } from './catalog.js';
import { hasFreshCreditReport, latestCreditApplication, storeCreditReport, submitCreditApplication } from './credit-applications.js';
import { saveCustomerProfile, verifyCustomerIdentity } from './customer-profile.js';
import { BOT_SESSION_TTL_MS, parseBotPaymentMethods, type BotSession } from './customer-bot-model.js';
import type { CustomerBotDeps } from './customer-bot.js';
import { clearUserCart, getSavedCart, saveUserCart } from './funnel.js';
import { createGatewayPayment } from './gateway-payment.js';
import { submitOrderPaymentInfo } from './order-payment-info.js';
import { createOrder, getOrderByCode, listOrdersForUser } from './orders.js';
import { sendOtp, verifyOtp } from './otp.js';
import { getAllSettings, getPublicSettings } from './settings.js';
import { processUpload } from './uploads.js';

const silentLog = { warn: () => undefined, error: (obj: unknown, msg?: string) => console.error('[customer-bot]', msg ?? '', obj) };

/** The real services behind the customer bot. Each one is the same code the storefront's routes call. */
export function createCustomerBotDeps(): CustomerBotDeps {
  return {
    sessions: {
      async load(platform, botUserId) {
        const [row] = await db.select().from(customerBotSessions)
          .where(and(eq(customerBotSessions.platform, platform), eq(customerBotSessions.botUserId, botUserId))).limit(1);
        if (!row || row.expiresAt.getTime() <= Date.now()) return {};
        return row.state as BotSession;
      },
      async save(platform, botUserId, chatId, session) {
        const now = new Date();
        const values = { chatId, state: session as Record<string, unknown>, expiresAt: new Date(now.getTime() + BOT_SESSION_TTL_MS), updatedAt: now };
        await db.insert(customerBotSessions).values({ platform, botUserId, ...values })
          .onConflictDoUpdate({ target: [customerBotSessions.platform, customerBotSessions.botUserId], set: values });
      },
    },
    users: {
      async byId(id) {
        const [user] = await db.select().from(users).where(and(eq(users.id, id), isNull(users.deletedAt))).limit(1);
        return user ?? null;
      },
      async byPhone(phone) {
        const [user] = await db.select().from(users).where(and(eq(users.phone, phone), isNull(users.deletedAt))).limit(1);
        return user ?? null;
      },
      findOrCreate: (phone) => findOrCreateUser(phone),
    },
    otp: {
      async send(phone) {
        await sendOtp(phone, undefined);
      },
      verify: (phone, code) => verifyOtp(phone, code),
    },
    catalog: {
      categories: () => listCategories(),
      search: (query) => queryProducts(catalogQuerySchema.parse({ inStock: true, sort: 'featured', ...stripUndefined(query) })),
      product: (lookupId) => findProductByPublicId(lookupId),
    },
    cart: {
      get: (userId) => getSavedCart(userId),
      save: (userId, lines: SavedCartLineDTO[]) => saveUserCart(userId, lines),
      clear: (userId) => clearUserCart(userId),
    },
    checkout: {
      quote: (items) => quoteCartPaymentTerms(items),
      async paymentMethods() {
        return parseBotPaymentMethods((await getPublicSettings()).payment_methods);
      },
      async wallet(userId) {
        const [settings, [wallet]] = await Promise.all([
          getAllSettings(),
          db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1),
        ]);
        return {
          enabled: settings.WALLET_ENABLED !== 'false',
          orderPaymentEnabled: settings.WALLET_ORDER_PAYMENT_ENABLED !== 'false',
          isFrozen: wallet?.isFrozen ?? false,
          balance: wallet?.balance ?? 0,
        };
      },
      createOrder: (user, input) => createOrder(user, input),
      gatewayUrl: (userId, orderId) => createGatewayPayment(userId, orderId, silentLog),
      submitPaymentInfo: (userId, body) => submitOrderPaymentInfo(userId, body, silentLog),
    },
    orders: {
      list: (userId) => listOrdersForUser(userId, 50),
      byCode: (orderCode) => getOrderByCode(orderCode),
    },
    profile: {
      save: (user, body) => saveCustomerProfile(user, body, silentLog),
      verifyIdentity: (user, nationalCode, birthDate) => verifyCustomerIdentity(user, nationalCode, birthDate, silentLog),
    },
    credit: {
      async summary(userId) {
        const application = await latestCreditApplication(userId);
        if (!application) return null;
        const cheques = await db.select().from(creditCheques).where(eq(creditCheques.userId, userId)).orderBy(desc(creditCheques.createdAt)).limit(10);
        return {
          status: application.status,
          assignedCreditLimit: Number(application.assignedCreditLimit),
          rejectionReason: application.rejectionReason,
          pendingChequeAmount: cheques.filter((item) => item.status === 'pending').reduce((sum, item) => sum + item.amount, 0),
          bouncedCheques: cheques.filter((item) => item.status === 'bounced').length,
        };
      },
      hasFreshReport: (userId) => hasFreshCreditReport(userId),
      storeReport: (user, file) => storeCreditReport(user, file),
      submit: (user, body) => submitCreditApplication(user, body, silentLog),
    },
    wallet: {
      async summary(userId) {
        const [wallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);
        return wallet ? { balance: wallet.balance, lifetimeCredit: wallet.lifetimeCredit, lifetimeDebit: wallet.lifetimeDebit, isFrozen: wallet.isFrozen } : null;
      },
    },
    uploads: {
      async store(userId, file, scope) {
        const upload = await processUpload({
          buffer: file.buffer,
          filename: file.filename,
          mimeType: file.mimeType,
          kind: scope === 'credit' ? 'certificate' : 'other',
          uploadedBy: userId,
          privateScope: scope,
        });
        return upload.url;
      },
    },
  };
}

/** Deletes conversations that expired more than a day ago; called from the scheduler. */
export async function pruneCustomerBotSessions(): Promise<number> {
  const rows = await db.delete(customerBotSessions)
    .where(lt(customerBotSessions.expiresAt, new Date(Date.now() - 86_400_000)))
    .returning({ id: customerBotSessions.id });
  return rows.length;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

export type { UserRow };
