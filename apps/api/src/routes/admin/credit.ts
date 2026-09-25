import type { FastifyPluginAsync } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { creditApplicationAdminPatchSchema } from '@tamas/shared';
import { db, schema } from '../../db/client.js';
import { badRequest, notFound } from '../../lib/errors.js';

export const adminCreditRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requirePermission('manage_users'));

  // Get all credit applications for admin review
  app.get('/admin/credit-applications', async (_req, reply) => {
    const list = await db
      .select({
        id: schema.creditApplications.id,
        userId: schema.creditApplications.userId,
        userName: schema.users.name,
        userLastName: schema.users.lastName,
        userPhone: schema.users.phone,
        userStoreName: schema.users.storeName,
        nationalId: schema.creditApplications.nationalId,
        businessType: schema.creditApplications.businessType,
        nationalCardUrl: schema.creditApplications.nationalCardUrl,
        businessDocsUrl: schema.creditApplications.businessDocsUrl,
        checkImageUrl: schema.creditApplications.checkImageUrl,
        bankStatementUrl: schema.creditApplications.bankStatementUrl,
        referralInfo: schema.creditApplications.referralInfo,
        status: schema.creditApplications.status,
        rejectionReason: schema.creditApplications.rejectionReason,
        adminCreditScore: schema.creditApplications.adminCreditScore,
        assignedCreditLimit: schema.creditApplications.assignedCreditLimit,
        internalNotes: schema.creditApplications.internalNotes,
        createdAt: schema.creditApplications.createdAt,
        updatedAt: schema.creditApplications.updatedAt,
      })
      .from(schema.creditApplications)
      .innerJoin(schema.users, eq(schema.creditApplications.userId, schema.users.id))
      .orderBy(desc(schema.creditApplications.createdAt));

    const formatted = list.map((item) => ({
      id: item.id,
      userId: item.userId,
      userName: `${item.userName || ''} ${item.userLastName || ''}`.trim() || 'کاربر',
      userPhone: item.userPhone,
      userStoreName: item.userStoreName || '',
      nationalId: item.nationalId,
      businessType: item.businessType,
      nationalCardUrl: item.nationalCardUrl,
      businessDocsUrl: item.businessDocsUrl,
      checkImageUrl: item.checkImageUrl,
      bankStatementUrl: item.bankStatementUrl,
      referralInfo: item.referralInfo,
      status: item.status,
      rejectionReason: item.rejectionReason,
      adminCreditScore: item.adminCreditScore,
      assignedCreditLimit: Number(item.assignedCreditLimit),
      internalNotes: item.internalNotes,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    return reply.send({ ok: true, items: formatted });
  });

  // Admin update credit application status, limit, score, rejection notes
  app.patch('/admin/credit-applications/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const numericId = Number(id);
    if (isNaN(numericId)) throw badRequest('شناسه درخواست اعتباری معتبر نیست.');

    const body = creditApplicationAdminPatchSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(schema.creditApplications)
      .where(eq(schema.creditApplications.id, numericId))
      .limit(1);

    if (!existing) throw notFound('درخواست اعتباری یافت نشد.');

    const updates: Record<string, any> = {
      status: body.status,
      updatedAt: new Date(),
    };

    if (body.assignedCreditLimit !== undefined) updates.assignedCreditLimit = body.assignedCreditLimit;
    if (body.adminCreditScore !== undefined) updates.adminCreditScore = body.adminCreditScore;
    if (body.rejectionReason !== undefined) updates.rejectionReason = body.rejectionReason;
    if (body.internalNotes !== undefined) updates.internalNotes = body.internalNotes;

    const [updated] = await db
      .update(schema.creditApplications)
      .set(updates)
      .where(eq(schema.creditApplications.id, numericId))
      .returning();

    if (!updated) throw notFound('به‌روزرسانی پرونده اعتباری انجام نشد.');

    return reply.send({
      ok: true,
      application: {
        id: updated.id,
        userId: updated.userId,
        nationalId: updated.nationalId,
        businessType: updated.businessType,
        nationalCardUrl: updated.nationalCardUrl,
        businessDocsUrl: updated.businessDocsUrl,
        checkImageUrl: updated.checkImageUrl,
        bankStatementUrl: updated.bankStatementUrl,
        referralInfo: updated.referralInfo,
        status: updated.status,
        rejectionReason: updated.rejectionReason,
        adminCreditScore: updated.adminCreditScore,
        assignedCreditLimit: Number(updated.assignedCreditLimit),
        internalNotes: updated.internalNotes,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  });
};

export default adminCreditRoutes;
