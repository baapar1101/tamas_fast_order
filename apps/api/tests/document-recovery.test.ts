import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { referencesUpload, replaceDocumentReference, resolveDocumentOwner, type DocumentReference } from '../src/lib/document-recovery.js';
import { createDocumentRecoveryRoutes } from '../src/routes/document-recovery.js';
import * as service from '../src/services/document-recovery.js';

const reference: DocumentReference = { source: 'application', recordId: 2, userId: 10, field: 'national_card_url', value: '/api/files/8', label: 'کارت ملی' };

test('document recovery resolves real references before upload ownership and fails closed on conflicts', () => {
  assert.deepEqual(resolveDocumentOwner([reference], 10), { userId: 10, ownerSource: 'reference' });
  assert.equal(resolveDocumentOwner([reference], 20).ownerSource, 'conflict');
  assert.equal(resolveDocumentOwner([reference, { ...reference, userId: 20 }], null).userId, null);
  assert.deepEqual(resolveDocumentOwner([], 10), { userId: 10, ownerSource: 'upload' });
  assert.equal(resolveDocumentOwner([], null).ownerSource, 'unknown');
});

test('replacement links match exact IDs and preserve thumbnails without touching other order files', () => {
  assert.equal(referencesUpload(reference, 8), true);
  assert.equal(referencesUpload({ ...reference, value: '/api/files/80' }, 8), false);
  assert.equal(replaceDocumentReference({ ...reference, value: '/api/files/8?variant=thumb' }, 8, 12), '/api/files/12?variant=thumb');
  const order = { ...reference, source: 'order' as const, value: '{"receiptImageUrl":"/api/files/8","other":"/api/files/80","thumb":"/api/files/8?variant=thumb"}' };
  assert.equal(replaceDocumentReference(order, 8, 12), '{"receiptImageUrl":"/api/files/12","other":"/api/files/80","thumb":"/api/files/12?variant=thumb"}');
  assert.equal(referencesUpload({ ...reference, source: 'order', value: '/api/files/8?token=untrusted' }, 8), false);
});

test('recovery HTTP routes protect admin inventory, scope customer requests and validate review actions', async () => {
  const app = Fastify();
  let user: { id: number; role: string; isActive: boolean; permissions?: string[] } | null = null;
  const calls: Array<unknown[]> = [];
  app.decorateRequest('currentUser', null);
  app.addHook('onRequest', async (req) => { req.currentUser = user as typeof req.currentUser; });
  app.decorate('requireUser', async (req, reply) => { if (!req.currentUser) return reply.code(401).send({ ok: false }); });
  app.decorate('requirePermission', (permission: string) => async (req, reply) => {
    if (!req.currentUser) return reply.code(401).send({ ok: false });
    if (!req.currentUser.isActive || (req.currentUser.role !== 'admin' && !(req.currentUser.role === 'operator' && req.currentUser.permissions?.includes(permission)))) return reply.code(403).send({ ok: false });
  });
  app.setErrorHandler((error, _req, reply) => reply.code(error instanceof ZodError ? 400 : 500).send({ ok: false }));
  await app.register(createDocumentRecoveryRoutes({
    ...service,
    documentHealth: async () => [],
    listDocumentRequests: async (...args) => { calls.push(['list', ...args]); return []; },
    requestDocumentReupload: async (...args) => { calls.push(['create', ...args]); return { id: 1 } as Awaited<ReturnType<typeof service.requestDocumentReupload>>; },
    notifyDocumentRequest: async (...args) => { calls.push(['notify', ...args]); return { inApp: 'registered' }; },
    submitDocumentReplacement: async (...args) => { calls.push(['submit', ...args]); },
    reviewDocumentReplacement: async (...args) => { calls.push(['review', ...args]); },
  }), { prefix: '/api' });
  try {
    assert.equal((await app.inject('/api/admin/document-health')).statusCode, 401);
    user = { id: 10, role: 'customer', isActive: false };
    assert.equal((await app.inject('/api/admin/document-health')).statusCode, 403);
    await app.inject('/api/document-requests?userId=99');
    assert.deepEqual(calls.at(-1), ['list', 10]);
    await app.inject({ method: 'POST', url: '/api/document-requests/1/submit', payload: { fileUrl: '/api/files/12', userId: 99 } });
    assert.deepEqual(calls.at(-1), ['submit', 1, 10, '/api/files/12']);
    user = { id: 1, role: 'operator', isActive: true, permissions: ['manage_orders'] };
    assert.equal((await app.inject('/api/admin/document-health')).statusCode, 403);
    user.permissions = ['manage_users'];
    const inventory = await app.inject('/api/admin/document-health');
    assert.equal(inventory.statusCode, 200); assert.match(inventory.headers['cache-control']!, /private, no-store/);
    const create = await app.inject({ method: 'POST', url: '/api/admin/document-requests', payload: { uploadId: 8, message: 'لطفاً مجدداً بارگذاری کنید.' } });
    assert.equal(create.statusCode, 200);
    assert.deepEqual(calls.at(-1), ['notify', 1, { sms: false, bots: false }]);
    for (const payload of [{ action: 'reject' }, { action: 'invalid' }]) assert.equal((await app.inject({ method: 'PATCH', url: '/api/admin/document-requests/1', payload })).statusCode, 400);
    assert.equal((await app.inject({ method: 'PATCH', url: '/api/admin/document-requests/1', payload: { action: 'approve' } })).statusCode, 200);
    assert.equal((await app.inject({ method: 'POST', url: '/api/document-requests/0/submit', payload: {} })).statusCode, 400);
  } finally { await app.close(); }
});
