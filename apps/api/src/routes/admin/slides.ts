import { desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { slides } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import { logAction } from '../../services/audit.js';

const slideSchema = z.object({
  title: z.string().optional(),
  imageUrl: z.string().min(1, 'Image is required'),
  linkUrl: z.string().optional(),
  sortOrder: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireAdmin);

  app.get('/admin/slides', async () => {
    const list = await db.select().from(slides).orderBy(desc(slides.sortOrder), desc(slides.id));
    return list;
  });

  app.post('/admin/slides', async (req, reply) => {
    const data = slideSchema.parse(req.body);
    const [created] = await db.insert(slides).values(data).returning();
    await logAction(req.user!.id, 'CREATE_SLIDE', 'slides', created.id, data);
    reply.code(201);
    return created;
  });

  app.put('/admin/slides/:id', async (req) => {
    const id = parseInt((req.params as { id: string }).id, 10);
    const data = slideSchema.parse(req.body);
    
    const [updated] = await db
      .update(slides)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(slides.id, id))
      .returning();
      
    if (!updated) throw notFound('Slide not found');
    await logAction(req.user!.id, 'UPDATE_SLIDE', 'slides', id, data);
    return updated;
  });

  app.delete('/admin/slides/:id', async (req) => {
    const id = parseInt((req.params as { id: string }).id, 10);
    const [deleted] = await db.delete(slides).where(eq(slides.id, id)).returning();
    if (!deleted) throw notFound('Slide not found');
    await logAction(req.user!.id, 'DELETE_SLIDE', 'slides', id);
    return { success: true };
  });
};

export default routes;
