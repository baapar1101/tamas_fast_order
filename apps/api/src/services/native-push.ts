import { readFile, access } from 'node:fs/promises';
import { createSign } from 'node:crypto';
import { resolve } from 'node:path';
import { and, eq, gt } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { sha256 } from '../lib/hash.js';
import { nativeMessage, type NativeDeviceInput } from '../lib/native-push.js';
import { badRequest } from '../lib/errors.js';
type ServiceAccount = { project_id: string; client_email: string; private_key: string };
let cachedToken: { value: string; expires: number; file: string } | null = null;
const credentialFile = () => process.env.FCM_SERVICE_ACCOUNT_FILE || resolve(process.cwd(), '.private/native-notifications/fcm-service-account.json');
export async function nativePushEnabled() {
  const path = credentialFile();
  try { await access(path); return true; } catch { return false; }
}
async function accessToken(account: ServiceAccount, file: string) {
  if (cachedToken?.file === file && cachedToken.expires > Date.now()) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  if (!response.ok) throw new Error('FCM authentication failed');
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('FCM did not return an access token');
  cachedToken = { value: data.access_token, file, expires: Date.now() + Math.max(60, (data.expires_in ?? 3600) - 120) * 1000 };
  return data.access_token;
}
export async function registerNativeDevice(userId: number, sessionToken: string, input: NativeDeviceInput) {
  if (!await nativePushEnabled()) throw badRequest('ارسال پوش هنوز در سرور فعال نشده است.');
  // UUID belongs to the app installation; logging in as another customer replaces its binding.
  const existing = await db.select({ id: schema.nativePushDevices.installationId }).from(schema.nativePushDevices)
    .where(eq(schema.nativePushDevices.userId, userId)).limit(21);
  if (existing.length >= 20 && !existing.some(d => d.id === input.installationId)) throw badRequest('تعداد دستگاه‌های ثبت‌شده بیش از حد مجاز است.');
  await db.insert(schema.nativePushDevices).values({ installationId: input.installationId, userId,
    sessionHash: sha256(sessionToken), token: input.token, enabled: true,
  }).onConflictDoUpdate({ target: schema.nativePushDevices.installationId, set: { userId, sessionHash: sha256(sessionToken), token: input.token, enabled: true, updatedAt: new Date() } });
}
export async function removeNativeDevice(userId: number, installationId: string) {
  await db.delete(schema.nativePushDevices).where(and(eq(schema.nativePushDevices.userId, userId), eq(schema.nativePushDevices.installationId, installationId)));
}
export async function sendNativeNotification(userId: number | null | undefined, event: string): Promise<boolean> {
  if (!userId || !await nativePushEnabled()) return false;
  const devices = await db.select({ id: schema.nativePushDevices.installationId, token: schema.nativePushDevices.token })
    .from(schema.nativePushDevices).innerJoin(schema.sessions, and(
      eq(schema.sessions.tokenHash, schema.nativePushDevices.sessionHash), eq(schema.sessions.userId, schema.nativePushDevices.userId), gt(schema.sessions.expiresAt, new Date()),
    )).where(and(eq(schema.nativePushDevices.userId, userId), eq(schema.nativePushDevices.enabled, true))).limit(20);
  if (!devices.length) return false;
  const file = credentialFile();
  const account = JSON.parse(await readFile(file, 'utf8')) as ServiceAccount;
  if (!/^[a-z][a-z0-9-]+$/.test(account.project_id) || !account.client_email || !account.private_key) throw new Error('FCM configuration invalid');
  const bearer = await accessToken(account, file);
  const delivered = await Promise.allSettled(devices.map(async (device) => {
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
      method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(10_000), body: JSON.stringify({ message: { token: device.token, ...nativeMessage(event) } }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null) as { error?: { details?: Array<{ errorCode?: string }> } } | null;
      if (error?.error?.details?.some(d => d.errorCode === 'UNREGISTERED')) {
        await db.update(schema.nativePushDevices).set({ enabled: false }).where(and(eq(schema.nativePushDevices.installationId, device.id), eq(schema.nativePushDevices.token, device.token)));
      }
    }
    return response.ok;
  }));
  return delivered.some(d => d.status === 'fulfilled' && d.value);
}

/** Validates IAM, OAuth and FCM payload without sending anything to a customer. */
export async function verifyNativePushConfiguration() {
  const file = credentialFile();
  const account = JSON.parse(await readFile(file, 'utf8')) as ServiceAccount;
  const bearer = await accessToken(account, file);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ validate_only: true, message: { topic: 'tamas-configuration-validation-only', ...nativeMessage('configuration.check') } }),
  });
  const payload = await response.json() as { error?: { status?: string; message?: string } };
  if (!response.ok) throw new Error(`FCM validation failed: ${payload.error?.status || response.status} ${payload.error?.message || ''}`);
  return { ok: true, project: account.project_id, validationOnly: true };
}
