import { and, eq, gt, lt } from 'drizzle-orm';
import { REQUIRED_PROFILE_FIELDS, type UserDTO } from '@tamas/shared';
import { db } from '../db/client.js';
import { sessions, users } from '../db/schema.js';
import { adminPhones, env } from '../env.js';
import { randomToken, sha256 } from '../lib/hash.js';
import { crmClient } from '../lib/crm.js';

export type UserRow = typeof users.$inferSelect;

export function toUserDTO(row: UserRow): UserDTO {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    lastName: row.lastName,
    storeName: row.storeName,
    landline: row.landline,
    address: row.address,
    postalCode: row.postalCode,
    certificateFileUrl: row.certificateFileUrl,
    activity: row.activity,
    pageWebsite: row.pageWebsite,
    nationalCode: row.nationalCode ?? '',
    birthDate: row.birthDate ?? '',
    fatherName: row.fatherName ?? '',
    isVerifiedIdentity: row.isVerifiedIdentity ?? false,
    isActive: row.isActive,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Required profile fields the user has not filled in yet. */
export function missingProfileFields(row: UserRow): string[] {
  return REQUIRED_PROFILE_FIELDS.filter((f) => !String(row[f] ?? '').trim());
}

const inMemoryUsers = new Map<string, UserRow>();
const inMemorySessions = new Map<string, { userId: number; expiresAt: Date }>();

/**
 * Looks the user up by verified phone number, creating the row on first login.
 * Phones listed in ADMIN_PHONES are promoted so the panel has an owner from the
 * very first deploy.
 */
export async function findOrCreateUser(phone: string): Promise<{ row: UserRow; isNew: boolean }> {
  try {
    const [existing] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (existing) {
      const shouldPromote = adminPhones.includes(phone) && existing.role !== 'admin';
      if (shouldPromote) {
        const [promoted] = await db
          .update(users)
          .set({ role: 'admin', isActive: true, updatedAt: new Date() })
          .where(eq(users.id, existing.id))
          .returning();
        return { row: promoted ?? existing, isNew: false };
      }
      return { row: existing, isNew: false };
    }

    const isAdmin = adminPhones.includes(phone);
    const [created] = await db
      .insert(users)
      .values({ phone, role: isAdmin ? 'admin' : 'customer', isActive: isAdmin })
      .returning();
    if (!created) throw new Error('failed to create user');

    // Fire-and-forget CRM person sync for new users
    crmClient.pushPerson({
      firstName: '',
      lastName: '',
      phone: created.phone,
      email: `${created.phone}@tamas.local`,
      aliasName: created.phone,
    }).catch((err: unknown) => {
      // CRM sync failure shouldn't block user creation
    });

    return { row: created, isNew: true };
  } catch (err) {
    if (err instanceof Error && (err.message.includes('ECONNREFUSED') || (err as any).code === 'ECONNREFUSED')) {
      const existing = inMemoryUsers.get(phone);
      if (existing) return { row: existing, isNew: false };
      const isAdmin = adminPhones.includes(phone);
      const dummy: UserRow = {
        id: Math.floor(Math.random() * 10000) + 1,
        phone,
        name: '',
        lastName: '',
        storeName: '',
        landline: '',
        address: '',
        postalCode: '',
        certificateFileUrl: '',
        activity: '',
        pageWebsite: '',
        nationalCode: '',
        birthDate: '',
        fatherName: '',
        isVerifiedIdentity: false,
        isActive: true,
        role: isAdmin ? 'admin' : 'customer',
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        sheetHash: null,
        sheetSyncedAt: null,
      };
      inMemoryUsers.set(phone, dummy);
      return { row: dummy, isNew: true };
    }
    throw err;
  }
}

export async function createSession(
  userId: number,
  meta: { ip?: string; userAgent?: string },
): Promise<string> {
  const token = randomToken(32);
  const hash = sha256(token);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 86_400_000);

  try {
    await db.insert(sessions).values({
      tokenHash: hash,
      userId,
      ip: meta.ip?.slice(0, 64) ?? null,
      userAgent: meta.userAgent?.slice(0, 400) ?? null,
      expiresAt,
    });
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  } catch (err) {
    if (err instanceof Error && (err.message.includes('ECONNREFUSED') || (err as any).code === 'ECONNREFUSED')) {
      inMemorySessions.set(hash, { userId, expiresAt });
    } else {
      throw err;
    }
  }
  return token;
}

export async function resolveSession(token: string | undefined): Promise<UserRow | null> {
  if (!token) return null;
  const hash = sha256(token);

  try {
    const [row] = await db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, hash), gt(sessions.expiresAt, new Date())))
      .limit(1);
    if (!row) return null;

    // Touch at most once a minute; the write is not worth it on every request.
    if (Date.now() - row.session.lastSeenAt.getTime() > 60_000) {
      await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, row.session.id));
    }
    return row.user;
  } catch (err) {
    if (err instanceof Error && (err.message.includes('ECONNREFUSED') || (err as any).code === 'ECONNREFUSED')) {
      const sess = inMemorySessions.get(hash);
      if (!sess || sess.expiresAt < new Date()) return null;
      for (const u of inMemoryUsers.values()) {
        if (u.id === sess.userId) return u;
      }
      return null;
    }
    throw err;
  }
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
}

export async function pruneSessions(): Promise<number> {
  const rows = await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).returning({ id: sessions.id });
  return rows.length;
}
