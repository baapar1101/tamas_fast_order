import type { FastifyPluginAsync } from 'fastify';
import { count, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { discountCodes } from '../../db/schema.js';
import { generateDiscountsForMissingCustomers } from '../../services/discounts.js';

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_settings'));

  app.get('/admin/discounts', async () => {
    const [items, [total], [active]] = await Promise.all([
      db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt)).limit(100),
      db.select({ value: count() }).from(discountCodes),
      db.select({ value: count() }).from(discountCodes).where(eq(discountCodes.isActive, true)),
    ]);
    return { ok: true, items, total: Number(total?.value ?? 0), active: Number(active?.value ?? 0) };
  });

  app.post('/admin/discounts/generate', async (req) => {
    const created = await generateDiscountsForMissingCustomers(req.currentUser!.id);
    return { ok: true, created, message: `${created.toLocaleString('fa-IR')} کد تخفیف اختصاصی ساخته شد.` };
  });
};

export default routes;
