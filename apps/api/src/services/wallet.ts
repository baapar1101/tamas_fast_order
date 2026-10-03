import { desc, eq, sql } from 'drizzle-orm';
import { db, type Db } from '../db/client.js';
import { walletAccounts, walletTransactions } from '../db/schema.js';
import { badRequest, conflict } from '../lib/errors.js';

type DbClient = Db | Parameters<Parameters<typeof db.transaction>[0]>[0];
type Direction = 'credit' | 'debit';
type TransactionType = 'deposit' | 'purchase' | 'refund' | 'adjustment' | 'withdrawal';

export interface WalletMutation {
  userId: number;
  direction: Direction;
  type: TransactionType;
  amount: number;
  description: string;
  idempotencyKey: string;
  orderId?: number | null;
  reference?: string | null;
  createdBy?: number | null;
  metadata?: Record<string, unknown>;
}

export async function ensureWallet(tx: DbClient, userId: number) {
  await tx.insert(walletAccounts).values({ userId }).onConflictDoNothing({ target: walletAccounts.userId });
  const [wallet] = await tx.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).for('update').limit(1);
  if (!wallet) throw new Error('wallet account could not be created');
  return wallet;
}

/** Atomic, idempotent wallet mutation. Never update wallet balances elsewhere. */
export async function applyWalletTransaction(tx: DbClient, input: WalletMutation) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw badRequest('مبلغ تراکنش کیف پول نامعتبر است.');

  const [existing] = await tx.select().from(walletTransactions)
    .where(eq(walletTransactions.idempotencyKey, input.idempotencyKey)).limit(1);
  if (existing) return existing;

  const wallet = await ensureWallet(tx, input.userId);
  if (wallet.isFrozen && input.direction === 'debit') throw conflict('کیف پول مسدود است. برای پیگیری با پشتیبانی تماس بگیرید.');
  if (input.direction === 'debit' && wallet.balance < input.amount) {
    throw conflict('موجودی کیف پول کافی نیست.', { balance: wallet.balance, required: input.amount });
  }

  const balanceAfter = wallet.balance + (input.direction === 'credit' ? input.amount : -input.amount);
  await tx.update(walletAccounts).set({
    balance: balanceAfter,
    lifetimeCredit: input.direction === 'credit' ? wallet.lifetimeCredit + input.amount : wallet.lifetimeCredit,
    lifetimeDebit: input.direction === 'debit' ? wallet.lifetimeDebit + input.amount : wallet.lifetimeDebit,
    updatedAt: new Date(),
  }).where(eq(walletAccounts.id, wallet.id));

  const [entry] = await tx.insert(walletTransactions).values({
    walletId: wallet.id,
    userId: input.userId,
    orderId: input.orderId ?? null,
    direction: input.direction,
    type: input.type,
    amount: input.amount,
    balanceAfter,
    description: input.description,
    reference: input.reference ?? null,
    idempotencyKey: input.idempotencyKey,
    createdBy: input.createdBy ?? null,
    metadata: input.metadata ?? {},
  }).returning();
  if (!entry) throw new Error('wallet transaction insert failed');
  return entry;
}

export async function walletSnapshot(userId: number, limit = 20, offset = 0) {
  return db.transaction(async (tx) => {
    const wallet = await ensureWallet(tx, userId);
    const [entries, [total]] = await Promise.all([
      tx.select().from(walletTransactions).where(eq(walletTransactions.userId, userId))
        .orderBy(desc(walletTransactions.createdAt)).limit(limit).offset(offset),
      tx.select({ n: sql<number>`count(*)::int` }).from(walletTransactions).where(eq(walletTransactions.userId, userId)),
    ]);
    return { wallet, entries, total: Number(total?.n ?? 0) };
  });
}

export async function refundWalletOrder(tx: DbClient, order: { id: number; userId: number | null; total: number; orderCode: string; paymentMethod: string | null }) {
  if (order.paymentMethod !== 'wallet' || !order.userId) return null;
  return applyWalletTransaction(tx, {
    userId: order.userId,
    direction: 'credit',
    type: 'refund',
    amount: order.total,
    orderId: order.id,
    description: `بازگشت وجه سفارش ${order.orderCode}`,
    idempotencyKey: `order-refund:${order.id}`,
  });
}
