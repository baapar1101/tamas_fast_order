import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import Fastify from 'fastify';
import { canReadPrivateFile, confinedFilePath, privateFileId, type FileReader } from '../src/lib/private-files.js';
import { createPrivateFileRoutes } from '../src/routes/private-files.js';

const file = { id: 7, privateScope: 'credit' as const, privateOwnerId: 10, uploadedBy: 1, storageKey: 'certificate/2026-10/sample.pdf', thumbKey: null, mimeType: 'application/pdf' };
const owner = { id: 10, role: 'customer', isActive: false };
const operator = (permissions: string[]) => ({ id: 20, role: 'operator', isActive: true, permissions });

test('private documents authorize the owner and only correctly scoped active staff', () => {
  assert.equal(canReadPrivateFile(owner, file), true);
  assert.equal(canReadPrivateFile({ ...owner, id: 11 }, file), false);
  assert.equal(canReadPrivateFile(operator(['manage_content']), file), false);
  assert.equal(canReadPrivateFile(operator(['manage_orders']), file), false);
  assert.equal(canReadPrivateFile(operator(['manage_users']), file), true);
  assert.equal(canReadPrivateFile(operator(['manage_orders']), { ...file, privateScope: 'payment' }), true);
  assert.equal(canReadPrivateFile({ id: 1, role: 'admin', isActive: false }, file), false);
  assert.equal(canReadPrivateFile({ id: 1, role: 'admin', isActive: true }, file), true);
});

test('private file IDs and storage paths reject traversal and untrusted URLs', () => {
  assert.equal(privateFileId('/api/files/7'), 7);
  for (const value of ['/api/files/0', '/api/files/7/../../1', 'https://evil.test/api/files/7', '/api/files/7?token=secret']) assert.equal(privateFileId(value), null);
  for (const key of ['../secret', 'a/../../secret', '/etc/passwd', 'a\\secret', 'a//file', 'a/./file']) assert.throws(() => confinedFilePath(process.cwd(), key));
  assert.ok(confinedFilePath(process.cwd(), file.storageKey).endsWith('sample.pdf'));
});

test('actual HTTP download blocks anonymous/other users, streams to owner, and never caches', async () => {
  const app = Fastify();
  let user: FileReader | null = null;
  let opens = 0;
  const audits: unknown[] = [];
  app.decorateRequest('currentUser', null);
  app.addHook('onRequest', async (req) => { req.currentUser = user as typeof req.currentUser; });
  app.decorate('requireUser', async (req, reply) => { if (!req.currentUser) return reply.code(401).send({ ok: false }); });
  await app.register(createPrivateFileRoutes({
    find: async (id) => id === 7 ? file as Awaited<ReturnType<typeof import('../src/services/private-files.js').findPrivateFile>> : null,
    open: async () => { opens += 1; return { stream: Readable.from(Buffer.from('%PDF-test')), size: 9 }; },
    audit: async (...args) => { audits.push(args); },
  }), { prefix: '/api' });
  try {
    for (const reader of [null, { ...owner, id: 11 }, operator(['manage_content']), operator(['manage_orders'])]) {
      user = reader;
      const result = await app.inject('/api/files/7');
      assert.equal(result.statusCode, reader ? 404 : 401);
      assert.match(result.headers['cache-control']!, /no-store/);
    }
    assert.equal(opens, 0);
    user = owner;
    const response = await app.inject('/api/files/7');
    assert.equal(response.statusCode, 200);
    assert.equal(response.body, '%PDF-test');
    assert.match(response.headers['cache-control']!, /private, no-store/);
    assert.match(response.headers.vary!, /Cookie, Authorization/);
    assert.equal(response.headers['cross-origin-resource-policy'], 'same-origin');
    assert.equal(audits.length, 1);
    assert.equal((await app.inject('/api/files/8')).statusCode, 404);
    assert.equal((await app.inject('/api/files/7?variant=thumb')).statusCode, 404);
  } finally { await app.close(); }
});
