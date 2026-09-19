import { desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLog } from '../db/schema.js';

/**
 * Records who changed what. Deliberately fire-and-forget: an audit write must
 * never be the reason a legitimate admin action fails.
 */
export async function logAction(
  actorId: number | null,
  action: string,
  entity: string,
  entityKey?: string | null,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId,
      action: action.slice(0, 80),
      entity: entity.slice(0, 60),
      entityKey: entityKey ? entityKey.slice(0, 200) : null,
      detail: detail ?? null,
    });
  } catch {
    // ignored on purpose
  }
}

export async function recentAudit(limit = 100) {
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}
