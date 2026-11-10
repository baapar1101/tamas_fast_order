import { z } from 'zod';

/** Storefront steps the browser reports, in funnel order. */
export const FUNNEL_EVENT_TYPES = ['visit', 'scroll', 'product_view', 'add_to_cart', 'checkout_start'] as const;
export type FunnelEventType = (typeof FUNNEL_EVENT_TYPES)[number];

export const funnelEventsSchema = z.object({
  visitorId: z.string().trim().regex(/^[A-Za-z0-9-]{8,40}$/),
  events: z.array(z.object({
    type: z.enum(FUNNEL_EVENT_TYPES),
    productId: z.string().trim().max(120).optional(),
    path: z.string().trim().max(300).optional(),
  })).min(1).max(20),
});

export const savedCartLineSchema = z.object({
  key: z.string().max(200),
  productId: z.string().min(1).max(120),
  title: z.string().max(400),
  color: z.string().max(80).nullable(),
  colorCode: z.string().max(40).nullable(),
  imageUrl: z.string().max(1000).nullable(),
  price: z.number().int().min(0),
  qty: z.number().int().min(1).max(10_000),
  warehouse: z.enum(['kerman', 'tehran', 'site']),
  maxStock: z.number().int().min(0),
});
export type SavedCartLineDTO = z.infer<typeof savedCartLineSchema>;

export const savedCartSchema = z.object({ items: z.array(savedCartLineSchema).max(200) });

/** Automatic follow-ups the site can send; each one has its own switch. */
export const FUNNEL_MESSAGE_KINDS = ['cart_reminder_1', 'cart_reminder_2', 'unpaid_order', 'browse_nudge'] as const;
export type FunnelMessageKind = (typeof FUNNEL_MESSAGE_KINDS)[number];

export interface FunnelAutomationConfig {
  abandonedCart: boolean;
  unpaidOrder: boolean;
  browseNudge: boolean;
  /** Use SMS when the customer has no linked Telegram/Bale bot. */
  smsFallback: boolean;
}

export const DEFAULT_FUNNEL_AUTOMATION: FunnelAutomationConfig = {
  abandonedCart: true,
  unpaidOrder: true,
  browseNudge: true,
  smsFallback: true,
};

export const funnelAutomationSchema = z.object({
  abandonedCart: z.boolean(),
  unpaidOrder: z.boolean(),
  browseNudge: z.boolean(),
  smsFallback: z.boolean(),
});

export function parseFunnelAutomation(value: string | null | undefined): FunnelAutomationConfig {
  if (!value) return { ...DEFAULT_FUNNEL_AUTOMATION };
  try {
    const parsed = JSON.parse(value) as Partial<Record<keyof FunnelAutomationConfig, unknown>>;
    return {
      abandonedCart: parsed.abandonedCart !== false,
      unpaidOrder: parsed.unpaidOrder !== false,
      browseNudge: parsed.browseNudge !== false,
      smsFallback: parsed.smsFallback !== false,
    };
  } catch {
    return { ...DEFAULT_FUNNEL_AUTOMATION };
  }
}

export type FunnelStepKey = 'visit' | 'logged_in' | 'scroll' | 'product_view' | 'add_to_cart' | 'checkout_start' | 'order' | 'paid';

export interface FunnelStepDTO {
  key: FunnelStepKey;
  label: string;
  people: number;
}

export interface FunnelMessageStatsDTO {
  kind: FunnelMessageKind;
  sent: number;
  delivered: number;
  /** Customers who ordered (or paid, for unpaid-order reminders) within 3 days of the message. */
  converted: number;
}

export interface FunnelReportDTO {
  days: number;
  steps: FunnelStepDTO[];
  messages: FunnelMessageStatsDTO[];
  automation: FunnelAutomationConfig;
  /** When tracking started; numbers before it are not comparable. */
  trackingSince: string | null;
}

export type FunnelSegment = 'browsed' | 'cart' | 'unpaid';

export interface FunnelUserRowDTO {
  userId: number;
  name: string;
  phone: string;
  storeName: string;
  lastActivityAt: string;
  productViews: number;
  scrolls: number;
  cartItems: number;
  cartTotal: number;
  orderId: number | null;
  orderCode: string | null;
  orderTotal: number | null;
  lastMessageAt: string | null;
  messagesSent: number;
}
