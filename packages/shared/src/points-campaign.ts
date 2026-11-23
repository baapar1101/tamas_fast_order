import { z } from 'zod';

/**
 * The points campaign (for example «یلدای تماس مارکت»): every product can carry
 * points; a customer earns a product's points for each unit in an order that
 * is paid or delivered during the campaign. The live leaderboard ranks
 * customers by points; at the end the top customer wins a prize outright and
 * the rest enter a lottery where more points mean more chances.
 *
 * Stored as JSON in the `points_campaign` setting.
 */
export const POINTS_CAMPAIGN_SETTING_KEY = 'points_campaign';

export const pointsCampaignWinnerSchema = z.object({
  userId: z.number().int(),
  name: z.string(),
  phone: z.string(),
  points: z.number().int(),
  kind: z.enum(['first', 'lottery']),
});
export type PointsCampaignWinner = z.infer<typeof pointsCampaignWinnerSchema>;

export const pointsCampaignDrawSchema = z.object({
  drawnAt: z.string(),
  /** Customers in the lottery and their points (chances) at the moment of the draw. */
  entrants: z.number().int(),
  totalPoints: z.number().int(),
  winners: z.array(pointsCampaignWinnerSchema),
});
export type PointsCampaignDraw = z.infer<typeof pointsCampaignDrawSchema>;

export const pointsCampaignConfigSchema = z.object({
  version: z.literal(1),
  enabled: z.boolean(),
  title: z.string().trim().min(1, 'عنوان کمپین را بنویسید.').max(80),
  subtitle: z.string().trim().max(240),
  /** ISO instants; points count for orders placed between them. */
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  leaderboardSize: z.number().int().min(3).max(50),
  firstPrize: z.string().trim().max(200),
  lotteryPrize: z.string().trim().max(200),
  lotteryWinners: z.number().int().min(0).max(50),
  rules: z.string().trim().max(3000),
  draw: pointsCampaignDrawSchema.nullable(),
}).refine((config) => !config.startsAt || !config.endsAt || config.endsAt > config.startsAt, {
  message: 'پایان کمپین باید بعد از شروع آن باشد.',
  path: ['endsAt'],
});
export type PointsCampaignConfig = z.infer<typeof pointsCampaignConfigSchema>;

export const DEFAULT_POINTS_CAMPAIGN_CONFIG: PointsCampaignConfig = {
  version: 1,
  enabled: false,
  title: 'کمپین یلدای تماس مارکت',
  subtitle: 'با هر خرید امتیاز بگیرید؛ نفر اول جایزهٔ ویژه می‌گیرد و همه در قرعه‌کشی شرکت می‌کنند.',
  startsAt: null,
  endsAt: null,
  leaderboardSize: 10,
  firstPrize: '',
  lotteryPrize: '',
  lotteryWinners: 3,
  rules: [
    'هر کالای کمپین امتیاز مشخصی دارد که روی کارت کالا نوشته شده است.',
    'امتیاز سفارش وقتی حساب می‌شود که سفارش پرداخت یا تحویل شود؛ سفارش لغوشده امتیاز ندارد.',
    'نفر اول جدول در پایان کمپین بدون قرعه‌کشی جایزه می‌گیرد.',
    'بقیهٔ شرکت‌کنندگان در قرعه‌کشی هستند و هر امتیاز یک شانس است.',
  ].join('\n'),
  draw: null,
};

export function parsePointsCampaignConfig(raw: string | null | undefined): PointsCampaignConfig {
  if (!raw) return DEFAULT_POINTS_CAMPAIGN_CONFIG;
  try {
    const parsed = pointsCampaignConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_POINTS_CAMPAIGN_CONFIG;
  } catch {
    return DEFAULT_POINTS_CAMPAIGN_CONFIG;
  }
}

export type PointsCampaignPhase = 'off' | 'unscheduled' | 'upcoming' | 'running' | 'ended';

export function pointsCampaignPhase(config: Pick<PointsCampaignConfig, 'enabled' | 'startsAt' | 'endsAt'>, now: Date = new Date()): PointsCampaignPhase {
  if (!config.enabled) return 'off';
  if (!config.startsAt || !config.endsAt) return 'unscheduled';
  const time = now.getTime();
  if (time < Date.parse(config.startsAt)) return 'upcoming';
  if (time < Date.parse(config.endsAt)) return 'running';
  return 'ended';
}

/** Orders placed now earn points (the snapshot is taken at checkout). */
export function pointsCampaignAcceptsOrders(config: PointsCampaignConfig, now: Date = new Date()): boolean {
  return pointsCampaignPhase(config, now) === 'running';
}

/** «۰۹۱۲***۴۵۶۷»: enough to recognise yourself, not enough to call someone. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return '***';
  return `${digits.slice(0, 4)}***${digits.slice(-4)}`;
}

/** First name only, for the public board. */
export function publicFirstName(name: string | null | undefined): string {
  const first = String(name ?? '').trim().split(/\s+/)[0] ?? '';
  return first.slice(0, 24) || 'همکار';
}

export interface PointsLeaderboardEntry {
  rank: number;
  name: string;
  phone: string;
  points: number;
}

/** The public view of the campaign; null from the API when it is off. */
export interface PointsCampaignShowcase {
  title: string;
  subtitle: string;
  phase: Exclude<PointsCampaignPhase, 'off'>;
  startsAt: string | null;
  endsAt: string | null;
  serverTime: string;
  firstPrize: string;
  lotteryPrize: string;
  lotteryWinners: number;
  rules: string[];
  participants: number;
  leaderboard: PointsLeaderboardEntry[];
  /** The signed-in customer's own standing. */
  me: { rank: number | null; points: number } | null;
  /** Published once the admin has drawn the winners. */
  winners: Array<{ name: string; phone: string; points: number; kind: 'first' | 'lottery' }> | null;
}

/**
 * Weighted draw without replacement: each entrant's chance is proportional to
 * their points. `random` returns numbers in [0, 1); the server passes a
 * cryptographic source, tests a fixed one.
 */
export function drawWeighted<T extends { points: number }>(entrants: T[], count: number, random: () => number): T[] {
  const pool = entrants.filter((entrant) => entrant.points > 0);
  const winners: T[] = [];
  while (winners.length < count && pool.length > 0) {
    const total = pool.reduce((sum, entrant) => sum + entrant.points, 0);
    let ticket = random() * total;
    let index = 0;
    for (; index < pool.length - 1; index += 1) {
      ticket -= pool[index]!.points;
      if (ticket < 0) break;
    }
    winners.push(pool.splice(index, 1)[0]!);
  }
  return winners;
}
