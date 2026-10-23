import {
  creditChequeWriteSchema,
  creditApplicationWriteSchema,
  installmentReceiptWriteSchema,
  chequeDueDate,
  firstChequeSubmissionDeadline,
  formatMoney,
  formatPersianDueDate,
} from '@tamas/shared';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { db, schema } from '../db/client.js';
import { badRequest, notFound } from '../lib/errors.js';
import { registerOrderCheque } from '../services/credit-cheques.js';
import { buildInstallmentOrderDTO, resolveInstallmentDueDate, toInstallmentReceiptDTO } from '../services/installment-receipts.js';

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

    const receiptList = await db
      .select()
      .from(schema.installmentReceipts)
      .where(eq(schema.installmentReceipts.userId, user.id))
      .orderBy(desc(schema.installmentReceipts.submittedAt));

    const customerOrders = await db
      .select({
        id: schema.orders.id,
        orderCode: schema.orders.orderCode,
        createdAt: schema.orders.createdAt,
        status: schema.orders.status,
        paymentPlan: schema.orders.paymentPlan,
      })
      .from(schema.orders)
      .where(and(eq(schema.orders.userId, user.id), isNull(schema.orders.deletedAt)))
      .orderBy(desc(schema.orders.createdAt));

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

    const chequeOrders = customerOrders.flatMap((order) => {
      const plan = order.paymentPlan;
      if (order.status === 'cancelled' || plan?.kind !== 'cheque') return [];
      const registeredCount = chequesList.filter((cheque) => cheque.orderId === order.id).length;
      const schedule = plan.schedule.flatMap((item, index) => {
        if (item.amount == null || item.amount <= 0) return [];
        const dueDate = item.dueDate ?? chequeDueDate(order.createdAt, index, plan.installmentIntervalMonths ?? 1, plan.termMonths);
        return [{
          index,
          amount: item.amount,
          dueDate,
          dueLabel: formatPersianDueDate(dueDate),
          registered: index < registeredCount,
        }];
      });
      const nextInstallment = schedule.find((item) => !item.registered) ?? null;
      const submissionDeadline = firstChequeSubmissionDeadline(order.createdAt);
      const firstChequeExpired = registeredCount === 0 && Date.now() > submissionDeadline.getTime();
      return [{
        orderId: order.id,
        orderCode: order.orderCode,
        createdAt: order.createdAt.toISOString(),
        submissionDeadline: submissionDeadline.toISOString(),
        canSubmitNextCheque: Boolean(nextInstallment) && !firstChequeExpired,
        blockedReason: firstChequeExpired
          ? 'مهلت پنج‌روزه ثبت چک اول این سفارش پایان یافته است.'
          : nextInstallment ? null : 'همه چک‌های این سفارش ثبت شده‌اند.',
        schedule,
        nextInstallment,
      }];
    });

    const installmentOrders = customerOrders.flatMap((order) => {
      if (order.status === 'cancelled') return [];
      const item = buildInstallmentOrderDTO(order, receiptList);
      return item ? [item] : [];
    });

    installmentOrders.forEach((order) => {
      order.schedule.forEach((item) => {
        if (!item.isDue || (item.receipt && item.receipt.status !== 'rejected')) return;
        notifications.unshift({
          id: `receipt-${order.orderId}-${item.index}`,
          type: 'general',
          title: item.receipt?.status === 'rejected' ? 'رسید قسط رد شده است' : 'رسید قسط بارگذاری نشده است',
          message: `رسید قسط سفارش ${order.orderCode} به مبلغ ${formatMoney(item.amount)} را بارگذاری کنید.${item.receipt?.rejectionReason ? ` علت رد: ${item.receipt.rejectionReason}` : ''}`,
          daysLeft: item.isOverdue ? -1 : 0,
          chequeNumber: order.orderCode,
          amount: item.amount,
          dueDate: item.dueDate,
          severity: item.isOverdue ? 'danger' : 'warning',
        });
      });
    });

    return reply.send({
      ok: true,
      application: applicationDTO,
      totalCreditLimit,
      usedCredit,
      remainingCredit,
      cheques: chequesDTO,
      chequeOrders,
      installmentOrders,
      notifications,
    });
  });

  app.post('/credit/installments/:orderId/:installmentIndex/receipt', { preHandler: [app.requireUser] }, async (req, reply) => {
    const user = req.currentUser!;
    const { orderId: orderParam, installmentIndex: indexParam } = req.params as { orderId: string; installmentIndex: string };
    const orderId = Number(orderParam);
    const installmentIndex = Number(indexParam);
    if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(installmentIndex) || installmentIndex < 0) {
      throw badRequest('شناسه سفارش یا قسط معتبر نیست.');
    }
    const body = installmentReceiptWriteSchema.parse(req.body);
    const [order] = await db.select().from(schema.orders).where(and(
      eq(schema.orders.id, orderId),
      eq(schema.orders.userId, user.id),
      isNull(schema.orders.deletedAt),
    )).limit(1);
    if (!order || order.status === 'cancelled') throw notFound('سفارش قسطی یافت نشد.');
    const plan = order.paymentPlan;
    if (!plan || (plan.kind !== 'cheque' && plan.kind !== 'daily')) throw badRequest('این سفارش پرداخت قسطی ندارد.');
    const installment = plan.schedule[installmentIndex];
    const dueDate = installment ? resolveInstallmentDueDate(order.createdAt, plan, installmentIndex) : null;
    if (!installment || !dueDate || installment.amount == null || installment.amount <= 0) throw badRequest('قسط انتخاب‌شده معتبر نیست.');

    const now = new Date();
    const [saved] = await db.insert(schema.installmentReceipts).values({
      orderId,
      userId: user.id,
      installmentIndex,
      amount: installment.amount,
      dueDate,
      receiptUrl: body.receiptUrl,
      trackingCode: body.trackingCode || null,
      note: body.note || null,
      status: 'pending',
      rejectionReason: null,
      submittedAt: now,
      reviewedAt: null,
      reviewedBy: null,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [schema.installmentReceipts.orderId, schema.installmentReceipts.installmentIndex],
      set: {
        receiptUrl: body.receiptUrl,
        trackingCode: body.trackingCode || null,
        note: body.note || null,
        status: 'pending',
        rejectionReason: null,
        submittedAt: now,
        reviewedAt: null,
        reviewedBy: null,
        updatedAt: now,
      },
    }).returning();
    if (!saved) throw badRequest('ثبت رسید انجام نشد.');

    const { sendTelegramNotification } = await import('../services/telegram.js');
    void sendTelegramNotification('payment.info_submitted', {
      title: '🧾 رسید قسط جدید',
      fields: [
        { label: 'سفارش', value: order.orderCode },
        { label: 'مشتری', value: order.customerName },
        { label: 'قسط', value: installmentIndex + 1 },
        { label: 'مبلغ', value: formatMoney(installment.amount) },
        { label: 'سررسید', value: installment.dueLabel },
        { label: 'شماره پیگیری', value: body.trackingCode || undefined },
      ],
    }).catch((err) => req.log.error({ err }, 'failed to notify admin about installment receipt'));

    return reply.send({ ok: true, receipt: toInstallmentReceiptDTO(saved), message: 'رسید قسط برای بررسی ثبت شد.' });
  });

  // Buyer submits a new cheque
  app.post('/credit/cheques', { preHandler: [app.requireUser] }, async (req, reply) => {
    const user = req.currentUser!;
    const body = creditChequeWriteSchema.parse(req.body);

    const { cheque: inserted, order } = await registerOrderCheque(user.id, body);

    const { sendTelegramNotification } = await import('../services/telegram.js');
    void sendTelegramNotification('credit.cheque_submitted', {
      title: '🧾 چک اعتباری جدید',
      fields: [
        { label: 'کاربر', value: [user.name, user.lastName].filter(Boolean).join(' ') || user.phone },
        { label: 'تلفن', value: user.phone },
        { label: 'شماره چک', value: inserted.chequeNumber },
        { label: 'سفارش', value: order.orderCode },
        { label: 'بانک', value: inserted.bankName },
        { label: 'مبلغ', value: `${Number(inserted.amount).toLocaleString('fa-IR')} تومان` },
        { label: 'سررسید', value: inserted.dueDate },
      ],
    }).catch((err) => req.log.error({ err }, 'failed to send Telegram cheque notification'));

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

    const { sendTelegramNotification } = await import('../services/telegram.js');
    void sendTelegramNotification('credit.application_submitted', {
      title: '💳 درخواست اعتبار جدید',
      fields: [
        { label: 'کاربر', value: [user.name, user.lastName].filter(Boolean).join(' ') || user.phone },
        { label: 'تلفن', value: user.phone },
        { label: 'نوع کسب‌وکار', value: record.businessType },
        { label: 'کد ملی', value: record.nationalId },
      ],
    }).catch((err) => req.log.error({ err }, 'failed to send Telegram credit application notification'));

    const { sendTemplatedSms } = await import('../services/sms.js');
    void sendTemplatedSms(
      user.phone,
      'sms_template_credit_pending',
      { name: user.name || 'کاربر' },
      `کاربر گرامی ${user.name || ''}، درخواست اعتباری شما دریافت شد و در صف بررسی قرار گرفت.`
    ).catch(err => req.log.error({ err }, 'failed to send SMS'));

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

