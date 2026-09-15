import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { comments, products, users } from '../../db/schema.js';
import { getAuth } from '../../plugins/auth.js';
import { count, desc, eq } from 'drizzle-orm';

const commentsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (req, reply) => {
    const auth = getAuth(req);
    if (!auth.complete || auth.user.role !== 'admin') {
      return reply.status(403).send({ ok: false, error: 'Unauthorized' });
    }
  });

  // GET /admin/comments/count
  app.get('/admin/comments/count', async () => {
    const [result] = await db.select({ total: count() }).from(comments);
    return { ok: true, count: result?.total ?? 0 };
  });

  // GET /admin/comments
  app.get('/admin/comments', async () => {
    const allComments = await db
      .select({
        id: comments.id,
        productId: comments.productId,
        productTitle: products.title,
        userId: comments.userId,
        guestName: comments.guestName,
        guestEmail: comments.guestEmail,
        rating: comments.rating,
        content: comments.content,
        replyTo: comments.replyTo,
        status: comments.status,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
      })
      .from(comments)
      .leftJoin(products, eq(comments.productId, products.id))
      .orderBy(desc(comments.createdAt))
      .limit(50);
    
    return {
      ok: true,
      items: allComments.map((c) => ({
        id: c.id,
        productId: c.productId,
        productTitle: c.productTitle,
        userId: c.userId,
        guestName: c.guestName,
        guestEmail: c.guestEmail,
        rating: c.rating,
        content: c.content,
        replyTo: c.replyTo,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      total: allComments.length,
      page: 1,
      perPage: 50,
    };
  });
};

export default commentsRoutes;
