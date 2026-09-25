import { creditChequeWriteSchema, creditApplicationWriteSchema, formatMoney } from '@tamas/shared';
import { desc, eq, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { db, schema } from '../db/client.js';
import { badRequest, notFound } from '../lib/errors.js';

const routes: FastifyPluginAsync = async (app) => {
  // Ensure tables exist safely if migration didn't run
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

  await db.execute(
    sql`CREATE TABLE IF NOT EXISTS credit_cheques (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      credit_application_id INTEGER REFERENCES credit_applications(id) ON DELETE SET NULL,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      cheque_number VARCHAR(80) NOT NULL,
      bank_name VARCHAR(120) NOT NULL,
      account_holder VARCHAR(160) NOT NULL,
      amount BIGINT NOT NULL,
      due_date VARCHAR(30) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      image_url TEXT,
      notes TEXT,
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

  // Get full Credit Dashboard (metrics, cheques, notifications)
  app.get('/credit/dashboard', { preHandler: [app.requireUser] }, async (req, reply) => {
    const user = req.currentUser!;
    const [appRecord] = await db
      .select()
      .from(schema.creditApplications)
      .where(eq(schema.creditApplications.userId, user.id))
      .orderBy(desc(schema.creditApplications.createdAt))
      .limit(1);

    const chequesList = await db
      .select()
      .from(schema.creditCheques)
      .where(eq(schema.creditCheques.userId, user.id))
      .orderBy(desc(schema.creditCheques.createdAt));

    const applicationDTO = appRecord
      ? {
          id: appRecord.id,
          userId: appRecord.userId,
          nationalId: appRecord.nationalId,
          businessType: appRecord.businessType,
          nationalCardUrl: appRecord.nationalCardUrl,
          businessDocsUrl: appRecord.businessDocsUrl,
          checkImageUrl: appRecord.checkImageUrl,
          bankStatementUrl: appRecord.bankStatementUrl,
          referralInfo: appRecord.referralInfo,
          status: appRecord.status,
          rejectionReason: appRecord.rejectionReason,
          adminCreditScore: appRecord.adminCreditScore,
          assignedCreditLimit: Number(appRecord.assignedCreditLimit),
          internalNotes: appRecord.internalNotes,
          createdAt: appRecord.createdAt.toISOString(),
          updatedAt: appRecord.updatedAt.toISOString(),
        }
      : null;

    const totalCreditLimit = applicationDTO?.status === 'active' ? applicationDTO.assignedCreditLimit : 0;
    
    // Used credit = sum of pending or bounced cheques
    const usedCredit = chequesList
      .filter((c) => c.status === 'pending' || c.status === 'bounced')
      .reduce((sum, c) => sum + Number(c.amount), 0);

    const remainingCredit = Math.max(0, totalCreditLimit - usedCredit);

    // Build notifications & reminders for cheques
    const notifications: Array<{
      id: string;
      type: 'due_soon' | 'due_today' | 'overdue' | 'bounced' | 'general';
      title: string;
      message: string;
      daysLeft: number;
      chequeNumber: string;
      amount: number;
      dueDate: string;
      severity: 'info' | 'warning' | 'danger';
    }> = [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const cheque of chequesList) {
      const amt = Number(cheque.amount);
      const amtText = formatMoney(amt);

      if (cheque.status === 'bounced') {
        notifications.push({
          id: `notif-bounced-${cheque.id}`,
          type: 'bounced',
          title: '⚠️ چک برگشتی نیازمند پیگیری',
          message: `چک شماره ${cheque.chequeNumber} بانک ${cheque.bankName} به مبلغ ${amtText} برگشت خورده است. لطفاً نسبت به تسویه سریع‌تر اقدام نمایید.`,
          daysLeft: -1,
          chequeNumber: cheque.chequeNumber,
          amount: amt,
          dueDate: cheque.dueDate,
          severity: 'danger',
        });
      } else if (cheque.status === 'pending') {
        // Try parsing due date
        let dueTime = new Date(cheque.dueDate).getTime();
        if (isNaN(dueTime)) {
          // If Jalali string like 1403/08/15, set approximate timestamp or estimate
          dueTime = Date.now() + 86400000 * 3;
        }
        const diffDays = Math.ceil((dueTime - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          notifications.push({
            id: `notif-overdue-${cheque.id}`,
            type: 'overdue',
            title: '🔴 سررسید چک گذشته است',
            message: `چک شماره ${cheque.chequeNumber} (${cheque.bankName}) به مبلغ ${amtText} در تاریخ ${cheque.dueDate} سررسید شده است.`,
            daysLeft: diffDays,
            chequeNumber: cheque.chequeNumber,
            amount: amt,
            dueDate: cheque.dueDate,
            severity: 'danger',
          });
        } else if (diffDays === 0) {
          notifications.push({
            id: `notif-today-${cheque.id}`,
            type: 'due_today',
            title: '🔔 سررسید چک امروز است',
            message: `امروز سررسید چک شماره ${cheque.chequeNumber} به مبلغ ${amtText} در بانک ${cheque.bankName} می‌باشد.`,
            daysLeft: 0,
            chequeNumber: cheque.chequeNumber,
            amount: amt,
            dueDate: cheque.dueDate,
            severity: 'warning',
          });
        } else if (diffDays <= 7) {
          notifications.push({
            id: `notif-soon-${cheque.id}`,
            type: 'due_soon',
            title: '⏰ یادآوری سررسید چک',
            message: `${diffDays} روز تا سررسید چک شماره ${cheque.chequeNumber} (${cheque.bankName}) به مبلغ ${amtText} باقی مانده است.`,
            daysLeft: diffDays,
            chequeNumber: cheque.chequeNumber,
            amount: amt,
            dueDate: cheque.dueDate,
            severity: 'info',
          });
        }
      }
    }

    const chequesDTO = chequesList.map((c) => ({
      id: c.id,
      userId: c.userId,
      creditApplicationId: c.creditApplicationId,
      orderId: c.orderId,
      chequeNumber: c.chequeNumber,
      bankName: c.bankName,
      accountHolder: c.accountHolder,
      amount: Number(c.amount),
      dueDate: c.dueDate,
      status: c.status,
      imageUrl: c.imageUrl,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));

    return reply.send({
      ok: true,
      application: applicationDTO,
      totalCreditLimit,
      usedCredit,
      remainingCredit,
      cheques: chequesDTO,
      notifications,
    });
  });

  // Buyer submits a new cheque
  app.post('/credit/cheques', { preHandler: [app.requireUser] }, async (req, reply) => {
    const user = req.currentUser!;
    const body = creditChequeWriteSchema.parse(req.body);

    const [appRecord] = await db
      .select()
      .from(schema.creditApplications)
      .where(eq(schema.creditApplications.userId, user.id))
      .limit(1);

    const [inserted] = await db
      .insert(schema.creditCheques)
      .values({
        userId: user.id,
        creditApplicationId: appRecord?.id ?? null,
        chequeNumber: body.chequeNumber,
        bankName: body.bankName,
        accountHolder: body.accountHolder,
        amount: body.amount,
        dueDate: body.dueDate,
        imageUrl: body.imageUrl || null,
        notes: body.notes || null,
        status: 'pending',
      })
      .returning();

    if (!inserted) throw badRequest('خطا در ثبت چک.');

    return reply.send({
      ok: true,
      cheque: {
        id: inserted.id,
        userId: inserted.userId,
        creditApplicationId: inserted.creditApplicationId,
        orderId: inserted.orderId,
        chequeNumber: inserted.chequeNumber,
        bankName: inserted.bankName,
        accountHolder: inserted.accountHolder,
        amount: Number(inserted.amount),
        dueDate: inserted.dueDate,
        status: inserted.status,
        imageUrl: inserted.imageUrl,
        notes: inserted.notes,
        createdAt: inserted.createdAt.toISOString(),
        updatedAt: inserted.updatedAt.toISOString(),
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

