import { desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { attributes } from '../../db/schema.js';
import { notFound, badRequest } from '../../lib/errors.js';
import { logAction } from '../../services/audit.js';

const attributeSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1).max(20),
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireAdmin);

  app.get('/admin/attributes', async () => {
    const list = await db.select().from(attributes).orderBy(desc(attributes.createdAt));
    return list;
  });

  app.post('/admin/attributes', async (req, reply) => {
    const data = attributeSchema.parse(req.body);
    
    try {
      const [created] = await db.insert(attributes).values(data).returning();
      await logAction((req as any).user.id, 'CREATE_ATTRIBUTE', 'attributes', String(created?.id), data);
      reply.code(201);
      return created;
    } catch (err: any) {
      if (err.code === '23505') throw badRequest('نام ویژگی تکراری است');
      throw err;
    }
  });

  app.put('/admin/attributes/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const data = attributeSchema.parse(req.body);
    
    try {
      const [updated] = await db
        .update(attributes)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(attributes.id, id))
        .returning();
        
      if (!updated) throw notFound('ویژگی یافت نشد');
      await logAction((req as any).user.id, 'UPDATE_ATTRIBUTE', 'attributes', String(id), data);
      return updated;
    } catch (err: any) {
      if (err.code === '23505') throw badRequest('نام ویژگی تکراری است');
      throw err;
    }
  });

  app.delete('/admin/attributes/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const [deleted] = await db.delete(attributes).where(eq(attributes.id, id)).returning();
    if (!deleted) throw notFound('ویژگی یافت نشد');
    await logAction((req as any).user.id, 'DELETE_ATTRIBUTE', 'attributes', String(id));
    return { success: true };
  });
};

export default routes;
