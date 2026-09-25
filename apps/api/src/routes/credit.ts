import { eq, desc, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { creditApplicationWriteSchema } from '@tamas/shared';
import { db, schema } from '../db/client.js';
import { badRequest, notFound } from '../lib/errors.js';

const routes: FastifyPluginAsync = async (app) => {
  // Ensure table exists safely if migration didn't run
  await db.execute(
    sql`CREATE TABLE IF NOT EXISTS credit_applications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      national_id VARCHAR(20) NOT NULL,
      business_type VARCHAR(100) NOT NULL,
      national_card_url TEXT NOT NULL,
      business_docs_url TEXT NOT NULL,
      check_image_url TEXT NOT NULL,
      bank_statement_url TEXT,
      referral_info TEXT,
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      rejection_reason TEXT,
      admin_credit_score INTEGER NOT NULL DEFAULT 0,
      assigned_credit_limit BIGINT NOT NULL DEFAULT 0,
      internal_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  ).catch(() => {});

  // Get current user's credit application status
  app.get('/credit/my-application', { preHandler: [app.requireUser] }, async (req, reply) => {
    const user = req.currentUser!;
    const [existing] = await db
      .select()
      .from(schema.creditApplications)
      .where(eq(schema.creditApplications.userId, user.id))
      .orderBy(desc(schema.creditApplications.createdAt))
      .limit(1);

    if (!existing) {
      return reply.send({ ok: true, application: null });
    }

    return reply.send({
      ok: true,
      application: {
        id: existing.id,
        userId: existing.userId,
        nationalId: existing.nationalId,
        businessType: existing.businessType,
        nationalCardUrl: existing.nationalCardUrl,
        businessDocsUrl: existing.businessDocsUrl,
        checkImageUrl: existing.checkImageUrl,
        bankStatementUrl: existing.bankStatementUrl,
        referralInfo: existing.referralInfo,
        status: existing.status,
        rejectionReason: existing.rejectionReason,
        adminCreditScore: existing.adminCreditScore,
        assignedCreditLimit: Number(existing.assignedCreditLimit),
        internalNotes: existing.internalNotes,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      },
    });
  });

  // Submit or update credit application
  app.post('/credit/apply', { preHandler: [app.requireUser] }, async (req, reply) => {
    const user = req.currentUser!;
    const body = creditApplicationWriteSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(schema.creditApplications)
      .where(eq(schema.creditApplications.userId, user.id))
      .orderBy(desc(schema.creditApplications.createdAt))
      .limit(1);

    let resultId: number;

    if (existing) {
      const [updated] = await db
        .update(schema.creditApplications)
        .set({
          nationalId: body.nationalId,
          businessType: body.businessType,
          nationalCardUrl: body.nationalCardUrl,
          businessDocsUrl: body.businessDocsUrl,
          checkImageUrl: body.checkImageUrl,
          bankStatementUrl: body.bankStatementUrl || null,
          referralInfo: body.referralInfo || null,
          status: 'pending',
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.creditApplications.id, existing.id))
        .returning();
      if (!updated) throw badRequest('خطا در بروزرسانی پرونده اعتباری.');
      resultId = updated.id;
    } else {
      const [inserted] = await db
        .insert(schema.creditApplications)
        .values({
          userId: user.id,
          nationalId: body.nationalId,
          businessType: body.businessType,
          nationalCardUrl: body.nationalCardUrl,
          businessDocsUrl: body.businessDocsUrl,
          checkImageUrl: body.checkImageUrl,
          bankStatementUrl: body.bankStatementUrl || null,
          referralInfo: body.referralInfo || null,
          status: 'pending',
        })
        .returning();
      if (!inserted) throw badRequest('خطا در ثبت پرونده اعتباری.');
      resultId = inserted.id;
    }

    const [record] = await db
      .select()
      .from(schema.creditApplications)
      .where(eq(schema.creditApplications.id, resultId))
      .limit(1);

    if (!record) throw notFound('پرونده یافت نشد.');

    return reply.send({
      ok: true,
      application: {
        id: record.id,
        userId: record.userId,
        nationalId: record.nationalId,
        businessType: record.businessType,
        nationalCardUrl: record.nationalCardUrl,
        businessDocsUrl: record.businessDocsUrl,
        checkImageUrl: record.checkImageUrl,
        bankStatementUrl: record.bankStatementUrl,
        referralInfo: record.referralInfo,
        status: record.status,
        rejectionReason: record.rejectionReason,
        adminCreditScore: record.adminCreditScore,
        assignedCreditLimit: Number(record.assignedCreditLimit),
        internalNotes: record.internalNotes,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      },
    });
  });
};

export default routes;
