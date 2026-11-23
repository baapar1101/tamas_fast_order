import { randomInt } from 'node:crypto';
import { and, desc, eq, gte, isNotNull, lt, ne, or, sql } from 'drizzle-orm';
import {
  POINTS_CAMPAIGN_SETTING_KEY,
  drawWeighted,
  maskPhone,
  parsePointsCampaignConfig,
  pointsCampaignPhase,
  publicFirstName,
  type PointsCampaignConfig,
  type PointsCampaignDraw,
  type PointsCampaignShowcase,
} from '@tamas/shared';
import { db } from '../db/client.js';
import { orderItems, orders, users } from '../db/schema.js';
import { badRequest } from '../lib/errors.js';
import { getSetting, setSetting } from './settings.js';

export async function getPointsCampaignConfig(): Promise<PointsCampaignConfig> {
  return parsePointsCampaignConfig(await getSetting(POINTS_CAMPAIGN_SETTING_KEY));
}

export async function savePointsCampaignConfig(config: PointsCampaignConfig): Promise<void> {
  await setSetting(POINTS_CAMPAIGN_SETTING_KEY, JSON.stringify(config));
  standingsCache = null;
}

/** Points per unit to freeze on an order line placed now: the product's points while the campaign runs. */
export async function checkoutPointsFor(now: Date = new Date()): Promise<(productPoints: number) => number> {
  const config = await getPointsCampaignConfig();
  const running = pointsCampaignPhase(config, now) === 'running';
  return (productPoints) => (running ? Math.max(0, Math.trunc(productPoints)) : 0);
}

export interface Standing {
  userId: number;
  name: string;
  lastName: string;
  phone: string;
  storeName: string;
  points: number;
  orders: number;
}

/**
 * Every customer's points: orders placed inside the campaign window that are
 * paid or delivered and not cancelled, summed over their frozen line points.
 * Ties go to whoever reached the score first (earliest last order).
 */
export async function campaignStandings(config: PointsCampaignConfig): Promise<Standing[]> {
  if (!config.startsAt || !config.endsAt) return [];
  const points = sql<number>`coalesce(sum(${orderItems.qty} * ${orderItems.campaignPoints}), 0)::int`;
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      lastName: users.lastName,
      phone: users.phone,
      storeName: users.storeName,
      points,
      orders: sql<number>`count(distinct ${orders.id})::int`,
      lastAt: sql<string>`max(${orders.createdAt})`,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(users, eq(users.id, orders.userId))
    .where(and(
      isNotNull(orders.userId),
      gte(orders.createdAt, new Date(config.startsAt)),
      lt(orders.createdAt, new Date(config.endsAt)),
      ne(orders.status, 'cancelled'),
      or(eq(orders.paymentStatus, 'paid'), eq(orders.status, 'delivered')),
    ))
    .groupBy(users.id)
    .having(sql`sum(${orderItems.qty} * ${orderItems.campaignPoints}) > 0`)
    .orderBy(desc(points), sql`max(${orders.createdAt}) asc`, users.id);
  return rows.map(({ lastAt: _lastAt, ...row }) => ({
    ...row,
    name: row.name ?? '',
    lastName: row.lastName ?? '',
    storeName: row.storeName ?? '',
  }));
}

// The public board is polled by every open campaign page; a few seconds of
// staleness is invisible and keeps the aggregate off the hot path.
const STANDINGS_TTL_MS = 10_000;
let standingsCache: { key: string; at: number; rows: Promise<Standing[]> } | null = null;

function cachedStandings(config: PointsCampaignConfig): Promise<Standing[]> {
  const key = `${config.startsAt}|${config.endsAt}`;
  const now = Date.now();
  if (standingsCache && standingsCache.key === key && now - standingsCache.at < STANDINGS_TTL_MS) return standingsCache.rows;
  const rows = campaignStandings(config);
  standingsCache = { key, at: now, rows };
  rows.catch(() => { standingsCache = null; });
  return rows;
}

export async function pointsCampaignShowcase(userId: number | null, now: Date = new Date()): Promise<PointsCampaignShowcase | null> {
  const config = await getPointsCampaignConfig();
  const phase = pointsCampaignPhase(config, now);
  if (phase === 'off') return null;
  const standings = phase === 'unscheduled' || phase === 'upcoming' ? [] : await cachedStandings(config);
  const index = userId ? standings.findIndex((row) => row.userId === userId) : -1;
  return {
    title: config.title,
    subtitle: config.subtitle,
    phase,
    startsAt: config.startsAt,
    endsAt: config.endsAt,
    serverTime: now.toISOString(),
    firstPrize: config.firstPrize,
    lotteryPrize: config.lotteryPrize,
    lotteryWinners: config.lotteryWinners,
    rules: config.rules.split('\n').map((line) => line.trim()).filter(Boolean),
    participants: standings.length,
    leaderboard: standings.slice(0, config.leaderboardSize).map((row, rank) => ({
      rank: rank + 1,
      name: publicFirstName(row.name),
      phone: maskPhone(row.phone),
      points: row.points,
    })),
    me: userId ? { rank: index >= 0 ? index + 1 : null, points: index >= 0 ? standings[index]!.points : 0 } : null,
    winners: config.draw
      ? config.draw.winners.map((winner) => ({ name: publicFirstName(winner.name), phone: maskPhone(winner.phone), points: winner.points, kind: winner.kind }))
      : null,
  };
}

/**
 * After the campaign ends: the top customer wins outright, then
 * `lotteryWinners` more are drawn from everyone else, weighted by points,
 * with a cryptographic random source. Runs once; the result is saved.
 */
export async function drawPointsCampaign(now: Date = new Date()): Promise<PointsCampaignDraw> {
  const config = await getPointsCampaignConfig();
  if (pointsCampaignPhase(config, now) !== 'ended') throw badRequest('قرعه‌کشی بعد از پایان کمپین انجام می‌شود.');
  if (config.draw) throw badRequest('قرعه‌کشی این کمپین قبلاً انجام شده است.');
  const standings = await campaignStandings(config);
  if (!standings.length) throw badRequest('هیچ مشتری‌ای در این کمپین امتیاز نگرفته است.');
  const [first, ...rest] = standings;
  const random = () => randomInt(0, 2 ** 32) / 2 ** 32;
  const lottery = drawWeighted(rest, config.lotteryWinners, random);
  const fullName = (row: Standing) => `${row.name} ${row.lastName}`.trim();
  const draw: PointsCampaignDraw = {
    drawnAt: now.toISOString(),
    entrants: rest.length,
    totalPoints: rest.reduce((sum, row) => sum + row.points, 0),
    winners: [
      { userId: first!.userId, name: fullName(first!), phone: first!.phone, points: first!.points, kind: 'first' },
      ...lottery.map((row) => ({ userId: row.userId, name: fullName(row), phone: row.phone, points: row.points, kind: 'lottery' as const })),
    ],
  };
  await savePointsCampaignConfig({ ...config, draw });
  return draw;
}
