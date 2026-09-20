import { desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { warehouses } from '../../db/schema.js';
import { notFound, badRequest } from '../../lib/errors.js';
import { logAction } from '../../services/audit.js';

const warehouseSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  location: z.string().optional(),
  isActive: z.boolean().default(true),
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_products'));

  app.get('/admin/warehouses', async () => {
    const list = await db.select().from(warehouses).orderBy(desc(warehouses.createdAt));
    return list;
  });

  app.post('/admin/warehouses', async (req, reply) => {
    const data = warehouseSchema.parse(req.body);
    
    try {
      const [created] = await db.insert(warehouses).values(data).returning();
      await logAction((req as any).user.id, 'CREATE_WAREHOUSE', 'warehouses', String(created?.id), data);
      reply.code(201);
      return created;
    } catch (err: any) {
      if (err.code === '23505') throw badRequest('کد انبار تکراری است');
      throw err;
    }
  });

  app.put('/admin/warehouses/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const data = warehouseSchema.parse(req.body);
    
    try {
      const [updated] = await db
        .update(warehouses)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(warehouses.id, id))
        .returning();
        
      if (!updated) throw notFound('انبار یافت نشد');
      await logAction((req as any).user.id, 'UPDATE_WAREHOUSE', 'warehouses', String(id), data);
      return updated;
    } catch (err: any) {
      if (err.code === '23505') throw badRequest('کد انبار تکراری است');
      throw err;
    }
  });

  app.delete('/admin/warehouses/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const [deleted] = await db.delete(warehouses).where(eq(warehouses.id, id)).returning();
    if (!deleted) throw notFound('انبار یافت نشد');
    await logAction((req as any).user.id, 'DELETE_WAREHOUSE', 'warehouses', String(id));
    return { success: true };
  });
};

export default routes;
