import { and, desc, eq, sql } from 'drizzle-orm';
import type { CreditApplicationWrite } from '@tamas/shared';
import { db, schema } from '../db/client.js';
import { badRequest, notFound } from '../lib/errors.js';
import type { UserRow } from './auth.js';
import { creditReportExpiresAt, toCreditReportSnapshotDTO } from './credit-reports.js';
import { parseIcsCreditReport } from './ics-credit-report.js';
import { claimPrivateFile } from './private-files.js';
import { processUpload } from './uploads.js';

type CreditApplicationRow = typeof schema.creditApplications.$inferSelect;

interface CreditLog {
  error: (obj: unknown, msg?: string) => void;
}

export function toCreditApplicationDTO(row: CreditApplicationRow) {
  return {
    id: row.id,
    userId: row.userId,
    nationalId: row.nationalId,
    businessType: row.businessType,
    nationalCardUrl: row.nationalCardUrl,
    businessDocsUrl: row.businessDocsUrl,
    checkImageUrl: row.checkImageUrl,
    bankStatementUrl: row.bankStatementUrl,
    referralInfo: row.referralInfo,
    status: row.status,
    rejectionReason: row.rejectionReason,
    adminCreditScore: row.adminCreditScore,
    assignedCreditLimit: Number(row.assignedCreditLimit),
    internalNotes: row.internalNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function latestCreditApplication(userId: number): Promise<CreditApplicationRow | null> {
  const [existing] = await db
    .select()
    .from(schema.creditApplications)
    .where(eq(schema.creditApplications.userId, userId))
    .orderBy(desc(schema.creditApplications.createdAt))
    .limit(1);
  return existing ?? null;
}

/** Whether the customer has a parsed, unexpired ICS24 report, which a credit application needs. */
export async function hasFreshCreditReport(userId: number): Promise<boolean> {
  const [fresh] = await db.select({ id: schema.creditReportSnapshots.id })
    .from(schema.creditReportSnapshots)
    .where(and(
      eq(schema.creditReportSnapshots.userId, userId),
      eq(schema.creditReportSnapshots.extractionStatus, 'parsed'),
      sql`${schema.creditReportSnapshots.expiresAt} > NOW()`,
    ))
    .limit(1);
  return Boolean(fresh);
}

/**
 * Uploading an official ICS24 report always creates a new snapshot. Previous
 * snapshots remain untouched so the customer's credit history is auditable.
 */
export async function storeCreditReport(
  user: UserRow,
  file: { buffer: Buffer; filename?: string; mimeType?: string },
) {
  const filename = file.filename ?? '';
  if (file.mimeType !== 'application/pdf' && !filename.toLowerCase().endsWith('.pdf')) {
    throw badRequest('فقط فایل PDF صادرشده از سامانه ICS24 قابل قبول است.');
  }

  const buffer = file.buffer;
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw badRequest('ساختار فایل PDF معتبر نیست.');

  let parsed;
  try {
    parsed = await parseIcsCreditReport(buffer);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : 'اطلاعات گزارش اعتبارسنجی قابل استخراج نیست.');
  }

  const expectedNationalId = user.nationalCode.replace(/\D/g, '');
  const extractedNationalId = parsed.identity.nationalId?.replace(/\D/g, '') ?? '';
  if (expectedNationalId && extractedNationalId && expectedNationalId !== extractedNationalId) {
    throw badRequest('کد ملی داخل گزارش با کد ملی حساب کاربری شما مطابقت ندارد.');
  }

  const [application] = await db.select({ id: schema.creditApplications.id })
    .from(schema.creditApplications)
    .where(eq(schema.creditApplications.userId, user.id))
    .orderBy(desc(schema.creditApplications.createdAt))
    .limit(1);
  const upload = await processUpload({
    buffer,
    filename: filename || 'ics24-credit-report.pdf',
    mimeType: 'application/pdf',
    kind: 'certificate',
    uploadedBy: user.id,
  });
  const createdAt = new Date();
  const extractionStatus = parsed.confidence >= 70 && parsed.identity.nationalId && parsed.score !== null
    ? 'parsed' as const
    : 'needs_review' as const;
  const [snapshot] = await db.insert(schema.creditReportSnapshots).values({
    userId: user.id,
    creditApplicationId: application?.id ?? null,
    fileUrl: upload.url,
    originalName: upload.originalName,
    reportNumber: parsed.reportNumber,
    reportDate: parsed.reportDate,
    extractedNationalId: parsed.identity.nationalId,
    extractedFullName: parsed.identity.fullName,
    extractedMobile: parsed.identity.mobile,
    score: parsed.score,
    riskGrade: parsed.riskGrade,
    riskLevel: parsed.riskLevel,
    goodPayerMinBasisPoints: parsed.goodPayerProbability ? Math.round(parsed.goodPayerProbability.min * 100) : null,
    goodPayerMaxBasisPoints: parsed.goodPayerProbability ? Math.round(parsed.goodPayerProbability.max * 100) : null,
    bouncedChequeCount: parsed.bouncedChequeCount,
    extractionStatus,
    confidence: parsed.confidence,
    warnings: parsed.warnings,
    data: parsed as unknown as Record<string, unknown>,
    expiresAt: creditReportExpiresAt(createdAt),
    createdAt,
  }).returning();
  if (!snapshot) throw badRequest('ذخیره گزارش اعتبارسنجی انجام نشد.');

  const userUpdates: Record<string, string> = {};
  if (!user.nationalCode && parsed.identity.nationalId) userUpdates.nationalCode = parsed.identity.nationalId;
  if (!user.birthDate && parsed.identity.birthDate) userUpdates.birthDate = parsed.identity.birthDate;
  if (!user.fatherName && parsed.identity.fatherName) userUpdates.fatherName = parsed.identity.fatherName;
  if (Object.keys(userUpdates).length > 0) {
    await db.update(schema.users).set({ ...userUpdates, updatedAt: new Date() }).where(eq(schema.users.id, user.id));
  }

  return {
    report: toCreditReportSnapshotDTO(snapshot),
    message: extractionStatus === 'parsed'
      ? 'گزارش با موفقیت خوانده و در پرونده شما ذخیره شد.'
      : 'گزارش ذخیره شد و برای کنترل نهایی مدیر علامت‌گذاری شد.',
  };
}

/** Submits or updates the customer's credit application. Shared by `POST /credit/apply` and the customer bot. */
export async function submitCreditApplication(user: UserRow, input: CreditApplicationWrite, log?: CreditLog) {
  const body = { ...input };
  for (const field of ['nationalCardUrl', 'businessDocsUrl', 'checkImageUrl', 'bankStatementUrl'] as const) {
    if (body[field]) body[field] = await claimPrivateFile(body[field], user.id, 'credit');
  }

  const [freshReport] = await db.select()
    .from(schema.creditReportSnapshots)
    .where(and(
      eq(schema.creditReportSnapshots.userId, user.id),
      eq(schema.creditReportSnapshots.extractionStatus, 'parsed'),
      sql`${schema.creditReportSnapshots.expiresAt} > NOW()`,
    ))
    .orderBy(desc(schema.creditReportSnapshots.createdAt))
    .limit(1);
  if (!freshReport) {
    throw badRequest('ابتدا گزارش اعتبارسنجی جدید خود را از سامانه ICS24 دریافت و بارگذاری کنید.');
  }
  if (freshReport.extractedNationalId && freshReport.extractedNationalId.replace(/\D/g, '') !== body.nationalId.replace(/\D/g, '')) {
    throw badRequest('کد ملی فرم با کد ملی استخراج‌شده از گزارش اعتبارسنجی مطابقت ندارد.');
  }

  const existing = await latestCreditApplication(user.id);

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

  if (freshReport.creditApplicationId !== resultId) {
    await db.update(schema.creditReportSnapshots)
      .set({ creditApplicationId: resultId })
      .where(eq(schema.creditReportSnapshots.id, freshReport.id));
  }

  const [record] = await db
    .select()
    .from(schema.creditApplications)
    .where(eq(schema.creditApplications.id, resultId))
    .limit(1);

  if (!record) throw notFound('پرونده یافت نشد.');

  const { sendTelegramNotification } = await import('./telegram.js');
  void sendTelegramNotification('credit.application_submitted', {
    title: '💳 درخواست اعتبار جدید',
    fields: [
      { label: 'کاربر', value: [user.name, user.lastName].filter(Boolean).join(' ') || user.phone },
      { label: 'تلفن', value: user.phone },
      { label: 'نوع کسب‌وکار', value: record.businessType },
      { label: 'کد ملی', value: record.nationalId },
    ],
  }).catch((err) => log?.error({ err }, 'failed to send Telegram credit application notification'));

  const { sendTemplatedSms } = await import('./sms.js');
  void sendTemplatedSms(
    user.phone,
    'sms_template_credit_pending',
    { name: user.name || 'کاربر' },
    `کاربر گرامی ${user.name || ''}، درخواست اعتباری شما دریافت شد و در صف بررسی قرار گرفت.`
  ).catch(err => log?.error({ err }, 'failed to send SMS'));

  return toCreditApplicationDTO(record);
}
