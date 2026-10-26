import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/native-management.js', import.meta.url), 'utf8');
async function boot(embedded: boolean, outcome: number | 'offline' = 200) {
  const calls: string[] = [];
  const status = { textContent: '' };
  await runInNewContext(source, {
    window: { ReactNativeWebView: embedded ? {} : undefined, location: { replace: (path: string) => calls.push(`navigate:${path}`) } },
    document: { getElementById: () => status },
    localStorage: { getItem: () => 'old-web-session', removeItem: (key: string) => calls.push(`remove:${key}`) },
    sessionStorage: { clear: () => calls.push('clear:sessionStorage') },
    fetch: async (url: string, options: { method: string; headers: { Authorization?: string } }) => {
      assert.equal(url, '/api/auth/logout');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer old-web-session');
      calls.push('logout');
      if (outcome === 'offline') throw new Error('offline');
      return { ok: outcome === 200, status: outcome };
    },
  });
  return { calls, status: status.textContent };
}
test('ordinary website visitors never lose their session through the native entry', async () => {
  assert.deepEqual((await boot(false)).calls, []);
});
test('management clears previous web storage and revokes its session before loading admin', async () => {
  assert.deepEqual((await boot(true)).calls, ['remove:tamas_auth_token', 'clear:sessionStorage', 'logout', 'navigate:/admin']);
  assert.equal((await boot(true, 401)).calls.at(-1), 'navigate:/admin');
});
test('management fails closed on an uncertain session reset', async () => {
  for (const outcome of [500, 403, 'offline'] as const) {
    const result = await boot(true, outcome);
    assert.equal(result.calls.some(call => call.startsWith('navigate:')), false);
    assert.ok(result.status);
  }
});
