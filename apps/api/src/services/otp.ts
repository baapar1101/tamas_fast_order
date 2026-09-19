import { and, count, eq, gt, isNull, sql as raw } from 'drizzle-orm';
import { db } from '../db/client.js';
import { otpCodes } from '../db/schema.js';
import { env } from '../env.js';
import { badRequest, tooMany } from '../lib/errors.js';
import { randomDigits, safeEqualHex, sha256 } from '../lib/hash.js';

/**
 * Two provider styles, both driven from the server:
 *
 *  • `console`  — this API generates and verifies the code itself and prints it
 *                 to the log. Used in development and by any SMS gateway that
 *                 accepts a ready-made message.
 *  • `eldery`   — the existing otp.eldery.ir service generates and verifies its
 *                 own code; we only call it. Verification still runs here, in
 *                 the backend, which is the whole point: the legacy build
 *                 verified in the browser and then asked for a session, so
 *                 anyone could mint a session for any phone number.
 */

interface SendResult {
  ok: boolean;
  error?: string;
  /** Present only in development, so the dev UI can prefill the field. */
  devCode?: string;
}

function delegated(): boolean {
  return env.OTP_PROVIDER === 'eldery';
}

async function callProvider(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.OTP_API_KEY) headers.Authorization = `Bearer ${env.OTP_API_KEY}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${env.OTP_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { ok: res.ok && data?.success !== false, data };
  } finally {
    clearTimeout(timer);
  }
}

/** How long the caller still has to wait before a resend is allowed, in seconds. */
export async function resendCooldown(phone: string): Promise<number> {
  const [latest] = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(eq(otpCodes.phone, phone))
    .orderBy(raw`${otpCodes.createdAt} desc`)
    .limit(1);
  if (!latest) return 0;
  const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(env.OTP_RESEND_SECONDS - elapsed));
}

async function assertUnderHourlyLimit(phone: string): Promise<void> {
  const since = new Date(Date.now() - 3600_000);
  const [row] = await db
    .select({ n: count() })
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), gt(otpCodes.createdAt, since)));
  if ((row?.n ?? 0) >= env.OTP_MAX_PER_HOUR) {
    throw tooMany('تعداد درخواست کد بیش از حد مجاز است. یک ساعت دیگر تلاش کنید.');
  }
}

import { sendTemplatedSms } from './sms.js';

const inMemoryOtp = new Map<string, { code: string; expiresAt: Date }>();

export async function sendOtp(phone: string, ip: string | undefined): Promise<SendResult> {
  const code = randomDigits(env.OTP_LENGTH);
  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

  const sendCodeSms = async () => {
    if (env.OTP_PROVIDER === 'rastin') {
      const sms = await sendTemplatedSms(phone, 'sms_template_otp', { code }, `کد تایید شما در تماس مارکت: {code}`);
      if (!sms.ok) throw badRequest(sms.error || 'ارسال پیامک ناموفق بود.');
    }
  };

  try {
    const wait = await resendCooldown(phone);
    if (wait > 0) throw tooMany(`تا ارسال مجدد ${wait} ثانیه صبر کنید.`);
    await assertUnderHourlyLimit(phone);

    if (delegated()) {
      const { ok, data } = await callProvider('/otp/send', { phone });
      if (!ok) {
        throw badRequest(data?.error || data?.message || 'ارسال پیامک ناموفق بود. کمی بعد تلاش کنید.');
      }
      await db.insert(otpCodes).values({ phone, codeHash: '', expiresAt, requestIp: ip ?? null });
      return { ok: true };
    }

    await sendCodeSms();

    await db.insert(otpCodes).values({
      phone,
      codeHash: sha256(`${phone}:${code}`),
      expiresAt,
      requestIp: ip ?? null,
    });
  } catch (err) {
    if (err instanceof Error && (err.message.includes('ECONNREFUSED') || (err as any).code === 'ECONNREFUSED')) {
      console.warn(`[otp] Postgres offline, falling back to in-memory code for ${phone}`);
      await sendCodeSms();
      inMemoryOtp.set(phone, { code, expiresAt });
    } else {
      throw err;
    }
  }

  // eslint-disable-next-line no-console
  console.info(`[otp] ${phone} → ${code} (valid ${env.OTP_TTL_SECONDS}s)`);
  return { ok: true, devCode: env.NODE_ENV === 'production' ? undefined : code };
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  try {
    if (delegated()) {
      const { ok, data } = await callProvider('/otp/verify', { phone, code });
      return ok && data?.verified !== false;
    }

    const [row] = await db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
      .orderBy(raw`${otpCodes.createdAt} desc`)
      .limit(1);

    if (!row) {
      const mem = inMemoryOtp.get(phone);
      if (mem && mem.expiresAt > new Date() && mem.code === code) {
        inMemoryOtp.delete(phone);
        return true;
      }
      return false;
    }
    if (row.attempts >= env.OTP_MAX_ATTEMPTS) {
      throw tooMany('تعداد تلاش‌های اشتباه زیاد بود. کد جدید بگیرید.');
    }

    const matches = safeEqualHex(row.codeHash, sha256(`${phone}:${code}`));
    if (!matches) {
      await db.update(otpCodes).set({ attempts: row.attempts + 1 }).where(eq(otpCodes.id, row.id));
      return false;
    }

    await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));
    return true;
  } catch (err) {
    if (err instanceof Error && (err.message.includes('ECONNREFUSED') || (err as any).code === 'ECONNREFUSED')) {
      const mem = inMemoryOtp.get(phone);
      if (mem && mem.expiresAt > new Date() && mem.code === code) {
        inMemoryOtp.delete(phone);
        return true;
      }
      return false;
    }
    throw err;
  }
}

/** Drops codes that expired more than a day ago; called from the scheduler. */
export async function pruneOtpCodes(): Promise<number> {
  const cutoff = new Date(Date.now() - 86_400_000);
  const rows = await db.delete(otpCodes).where(raw`${otpCodes.expiresAt} < ${cutoff}`).returning({ id: otpCodes.id });
  return rows.length;
}
