import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { DocumentHealthDTO, DocumentRequestDTO } from '@tamas/shared';
import { db, schema } from '../db/client.js';
import { badRequest, notFound } from '../lib/errors.js';
import { referencesUpload, replaceDocumentReference, resolveDocumentOwner, type DocumentReference } from '../lib/document-recovery.js';
import { privateFileId, privateFileUrl } from '../lib/private-files.js';
import { claimPrivateFile, findPrivateFile } from './private-files.js';
import { inspectPrivateFile, openPrivateFile } from './private-storage.js';
import { parseIcsCreditReport } from './ics-credit-report.js';
import { creditReportExpiresAt } from './credit-reports.js';
import { env } from '../env.js';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Pick<typeof db, 'execute'>;

async function documentReferences(reader: Reader = db): Promise<DocumentReference[]> {
  const rows = await reader.execute(sql`
    select 'application' source,id "recordId",user_id "userId",'national_card_url' field,national_card_url value,'کارت ملی' label from credit_applications
    union all select 'application',id,user_id,'business_docs_url',business_docs_url,'جواز کسب / اجاره‌نامه' from credit_applications
    union all select 'application',id,user_id,'check_image_url',check_image_url,'تصویر چک تضمین' from credit_applications
    union all select 'application',id,user_id,'bank_statement_url',bank_statement_url,'گردش حساب' from credit_applications where bank_statement_url is not null
    union all select 'profile',id,id,'certificate_file_url',certificate_file_url,'جواز پروفایل' from users where certificate_file_url <> ''
    union all select 'cheque',id,user_id,'image_url',image_url,'تصویر چک' from credit_cheques where image_url is not null
    union all select 'receipt',id,user_id,'receipt_url',receipt_url,'رسید قسط' from installment_receipts
    union all select 'report',id,user_id,'file_url',file_url,'گزارش ICS24' from credit_report_snapshots
    union all select 'order',id,user_id,'note',note,'رسید پرداخت سفارش' from orders where note like '%/api/files/%'
  `);
  return rows as unknown as DocumentReference[];
}

export async function listDocumentRequests(userId?: number): Promise<DocumentRequestDTO[]> {
  const requests = await db.select().from(schema.documentReuploadRequests)
    .where(userId === undefined ? undefined : eq(schema.documentReuploadRequests.userId, userId))
    .orderBy(desc(schema.documentReuploadRequests.createdAt));
  if (!requests.length) return [];
  const submissions = await db.select().from(schema.documentReuploadSubmissions)
    .where(inArray(schema.documentReuploadSubmissions.requestId, requests.map((item) => item.id)))
    .orderBy(desc(schema.documentReuploadSubmissions.submittedAt));
  return requests.map((request) => ({
    ...request, createdAt: request.createdAt.toISOString(), updatedAt: request.updatedAt.toISOString(),
    submissions: submissions.filter((item) => item.requestId === request.id).map((item) => ({
      id: item.id, uploadId: item.uploadId, fileUrl: privateFileUrl(item.uploadId), status: item.status,
      submittedAt: item.submittedAt.toISOString(), reviewedAt: item.reviewedAt?.toISOString() ?? null, reviewNote: item.reviewNote,
    })),
  }));
}

export async function documentHealth(): Promise<DocumentHealthDTO[]> {
  const [files, references, requests, users] = await Promise.all([
    db.select().from(schema.uploads).where(isNotNull(schema.uploads.privateScope)).orderBy(schema.uploads.id),
    documentReferences(), listDocumentRequests(),
    db.select({ id: schema.users.id, name: schema.users.name, lastName: schema.users.lastName, role: schema.users.role, storeName: schema.users.storeName }).from(schema.users),
  ]);
  const userMap = new Map(users.map((user) => [user.id, user]));
  const result: DocumentHealthDTO[] = [];
  // Bounded filesystem concurrency for a growing document library.
  for (let offset = 0; offset < files.length; offset += 16) {
    result.push(...await Promise.all(files.slice(offset, offset + 16).map(async (file): Promise<DocumentHealthDTO> => {
      const refs = references.filter((reference) => referencesUpload(reference, file.id));
      const owner = resolveDocumentOwner(refs, file.privateOwnerId ?? file.uploadedBy);
      const user = userMap.get(owner.userId ?? -1);
      const history = requests.filter((request) => request.originalUploadId === file.id);
      const [availability, thumbnailAvailability] = await Promise.all([
        inspectPrivateFile(file.storageKey), file.thumbKey ? inspectPrivateFile(file.thumbKey) : null,
      ]);
      return {
        uploadId: file.id, originalName: file.originalName, fileUrl: privateFileUrl(file.id), scope: file.privateScope!,
        availability, thumbnailAvailability, ...owner,
        userName: user ? `${user.name} ${user.lastName}`.trim() || 'بدون نام' : 'مالک نامشخص',
        userRole: user?.role ?? '', userStoreName: user?.storeName ?? '',
        references: refs.map(({ source, recordId, label }) => ({ source, recordId, label })),
        requests: history, resolved: history.some((request) => request.status === 'completed'), createdAt: file.createdAt.toISOString(),
      };
    })));
  }
  return result;
}

async function audit(tx: Transaction, actorId: number, action: string, id: number, detail: Record<string, unknown> = {}) {
  await tx.insert(schema.auditLog).values({ actorId, action, entity: 'document_reupload', entityKey: String(id), detail });
}

export async function requestDocumentReupload(uploadId: number, actorId: number, message: string) {
  const [file, refs] = await Promise.all([findPrivateFile(uploadId), documentReferences()]);
  if (!file) throw notFound();
  const matched = refs.filter((ref) => referencesUpload(ref, uploadId));
  const owner = resolveDocumentOwner(matched, file.privateOwnerId ?? file.uploadedBy);
  if (owner.userId === null) throw badRequest('مالک مدرک نامشخص یا متعارض است؛ ابتدا مالکیت را بررسی کنید.');
  const [user] = await db.select({ id: schema.users.id, deletedAt: schema.users.deletedAt }).from(schema.users).where(eq(schema.users.id, owner.userId));
  if (!user || user.deletedAt) throw badRequest('حساب مالک مدرک در دسترس نیست.');
  const main = await inspectPrivateFile(file.storageKey);
  const thumb = file.thumbKey ? await inspectPrivateFile(file.thumbKey) : null;
  if (main !== 'missing' && thumb !== 'missing') throw badRequest('فایل مفقود نیست؛ خطای دسترسی فنی را با آپلود مجدد اشتباه نگیرید.');
  return db.transaction(async (tx) => {
    await tx.select({ id: schema.uploads.id }).from(schema.uploads).where(eq(schema.uploads.id, uploadId)).for('update');
    const [existing] = await tx.select().from(schema.documentReuploadRequests).where(and(
      eq(schema.documentReuploadRequests.originalUploadId, uploadId),
      inArray(schema.documentReuploadRequests.status, ['pending', 'submitted', 'completed']),
    ));
    if (existing) throw badRequest('برای این مدرک درخواست باز یا جایگزین تأییدشده وجود دارد.');
    const [request] = await tx.insert(schema.documentReuploadRequests).values({
      originalUploadId: uploadId, userId: owner.userId!, requestedBy: actorId,
      documentLabel: [...new Set(matched.map((ref) => ref.label))].join(' / ') || 'مدرک پیوست حساب (بدون ارجاع فعال)', message,
    }).returning();
    await audit(tx, actorId, 'request', request!.id, { uploadId, userId: owner.userId });
    return request!;
  });
}

/** External notifications require explicit opt-in; the account request is always durable. */
export async function notifyDocumentRequest(requestId: number, channels: { sms: boolean; bots: boolean }) {
  const [request] = await db.select().from(schema.documentReuploadRequests).where(eq(schema.documentReuploadRequests.id, requestId));
  if (!request) throw notFound();
  const delivery: Record<string, string> = { inApp: 'registered', sms: 'not_requested', telegram: 'not_requested', bale: 'not_requested' };
  const link = `${env.PUBLIC_SITE_URL.replace(/\/$/, '')}/account/documents`;
  const text = `برای تکمیل مدارک حساب تماس مارکت، لطفاً وارد بخش مدارک حساب شوید و درخواست شماره ${request.id} را بررسی کنید: ${link}`;
  await Promise.all([
    channels.sms ? (async () => {
      try {
        const [user] = await db.select({ phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, request.userId));
        const { sendTemplatedSms } = await import('./sms.js');
        const result = user?.phone ? await sendTemplatedSms(user.phone, 'sms_template_document_reupload', { link, requestId: String(request.id) }, text) : null;
        delivery.sms = result?.ok && !result.error ? 'accepted' : 'not_sent';
      } catch { delivery.sms = 'failed'; }
    })() : undefined,
    channels.bots ? (async () => {
      try {
        const { sendCustomerNotification } = await import('./customer-messaging.js');
        const sent = await sendCustomerNotification(request.userId, 'credit.document_reupload_requested', 'درخواست تکمیل مدرک', text);
        delivery.telegram = sent.telegram ? 'accepted' : 'not_sent'; delivery.bale = sent.bale ? 'accepted' : 'not_sent';
      } catch { delivery.telegram = 'failed'; delivery.bale = 'failed'; }
    })() : undefined,
  ]);
  await db.update(schema.documentReuploadRequests).set({ notificationDelivery: delivery }).where(eq(schema.documentReuploadRequests.id, requestId));
  return delivery;
}

async function parseReplacementReport(uploadId: number, userId: number, reader: Pick<typeof db, 'select'> = db) {
  const [file] = await reader.select().from(schema.uploads).where(and(eq(schema.uploads.id, uploadId), isNotNull(schema.uploads.privateScope)));
  if (!file || file.mimeType !== 'application/pdf' || file.size > env.UPLOAD_MAX_BYTES) throw badRequest('جایگزین گزارش ICS24 باید فایل PDF معتبر باشد.');
  const opened = await openPrivateFile(file.storageKey);
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of opened.stream) {
    size += chunk.length;
    if (size > env.UPLOAD_MAX_BYTES) { opened.stream.destroy(); throw badRequest('حجم فایل گزارش بیشتر از حد مجاز است.'); }
    chunks.push(Buffer.from(chunk));
  }
  let parsed;
  try { parsed = await parseIcsCreditReport(Buffer.concat(chunks)); } catch { throw badRequest('گزارش ICS24 قابل خواندن نیست؛ PDF اصلی سامانه را بارگذاری کنید.'); }
  const [user] = await reader.select({ nationalCode: schema.users.nationalCode }).from(schema.users).where(eq(schema.users.id, userId));
  if (user?.nationalCode && parsed.identity.nationalId && user.nationalCode.replace(/\D/g, '') !== parsed.identity.nationalId.replace(/\D/g, '')) throw badRequest('کد ملی گزارش با صاحب حساب مطابقت ندارد.');
  return { parsed, file };
}

export async function submitDocumentReplacement(requestId: number, userId: number, value: string) {
  const [request] = await db.select().from(schema.documentReuploadRequests).where(and(eq(schema.documentReuploadRequests.id, requestId), eq(schema.documentReuploadRequests.userId, userId)));
  if (!request) throw notFound();
  if (request.status !== 'pending') throw badRequest('این درخواست در وضعیت دریافت مدرک نیست.');
  const original = await findPrivateFile(request.originalUploadId);
  const url = await claimPrivateFile(value, userId, original?.privateScope ?? 'credit');
  const uploadId = privateFileId(url)!;
  const file = await findPrivateFile(uploadId);
  if (uploadId === request.originalUploadId || !file || await inspectPrivateFile(file.storageKey) !== 'available') throw badRequest('یک فایل جدید و قابل‌خواندن بارگذاری کنید.');
  const refs = (await documentReferences()).filter((ref) => referencesUpload(ref, request.originalUploadId));
  if (refs.some((ref) => ref.source === 'report')) await parseReplacementReport(uploadId, userId);
  await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(schema.documentReuploadRequests).where(eq(schema.documentReuploadRequests.id, requestId)).for('update');
    if (locked?.status !== 'pending' || locked.userId !== userId) throw badRequest('وضعیت درخواست تغییر کرده است؛ صفحه را به‌روز کنید.');
    await tx.insert(schema.documentReuploadSubmissions).values({ requestId, uploadId });
    await tx.update(schema.documentReuploadRequests).set({ status: 'submitted', updatedAt: new Date() }).where(eq(schema.documentReuploadRequests.id, requestId));
    await audit(tx, userId, 'submit', requestId, { uploadId });
  });
}

export async function reviewDocumentReplacement(requestId: number, actorId: number, action: 'approve' | 'reject' | 'cancel', note: string) {
  await db.transaction(async (tx) => {
    const [request] = await tx.select().from(schema.documentReuploadRequests).where(eq(schema.documentReuploadRequests.id, requestId)).for('update');
    if (!request) throw notFound();
    if (request.status === 'completed' || request.status === 'cancelled') throw badRequest('این درخواست قبلاً بسته شده است.');
    const [submission] = await tx.select().from(schema.documentReuploadSubmissions).where(and(eq(schema.documentReuploadSubmissions.requestId, requestId), eq(schema.documentReuploadSubmissions.status, 'pending')));
    if (action !== 'cancel' && (request.status !== 'submitted' || !submission)) throw badRequest('مدرک جدیدی برای بررسی ثبت نشده است.');
    if (action === 'approve') {
      const [file] = await tx.select().from(schema.uploads).where(and(eq(schema.uploads.id, submission!.uploadId), isNotNull(schema.uploads.privateScope)));
      if (!file || (file.privateOwnerId ?? file.uploadedBy) !== request.userId || await inspectPrivateFile(file.storageKey) !== 'available') throw badRequest('فایل جایگزین در دسترس صاحب حساب نیست.');
      const refs = (await documentReferences(tx)).filter((ref) => referencesUpload(ref, request.originalUploadId));
      if (refs.some((ref) => ref.userId !== request.userId)) throw badRequest('مالکیت ارجاع مدرک تغییر کرده؛ نیازمند بررسی دستی است.');
      for (const ref of refs) {
        if (ref.source === 'report') {
          // A new report is a new snapshot; never overwrite its old extracted data.
          const { parsed, file: reportFile } = await parseReplacementReport(file.id, request.userId, tx);
          const [previous] = await tx.select().from(schema.creditReportSnapshots).where(eq(schema.creditReportSnapshots.id, ref.recordId));
          if (!previous) throw badRequest('نسخهٔ قبلی گزارش یافت نشد.');
          await tx.insert(schema.creditReportSnapshots).values({
            userId: request.userId, creditApplicationId: previous.creditApplicationId, fileUrl: privateFileUrl(file.id), originalName: reportFile.originalName,
            reportNumber: parsed.reportNumber, reportDate: parsed.reportDate, extractedNationalId: parsed.identity.nationalId, extractedFullName: parsed.identity.fullName,
            extractedMobile: parsed.identity.mobile, score: parsed.score, riskGrade: parsed.riskGrade, riskLevel: parsed.riskLevel,
            goodPayerMinBasisPoints: parsed.goodPayerProbability ? Math.round(parsed.goodPayerProbability.min * 100) : null,
            goodPayerMaxBasisPoints: parsed.goodPayerProbability ? Math.round(parsed.goodPayerProbability.max * 100) : null,
            bouncedChequeCount: parsed.bouncedChequeCount, extractionStatus: parsed.confidence >= 70 && parsed.identity.nationalId && parsed.score !== null ? 'parsed' : 'needs_review',
            confidence: parsed.confidence, warnings: parsed.warnings, data: parsed as unknown as Record<string, unknown>, expiresAt: creditReportExpiresAt(),
          });
          continue;
        }
        const tables = { application: 'credit_applications', profile: 'users', cheque: 'credit_cheques', receipt: 'installment_receipts', order: 'orders' } as const;
        const next = replaceDocumentReference(ref, request.originalUploadId, file.id);
        const changed = await tx.execute(sql`update ${sql.identifier(tables[ref.source])} set ${sql.identifier(ref.field)}=${next}
          where id=${ref.recordId} and ${sql.identifier(ref.field)}=${ref.value} returning id`);
        if (!changed.length) throw badRequest('پرونده هم‌زمان تغییر کرده است؛ دوباره بررسی کنید.');
      }
    }
    if (submission) await tx.update(schema.documentReuploadSubmissions).set({
      status: action === 'approve' ? 'approved' : 'rejected', reviewedAt: new Date(), reviewedBy: actorId,
      reviewNote: note || (action === 'cancel' ? 'درخواست توسط مدیر لغو شد.' : null),
    }).where(eq(schema.documentReuploadSubmissions.id, submission.id));
    await tx.update(schema.documentReuploadRequests).set({ status: action === 'approve' ? 'completed' : action === 'cancel' ? 'cancelled' : 'pending', updatedAt: new Date() }).where(eq(schema.documentReuploadRequests.id, requestId));
    await audit(tx, actorId, action, requestId, { originalUploadId: request.originalUploadId, replacementUploadId: submission?.uploadId ?? null });
  });
}
