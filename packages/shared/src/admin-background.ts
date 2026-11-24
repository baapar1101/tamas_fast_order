import { z } from 'zod';

/**
 * Each admin's own backdrop for the management panel: the animated smoke
 * (default), one of the built-in scenes, or a photo they uploaded. Stored per
 * user as JSON in the `admin_background:<userId>` setting, so it follows the
 * admin to every device.
 */
export const ADMIN_BACKGROUND_SETTING_PREFIX = 'admin_background:';
/** Uploaded backdrops live under this storage folder, one file per admin. */
export const ADMIN_BACKGROUND_FOLDER = 'admin-bg';

export const ADMIN_BACKGROUND_PRESETS = [
  { id: 'starry', label: 'شب پرستاره' },
  { id: 'aurora', label: 'شفق' },
  { id: 'ocean', label: 'اقیانوس' },
  { id: 'sunset', label: 'غروب' },
  { id: 'forest', label: 'جنگل' },
  { id: 'graphite', label: 'ساده' },
] as const;
export type AdminBackgroundPresetId = (typeof ADMIN_BACKGROUND_PRESETS)[number]['id'];
const PRESET_IDS = ADMIN_BACKGROUND_PRESETS.map((preset) => preset.id) as [AdminBackgroundPresetId, ...AdminBackgroundPresetId[]];

export const adminBackgroundSchema = z.object({
  version: z.literal(1),
  mode: z.enum(['animated', 'preset', 'image']),
  preset: z.enum(PRESET_IDS),
  /** Site path of the admin's uploaded photo ("/uploads/admin-bg/…"); empty when none. */
  imageUrl: z.string().trim().max(400),
  /** How strongly the backdrop is darkened (lightened in light theme), in percent. */
  dim: z.number().int().min(0).max(90),
  /** Blur in pixels, so busy photos don't fight with the text. */
  blur: z.number().int().min(0).max(24),
}).refine((value) => value.mode !== 'image' || value.imageUrl.length > 0, {
  message: 'اول یک عکس انتخاب کنید.',
  path: ['imageUrl'],
});
export type AdminBackground = z.infer<typeof adminBackgroundSchema>;

export const DEFAULT_ADMIN_BACKGROUND: AdminBackground = {
  version: 1,
  mode: 'animated',
  preset: 'starry',
  imageUrl: '',
  dim: 45,
  blur: 0,
};

export function adminBackgroundSettingKey(userId: number): string {
  return `${ADMIN_BACKGROUND_SETTING_PREFIX}${userId}`;
}

/** A stored value, or the default when it is missing or no longer valid. */
export function parseAdminBackground(raw: string | null | undefined): AdminBackground {
  if (!raw) return DEFAULT_ADMIN_BACKGROUND;
  try {
    const parsed = adminBackgroundSchema.safeParse({ ...DEFAULT_ADMIN_BACKGROUND, ...JSON.parse(raw) });
    return parsed.success ? parsed.data : DEFAULT_ADMIN_BACKGROUND;
  } catch {
    return DEFAULT_ADMIN_BACKGROUND;
  }
}
