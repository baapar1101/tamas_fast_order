import assert from 'node:assert/strict';
import test from 'node:test';
import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { createAuthPlugin } from '../src/plugins/auth.js';
import type { UserSession } from '../src/services/auth.js';

test('a verified Bearer session becomes an HttpOnly cookie usable by document links; CSRF is rejected', async () => {
  const app = Fastify();
  await app.register(cookie);
  const user = { id: 1, role: 'admin', isActive: true } as UserSession;
  await app.register(async (scope) => {
    await createAuthPlugin(async (token) => token === 'valid-test-session' ? user : null)(scope, {});
    scope.get('/api/auth/me', { preHandler: [scope.requireUser] }, async () => ({ ok: true }));
    scope.get('/api/files/1', { preHandler: [scope.requireUser] }, async () => ({ ok: true }));
    scope.get('/api/catalog/products', async () => ({ ok: true }));
    scope.post('/api/action', { preHandler: [scope.requireUser] }, async () => ({ ok: true }));
  });
  try {
    const authenticated = await app.inject({ url: '/api/auth/me', headers: { authorization: 'Bearer valid-test-session' } });
    assert.equal(authenticated.statusCode, 200);
    const header = String(authenticated.headers['set-cookie']);
    assert.match(header, /HttpOnly/);
    assert.match(header, /SameSite=Lax/);
    assert.match(header, /Path=\//);
    assert.match(authenticated.headers['cache-control']!, /no-store/);
    assert.equal((await app.inject({ url: '/api/catalog/products', headers: { authorization: 'Bearer valid-test-session' } })).headers['set-cookie'], undefined);
    const credentials = header.split(';')[0]!;
    assert.equal((await app.inject({ url: '/api/files/1', headers: { cookie: credentials } })).statusCode, 200);
    assert.equal((await app.inject({ method: 'POST', url: '/api/action', headers: { cookie: credentials, origin: 'https://attacker.invalid' } })).statusCode, 403);
    assert.equal((await app.inject({ method: 'POST', url: '/api/action', headers: { cookie: credentials, origin: 'https://tamasmarket.com' } })).statusCode, 200);
    assert.equal((await app.inject({ url: '/api/files/1', headers: { cookie: 'tamas_session=invalid' } })).statusCode, 401);
  } finally { await app.close(); }
});
