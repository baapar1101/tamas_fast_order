import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { userPatchSchema } from '@tamas/shared';
import { db } from '../../db/client.js';
import { sessions, users } from '../../db/schema.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { offsetOf } from '../../lib/pagination.js';
import { toUserDTO } from '../../services/auth.js';
import { logAction } from '../../services/audit.js';
import { sendUserApprovedSms } from '../../services/sms.js';

const listQuery = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(['active', 'pending', 'all']).default('all'),
  role: z.enum(['customer', 'admin', 'operator', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
});

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_users'));

  app.get('/admin/users', async (req) => {
    const q = listQuery.parse(req.query);
    const filters: SQL[] = [isNull(users.deletedAt)];

    if (q.status === 'active') filters.push(eq(users.isActive, true));
    else if (q.status === 'pending') filters.push(eq(users.isActive, false));
    if (q.role !== 'all') filters.push(eq(users.role, q.role));
    if (q.q) {
      filters.push(
        or(
          ilike(users.phone, `%${q.q}%`),
          ilike(users.name, `%${q.q}%`),
          ilike(users.lastName, `%${q.q}%`),
          ilike(users.storeName, `%${q.q}%`),
        )!,
      );
    }

    const where = and(...filters);
    const [rows, [total]] = await Promise.all([
      db.select().from(users).where(where).orderBy(desc(users.createdAt)).limit(q.perPage).offset(offsetOf(q)),
      db.select({ n: count() }).from(users).where(where),
    ]);

    return {
      ok: true,
      items: rows.map(toUserDTO),
      total: Number(total?.n ?? 0),
      page: q.page,
      perPage: q.perPage,
    };
  });

  app.get('/admin/users/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const [row] = await db.select().from(users).where(and(eq(users.id, id), isNull(users.deletedAt))).limit(1);
    if (!row) throw notFound('کاربر پیدا نشد.');
    return { ok: true, user: toUserDTO(row) };
  });

  app.patch('/admin/users/:id', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const body = userPatchSchema.parse(req.body);
    const [current] = await db
      .select({ isActive: users.isActive })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    if (!current) throw notFound('کاربر پیدا نشد.');

    // An admin must not be able to lock themselves out of their own panel.
    if (id === req.currentUser!.id && (body.role === 'customer' || body.isActive === false)) {
      throw badRequest('نمی‌توانید دسترسی مدیریت خودتان را بردارید.');
    }

    // Only the super admin may promote or change role/access groups — an
    // operator holding manage_users must not escalate their own privileges.
    if (body.role !== undefined || body.accessGroupId !== undefined) {
      if (req.currentUser!.role !== 'admin') {
        throw forbidden('فقط مدیر ارشد می‌تواند نقش یا گروه دسترسی کاربران را تغییر دهد.');
      }
    }

    const [updated] = await db
      .update(users)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();
    if (!updated) throw notFound('کاربر پیدا نشد.');

    // Demoting or deactivating someone must end their live sessions too.
    if (body.role === 'customer' || body.isActive === false) {
      await db.delete(sessions).where(eq(sessions.userId, id));
    }

    await logAction(req.currentUser!.id, 'update', 'user', updated.phone, body as Record<string, unknown>);
    if (body.isActive !== undefined || body.role !== undefined) {
      const { sendTelegramNotification } = await import('../../services/telegram.js');
      void sendTelegramNotification('user.status_changed', {
        title: '👥 تغییر وضعیت کاربر',
        fields: [
          { label: 'کاربر', value: [updated.name, updated.lastName].filter(Boolean).join(' ') || updated.phone },
          { label: 'تلفن', value: updated.phone },
          { label: 'وضعیت', value: updated.isActive ? 'فعال' : 'غیرفعال' },
          { label: 'نقش', value: updated.role },
        ],
      }).catch((err) => req.log.error({ err }, 'failed to send Telegram user notification'));
    }
    if (body.isActive === true && current.isActive === false) {
      void sendUserApprovedSms(updated.phone)
        .then((result) => {
          if (!result.ok) req.log.error({ error: result.error, userId: updated.id }, 'failed to send user approval sms');
        })
        .catch((err) => req.log.error({ err, userId: updated.id }, 'failed to send user approval sms'));
    }
    return { ok: true, user: toUserDTO(updated) };
  });

  app.delete('/admin/users/:id', async (req) => {
    const id = z.coerce.number().int().positive().parse((req.params as { id: string }).id);
    if (id === req.currentUser!.id) throw badRequest('نمی‌توانید حساب کاربری خودتان را حذف کنید.');

    const deleted = await db.transaction(async (tx) => {
      const [target] = await tx
        .select()
        .from(users)
        .where(and(eq(users.id, id), isNull(users.deletedAt)))
        .for('update')
        .limit(1);
      if (!target) throw notFound('کاربر پیدا نشد یا قبلاً حذف شده است.');

      if (target.role === 'admin') {
        if (req.currentUser!.role !== 'admin') {
          throw forbidden('فقط مدیر ارشد می‌تواند حساب یک مدیر را حذف کند.');
        }
        if (target.isActive) {
          const [activeAdmins] = await tx
            .select({ n: count() })
            .from(users)
            .where(and(eq(users.role, 'admin'), eq(users.isActive, true), isNull(users.deletedAt)));
          if (Number(activeAdmins?.n ?? 0) <= 1) {
            throw badRequest('آخرین مدیر فعال قابل حذف نیست. ابتدا یک مدیر دیگر ایجاد کنید.');
          }
        }
      }

      // Keep the row for orders, wallet and audit references, but remove all
      // personal data and release the unique phone number for future signup.
      const replacementPhone = `9${String(id).padStart(7, '0').slice(-7)}${String(Date.now()).slice(-7)}`;
      const now = new Date();
      const [updated] = await tx
        .update(users)
        .set({
          phone: replacementPhone,
          name: 'کاربر حذف‌شده',
          lastName: '',
          storeName: '',
          landline: '',
          address: '',
          postalCode: '',
          certificateFileUrl: '',
          activity: '',
          pageWebsite: '',
          nationalCode: '',
          birthDate: '',
          fatherName: '',
          isVerifiedIdentity: false,
          isActive: false,
          role: 'customer',
          accessGroupId: null,
          passwordHash: null,
          deletedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, id))
        .returning({ id: users.id });
      await tx.delete(sessions).where(eq(sessions.userId, id));
      return { id: updated!.id, phone: target.phone, role: target.role };
    });

    await logAction(req.currentUser!.id, 'delete', 'user', deleted.phone, {
      userId: deleted.id,
      previousRole: deleted.role,
      mode: 'soft-delete-and-anonymize',
    });
    return { ok: true, message: 'کاربر حذف و اطلاعات شخصی او ناشناس‌سازی شد.' };
  });

  const bulkSchema = z.object({
    ids: z.array(z.coerce.number().int().positive()).min(1).max(300),
    action: z.enum(['activate', 'deactivate']),
  });

  app.post('/admin/users/bulk', async (req) => {
    const body = bulkSchema.parse(req.body);
    const ids = body.ids.filter((id) => id !== req.currentUser!.id);
    if (ids.length === 0) return { ok: true, changed: 0 };

    const isActive = body.action === 'activate';
    const changed = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(and(inArray(users.id, ids), eq(users.isActive, !isActive), isNull(users.deletedAt)))
      .returning({ id: users.id, phone: users.phone });

    if (!isActive) await db.delete(sessions).where(inArray(sessions.userId, ids));
    if (isActive) {
      void Promise.allSettled(changed.map(async (user) => {
        const result = await sendUserApprovedSms(user.phone);
        if (!result.ok) req.log.error({ error: result.error, userId: user.id }, 'failed to send bulk user approval sms');
      }));
    }
    const { sendTelegramNotification } = await import('../../services/telegram.js');
    void sendTelegramNotification('user.status_changed', {
      title: '👥 تغییر گروهی وضعیت کاربران',
      fields: [
        { label: 'تعداد کاربران', value: changed.length },
        { label: 'وضعیت جدید', value: isActive ? 'فعال' : 'غیرفعال' },
      ],
    }).catch((err) => req.log.error({ err }, 'failed to send Telegram bulk user notification'));
    await logAction(req.currentUser!.id, `bulk:${body.action}`, 'user', null, { count: changed.length });
    return { ok: true, changed: changed.length };
  });

  app.get('/admin/users/export', async (_req, reply) => {
    const rows = await db.select().from(users).where(isNull(users.deletedAt)).orderBy(desc(users.createdAt));
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['phone', 'name', 'last_name', 'store_name', 'landline', 'address', 'postal_code', 'active', 'role', 'created_at'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          esc(r.phone),
          esc(r.name),
          esc(r.lastName),
          esc(r.storeName),
          esc(r.landline),
          esc(r.address),
          esc(r.postalCode),
          esc(r.isActive ? 'TRUE' : 'FALSE'),
          esc(r.role),
          esc(r.createdAt.toISOString()),
        ].join(','),
      );
    }
    reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="users-${Date.now()}.csv"`);
    return `﻿${lines.join('\n')}`;
  });
};

export default routes;
