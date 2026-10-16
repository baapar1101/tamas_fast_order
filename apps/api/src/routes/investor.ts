import type { FastifyPluginAsync } from 'fastify';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { investmentEntries } from '../db/schema.js';
import { offsetOf } from '../lib/pagination.js';
import { buildInvestorDashboard, toInvestmentEntryDTO } from '../services/investor-finance.js';

const ranges = ['7d', '30d', '90d', '365d'] as const;

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireInvestor);

  app.get('/investor/dashboard', async (req) => {
    const { range } = z.object({ range: z.enum(ranges).default('30d') }).parse(req.query);
    return { ok: true, dashboard: await buildInvestorDashboard(range) };
  });

  app.get('/investor/entries', async (req) => {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      perPage: z.coerce.number().int().min(1).max(100).default(30),
      type: z.enum(['capital_injection', 'capital_withdrawal', 'purchase', 'expense', 'profit_distribution', 'adjustment', 'all']).default('all'),
    }).parse(req.query);
    const where = query.type === 'all'
      ? isNull(investmentEntries.deletedAt)
      : and(isNull(investmentEntries.deletedAt), eq(investmentEntries.type, query.type));
    const [rows, [total]] = await Promise.all([
      db.select().from(investmentEntries).where(where)
        .orderBy(desc(investmentEntries.transactionDate), desc(investmentEntries.id))
        .limit(query.perPage).offset(offsetOf(query)),
      db.select({ n: count() }).from(investmentEntries).where(where),
    ]);
    return { ok: true, items: rows.map(toInvestmentEntryDTO), total: Number(total?.n ?? 0), page: query.page, perPage: query.perPage };
  });
};

export default routes;
