/** Integration verification in an empty, disposable schema. Never copies customer data. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import postgres from 'postgres';

const here = dirname(fileURLToPath(import.meta.url));
if (!process.argv.includes('--isolated-run')) {
  if (!process.argv.includes('--allow-isolated-schema')) throw new Error('Use --allow-isolated-schema to create and remove a disposable test schema.');
  const admin = postgres(process.env.DATABASE_URL!, { max: 1 });
  const name = `tamas_doc_test_${randomUUID().replaceAll('-', '')}`;
  const root = await mkdtemp(join(tmpdir(), 'tamas-doc-test-'));
  async function cleanup() {
    // Validate the exact generated targets; never clean a production schema/root.
    if (!/^tamas_doc_test_[a-f0-9]{32}$/.test(name)) throw new Error('Unsafe test schema target');
    await admin`drop schema if exists ${admin(name)} cascade`; await admin.end();
    if (dirname(root) !== resolve(tmpdir()) || !root.startsWith(join(tmpdir(), 'tamas-doc-test-'))) throw new Error('Unsafe test storage target');
    await rm(root, { recursive: true, force: true });
  }
  try {
    await admin`create schema ${admin(name)}`;
    const tables = ['users', 'uploads', 'credit_applications', 'credit_cheques', 'installment_receipts', 'credit_report_snapshots', 'orders', 'audit_log'];
    for (const table of tables) {
      await admin`create table ${admin(name)}.${admin(table)} (like ${admin('public')}.${admin(table)} including all)`;
      // LIKE defaults can point at production serial sequences. Replace every one
      // before a test INSERT; fixtures must not even advance a live sequence.
      const columns = await admin`select column_name from information_schema.columns where table_schema=${name} and table_name=${table} and column_default like 'nextval(%'`;
      for (const column of columns) {
        const sequence = `${table}_${column.column_name}_test_seq`;
        await admin`create sequence ${admin(name)}.${admin(sequence)}`;
        await admin`alter table ${admin(name)}.${admin(table)} alter column ${admin(column.column_name)} set default nextval(${`${name}.${sequence}`}::regclass)`;
      }
    }
    const testClient = postgres(process.env.DATABASE_URL!, { max: 1, connection: { search_path: name } });
    try {
      const migration = await readFile(resolve(here, '../drizzle/0028_glamorous_betty_ross.sql'), 'utf8');
      for (const statement of migration.replaceAll('"public".', `"${name}".`).split('--> statement-breakpoint').filter((part) => part.trim())) await testClient.unsafe(statement);
    } finally { await testClient.end(); }
    const url = new URL(process.env.DATABASE_URL!); url.searchParams.set('search_path', name);
    const code = await new Promise<number | null>((done, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), '--isolated-run'], {
        stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: url.toString(), DATABASE_POOL_MAX: '2', PRIVATE_STORAGE_ROOT: join(root, 'private'), STORAGE_ROOT: join(root, 'public'), DOCUMENT_TEST_SCHEMA: name },
      });
      child.on('error', reject); child.on('exit', done);
    });
    if (code !== 0) throw new Error('Isolated document recovery verification failed');
  } finally {
    await cleanup();
  }
} else {
  const { db, sql, schema, closeDb } = await import('../src/db/client.js');
  const { eq } = await import('drizzle-orm');
  const { processUpload } = await import('../src/services/uploads.js');
  const service = await import('../src/services/document-recovery.js');
  const sharp = (await import('sharp')).default;
  try {
    const [current] = await sql`select current_schema() name`;
    assert.equal(current!.name, process.env.DOCUMENT_TEST_SCHEMA);
    assert.match(String(current!.name), /^tamas_doc_test_[a-f0-9]{32}$/);
    await db.insert(schema.users).values([
      { id: 1, phone: '09990000001', name: 'Test Admin', role: 'admin', isActive: true },
      { id: 2, phone: '09990000002', name: 'Test Owner' },
      { id: 3, phone: '09990000003', name: 'Test Other' },
    ]);
    const [original] = await db.insert(schema.uploads).values({ kind: 'certificate', storageKey: 'certificate/not-present.pdf', originalName: 'missing.pdf', mimeType: 'application/pdf', privateScope: 'credit', privateOwnerId: 2, uploadedBy: 2 }).returning();
    const oldUrl = `/api/files/${original!.id}`;
    await db.insert(schema.creditApplications).values({ userId: 2, nationalId: '0000000000', businessType: 'test', nationalCardUrl: oldUrl, businessDocsUrl: oldUrl, checkImageUrl: oldUrl, status: 'active', assignedCreditLimit: 123456 });
    const [order] = await db.insert(schema.orders).values({ orderCode: 'DOC-TEST', customerName: 'Test Owner', phone: '09990000002', userId: 2, note: JSON.stringify({ receiptImageUrl: oldUrl, other: '/api/files/9999999' }), total: 100, status: 'delivered', paymentStatus: 'paid' }).returning();
    assert.equal((await service.documentHealth())[0]!.availability, 'missing');
    const duplicates = await Promise.allSettled([service.requestDocumentReupload(original!.id, 1, 'test request'), service.requestDocumentReupload(original!.id, 1, 'test request')]);
    assert.equal(duplicates.filter((item) => item.status === 'fulfilled').length, 1);
    const request = (await service.listDocumentRequests(2))[0]!;
    assert.equal((await service.listDocumentRequests(3)).length, 0);
    assert.deepEqual(await service.notifyDocumentRequest(request.id, { sms: false, bots: false }), { inApp: 'registered', sms: 'not_requested', telegram: 'not_requested', bale: 'not_requested' });
    const image = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const otherFile = await processUpload({ buffer: image, filename: 'test-other.png', mimeType: 'image/png', kind: 'certificate', uploadedBy: 3 });
    const ownFile = await processUpload({ buffer: image, filename: 'test-own.png', mimeType: 'image/png', kind: 'certificate', uploadedBy: 2 });
    await assert.rejects(service.submitDocumentReplacement(request.id, 3, otherFile.url));
    await assert.rejects(service.submitDocumentReplacement(request.id, 2, otherFile.url));
    await assert.rejects(service.submitDocumentReplacement(request.id, 2, oldUrl));
    await service.submitDocumentReplacement(request.id, 2, ownFile.url);
    await assert.rejects(service.submitDocumentReplacement(request.id, 2, ownFile.url));
    let [application] = await db.select().from(schema.creditApplications);
    assert.equal(application!.nationalCardUrl, oldUrl, 'submission must not change the active application');
    await service.reviewDocumentReplacement(request.id, 1, 'reject', 'test rejection');
    assert.equal((await service.listDocumentRequests(2))[0]!.status, 'pending');
    const corrected = await processUpload({ buffer: image, filename: 'test-corrected.png', mimeType: 'image/png', kind: 'certificate', uploadedBy: 2 });
    await service.submitDocumentReplacement(request.id, 2, corrected.url);
    const approvals = await Promise.allSettled([service.reviewDocumentReplacement(request.id, 1, 'approve', ''), service.reviewDocumentReplacement(request.id, 1, 'approve', '')]);
    assert.equal(approvals.filter((item) => item.status === 'fulfilled').length, 1);
    [application] = await db.select().from(schema.creditApplications);
    assert.equal(application!.nationalCardUrl, corrected.url); assert.equal(application!.businessDocsUrl, corrected.url);
    assert.equal(application!.status, 'active'); assert.equal(application!.assignedCreditLimit, 123456);
    const [unchangedOrder] = await db.select().from(schema.orders).where(eq(schema.orders.id, order!.id));
    assert.equal(unchangedOrder!.paymentStatus, 'paid'); assert.equal(unchangedOrder!.total, 100);
    assert.equal(JSON.parse(unchangedOrder!.note!).receiptImageUrl, corrected.url);
    assert.equal(JSON.parse(unchangedOrder!.note!).other, '/api/files/9999999');
    const history = (await service.listDocumentRequests(2))[0]!;
    assert.equal(history.status, 'completed'); assert.equal(history.submissions.length, 2);
    assert.deepEqual(new Set(history.submissions.map((item) => item.status)), new Set(['approved', 'rejected']));
    assert.equal((await service.documentHealth()).find((item) => item.uploadId === original!.id)!.resolved, true);
    await assert.rejects(service.requestDocumentReupload(original!.id, 1, 'duplicate after approval'));
    const [orphan] = await db.insert(schema.uploads).values({ storageKey: 'other/missing.pdf', privateScope: 'payment', privateOwnerId: 2 }).returning();
    const cancel = await service.requestDocumentReupload(orphan!.id, 1, 'test cancel');
    await service.reviewDocumentReplacement(cancel.id, 1, 'cancel', 'no longer needed');
    assert.equal((await service.listDocumentRequests(2)).find((item) => item.id === cancel.id)!.status, 'cancelled');
    console.log(JSON.stringify({ ok: true, isolated: true, verified: ['live missing detection', 'duplicate concurrency', 'owner isolation', 'no external notification by default', 'pending review', 'reject and resubmit history', 'atomic approval', 'exact reference replacement', 'unchanged credit and financial status', 'cancellation'] }));
  } finally { await closeDb(); }
}
