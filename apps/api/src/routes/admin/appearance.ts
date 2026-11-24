import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import sharp from 'sharp';
import {
  ADMIN_BACKGROUND_FOLDER,
  adminBackgroundSchema,
  adminBackgroundSettingKey,
  parseAdminBackground,
} from '@tamas/shared';
import { badRequest } from '../../lib/errors.js';
import { getSetting, setSetting } from '../../services/settings.js';
import { storage } from '../../services/storage/index.js';

/** Long edge of an uploaded backdrop: sharp on large screens, still small. */
const BACKDROP_EDGE = 2560;

/** The storage key of a backdrop this admin uploaded, else null. */
export function ownImageKey(userId: number, url: string): string | null {
  const prefix = `${storage.publicUrl(ADMIN_BACKGROUND_FOLDER)}/`;
  if (!url.startsWith(prefix)) return null;
  const name = url.slice(prefix.length);
  return new RegExp(`^${userId}-[0-9a-f-]{36}\\.webp$`).test(name) ? `${ADMIN_BACKGROUND_FOLDER}/${name}` : null;
}

/**
 * The panel's look for the signed-in admin. Every admin and operator sets
 * their own; no extra permission is needed because it only affects them.
 */
const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireAdmin);

  app.get('/admin/me/background', async (req) => ({
    ok: true,
    background: parseAdminBackground(await getSetting(adminBackgroundSettingKey(req.currentUser!.id))),
  }));

  app.put('/admin/me/background', async (req) => {
    const userId = req.currentUser!.id;
    const parsed = adminBackgroundSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'تنظیمات پس‌زمینه معتبر نیست.');
    const next = parsed.data;
    if (next.imageUrl && !ownImageKey(userId, next.imageUrl)) throw badRequest('فقط عکسی که خودتان برای پس‌زمینه آپلود کرده‌اید قبول است.');

    const key = adminBackgroundSettingKey(userId);
    const previous = parseAdminBackground(await getSetting(key));
    await setSetting(key, JSON.stringify(next));

    // A replaced photo is no longer used by anyone.
    const oldKey = previous.imageUrl && previous.imageUrl !== next.imageUrl ? ownImageKey(userId, previous.imageUrl) : null;
    if (oldKey) await storage.delete(oldKey).catch((err) => req.log.warn({ err }, 'old admin backdrop not deleted'));

    return { ok: true, background: next, message: 'پس‌زمینه ذخیره شد.' };
  });

  /** One photo, resized and stored; it is used only after the admin saves. */
  app.post('/admin/me/background/image', async (req) => {
    if (!req.isMultipart()) throw badRequest('درخواست باید از نوع multipart باشد.');
    const file = await req.file();
    if (!file) throw badRequest('فایلی دریافت نشد.');
    if (!file.mimetype.startsWith('image/')) throw badRequest('فقط فایل عکس قبول است.');
    const buffer = await file.toBuffer();

    let image: Buffer;
    try {
      image = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize({ width: BACKDROP_EDGE, height: BACKDROP_EDGE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toBuffer();
    } catch {
      throw badRequest('این فایل عکس قابل خواندن نیست.');
    }

    const key = `${ADMIN_BACKGROUND_FOLDER}/${req.currentUser!.id}-${randomUUID()}.webp`;
    await storage.put(key, image, 'image/webp');
    return { ok: true, url: storage.publicUrl(key) };
  });
};

export default routes;
