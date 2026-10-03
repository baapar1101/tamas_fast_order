import type { FastifyPluginAsync } from 'fastify';
import { count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { users, walletAccounts, walletTransactions } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import { applyWalletTransaction, ensureWallet } from '../../services/wallet.js';
import { logAction } from '../../services/audit.js';

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_orders'));

  app.get('/admin/wallets', async (req) => {
    const q = z.object({ q: z.string().trim().max(120).optional(), page: z.coerce.number().int().min(1).default(1), perPage: z.coerce.number().int().min(1).max(100).default(30) }).parse(req.query);
    const where = q.q ? or(ilike(users.phone, `%${q.q}%`), ilike(users.name, `%${q.q}%`), ilike(users.lastName, `%${q.q}%`), ilike(users.storeName, `%${q.q}%`)) : undefined;
    const [items, [total], [stats]] = await Promise.all([
      db.select({ userId: users.id, name: users.name, lastName: users.lastName, phone: users.phone, storeName: users.storeName, balance: walletAccounts.balance, lifetimeCredit: walletAccounts.lifetimeCredit, lifetimeDebit: walletAccounts.lifetimeDebit, isFrozen: walletAccounts.isFrozen, updatedAt: walletAccounts.updatedAt })
        .from(users).leftJoin(walletAccounts, eq(walletAccounts.userId, users.id)).where(where).orderBy(desc(walletAccounts.balance)).limit(q.perPage).offset((q.page - 1) * q.perPage),
      db.select({ n: count() }).from(users).where(where),
      db.select({ totalBalance: sql<number>`coalesce(sum(${walletAccounts.balance}), 0)::bigint`, totalCredit: sql<number>`coalesce(sum(${walletAccounts.lifetimeCredit}), 0)::bigint`, totalDebit: sql<number>`coalesce(sum(${walletAccounts.lifetimeDebit}), 0)::bigint`, frozen: sql<number>`count(*) filter (where ${walletAccounts.isFrozen})::int` }).from(walletAccounts),
    ]);
    return { ok: true, items: items.map((x) => ({ ...x, balance: x.balance ?? 0, lifetimeCredit: x.lifetimeCredit ?? 0, lifetimeDebit: x.lifetimeDebit ?? 0, isFrozen: x.isFrozen ?? false })), total: Number(total?.n ?? 0), page: q.page, perPage: q.perPage, stats: stats ?? { totalBalance: 0, totalCredit: 0, totalDebit: 0, frozen: 0 } };
  });

  app.get('/admin/wallets/:userId/transactions', async (req) => {
    const userId = z.coerce.number().int().positive().parse((req.params as any).userId);
    const entries = await db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt)).limit(100);
    return { ok: true, items: entries };
  });

  app.post('/admin/wallets/:userId/adjust', async (req) => {
    const userId = z.coerce.number().int().positive().parse((req.params as any).userId);
    const body = z.object({ direction: z.enum(['credit', 'debit']), amount: z.coerce.number().int().positive(), description: z.string().trim().min(3).max(500), reference: z.string().trim().max(200).optional() }).parse(req.body);
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw notFound('کاربر پیدا نشد.');
    const entry = await db.transaction((tx) => applyWalletTransaction(tx, { userId, direction: body.direction, type: 'adjustment', amount: body.amount, description: body.description, reference: body.reference, createdBy: req.currentUser!.id, idempotencyKey: `admin:${req.currentUser!.id}:${userId}:${crypto.randomUUID()}` }));
    await logAction(req.currentUser!.id, `wallet:${body.direction}`, 'wallet', String(userId), { amount: body.amount, description: body.description });
    return { ok: true, transaction: entry };
  });

  app.patch('/admin/wallets/:userId/status', async (req) => {
    const userId = z.coerce.number().int().positive().parse((req.params as any).userId);
    const { isFrozen } = z.object({ isFrozen: z.boolean() }).parse(req.body);
    const wallet = await db.transaction(async (tx) => {
      const current = await ensureWallet(tx, userId);
      const [updated] = await tx.update(walletAccounts).set({ isFrozen, updatedAt: new Date() }).where(eq(walletAccounts.id, current.id)).returning();
      return updated;
    });
    await logAction(req.currentUser!.id, isFrozen ? 'wallet:freeze' : 'wallet:unfreeze', 'wallet', String(userId));
    return { ok: true, wallet };
  });
};

export default routes;
