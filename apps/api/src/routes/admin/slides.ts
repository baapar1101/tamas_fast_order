import { desc, eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { slides } from '../../db/schema.js';
import { notFound } from '../../lib/errors.js';
import { logAction } from '../../services/audit.js';

const optionalLink = z.string().trim().max(1000).refine(
  (value) => !value || value.startsWith('/') || /^https?:\/\//i.test(value),
  'لینک باید داخلی باشد یا با http/https شروع شود.',
).optional().transform((value) => value || null);

const slideSchema = z.object({
  title: z.string().trim().max(255).optional().transform((value) => value || null),
  imageUrl: z.string().trim().min(1, 'تصویر دسکتاپ الزامی است.').max(1000),
  mobileImageUrl: z.string().trim().max(1000).optional().transform((value) => value || null),
  linkUrl: optionalLink,
  sortOrder: z.coerce.number().int().min(-10_000).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_content'));

  app.get('/admin/slides', async () => {
    const list = await db.select().from(slides).orderBy(desc(slides.sortOrder), desc(slides.id));
    return list;
  });

  app.post('/admin/slides', async (req, reply) => {
    const data = slideSchema.parse(req.body);
    const [created] = await db.insert(slides).values(data).returning();
    await logAction(req.currentUser!.id, 'CREATE_SLIDE', 'slides', String(created?.id), data);
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
    await logAction(req.currentUser!.id, 'UPDATE_SLIDE', 'slides', String(id), data);
    return updated;
  });

  app.delete('/admin/slides/:id', async (req) => {
    const id = parseInt((req.params as { id: string }).id, 10);
    const [deleted] = await db.delete(slides).where(eq(slides.id, id)).returning();
    if (!deleted) throw notFound('Slide not found');
    await logAction(req.currentUser!.id, 'DELETE_SLIDE', 'slides', String(id));
    return { success: true };
  });
};

export default routes;
