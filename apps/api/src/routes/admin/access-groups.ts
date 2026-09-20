import type { FastifyPluginAsync } from 'fastify';
import { and, count, eq, isNull, not } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { accessGroups, users } from '../../db/schema.js';
import { notFound, conflict } from '../../lib/errors.js';

const groupSchema = z.object({
  name: z.string().min(2).max(160),
  permissions: z.array(z.string()).default([]),
});

export const accessGroupsRoutes: FastifyPluginAsync = async (app) => {
  // Only super admins (or those with manage_settings) can manage access groups
  // We'll use requirePermission('manage_settings') which will allow 'admin' implicitly.
  app.addHook('preHandler', app.requirePermission('manage_settings'));

  app.get('/admin/access-groups', async () => {
    const [rows, memberRows] = await Promise.all([
      db.select().from(accessGroups).orderBy(accessGroups.id),
      db
        .select({ accessGroupId: users.accessGroupId, n: count() })
        .from(users)
        .where(and(not(isNull(users.accessGroupId)), isNull(users.deletedAt)))
        .groupBy(users.accessGroupId),
    ]);
    const membersByGroup = new Map(memberRows.map((r) => [r.accessGroupId, Number(r.n)]));
    return {
      ok: true,
      groups: rows.map((g) => ({ ...g, memberCount: membersByGroup.get(g.id) ?? 0 })),
    };
  });

  app.post('/admin/access-groups', async (req) => {
    const body = groupSchema.parse(req.body);
    try {
      const [created] = await db
        .insert(accessGroups)
        .values({
          name: body.name,
          permissions: body.permissions,
        })
        .returning();
      return { ok: true, group: created };
    } catch (err: any) {
      if (err.code === '23505') throw conflict('گروهی با این نام از قبل وجود دارد.');
      throw err;
    }
  });

  app.put('/admin/access-groups/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const body = groupSchema.parse(req.body);

    try {
      const [updated] = await db
        .update(accessGroups)
        .set({
          name: body.name,
          permissions: body.permissions,
          updatedAt: new Date(),
        })
        .where(eq(accessGroups.id, id))
        .returning();
      if (!updated) throw notFound('گروه پیدا نشد.');
      return { ok: true, group: updated };
    } catch (err: any) {
      if (err.code === '23505') throw conflict('گروهی با این نام از قبل وجود دارد.');
      throw err;
    }
  });

  app.delete('/admin/access-groups/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const [memberRow] = await db
      .select({ n: count() })
      .from(users)
      .where(and(eq(users.accessGroupId, id), isNull(users.deletedAt)));
    if (Number(memberRow?.n ?? 0) > 0) {
      throw conflict('این گروه به کاربرانی اختصاص داده شده و قابل حذف نیست؛ ابتدا اعضای آن را جابه‌جا کنید.');
    }
    const [deleted] = await db.delete(accessGroups).where(eq(accessGroups.id, id)).returning({ id: accessGroups.id });
    if (!deleted) throw notFound('گروه پیدا نشد.');
    return { ok: true };
  });
};
