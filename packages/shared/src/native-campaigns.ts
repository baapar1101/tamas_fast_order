import { z } from 'zod';

export const NATIVE_DESTINATIONS = ['store', 'orders', 'wallet', 'credit', 'documents', 'account', 'favorites', 'cart', 'discounts', 'support', 'catalog'] as const;
export type NativeDestination = typeof NATIVE_DESTINATIONS[number];
export const NATIVE_DESTINATION_LABELS: Record<NativeDestination, string> = {
  store: 'صفحه اصلی فروشگاه', orders: 'سفارش‌های مشتری', wallet: 'کیف پول', credit: 'اعتبار و اقساط',
  documents: 'تکمیل مدارک', account: 'حساب کاربری', favorites: 'علاقه‌مندی‌ها', cart: 'سبد خرید',
  discounts: 'کدهای تخفیف', support: 'پشتیبانی', catalog: 'کاتالوگ کالاها',
};
export const campaignDraftSchema = z.object({
  title: z.string().trim().min(1, 'عنوان پیام را وارد کنید.').max(80),
  body: z.string().trim().min(1, 'متن پیام را وارد کنید.').max(600),
  destination: z.enum(NATIVE_DESTINATIONS),
  audience: z.enum(['all', 'selected']),
  userIds: z.array(z.number().int().positive()).max(5000).default([]),
}).strict().refine(v => v.audience === 'all' || v.userIds.length > 0, 'حداقل یک مشتری انتخاب کنید.')
  .transform(v => ({ ...v, userIds: v.audience === 'all' ? [] : [...new Set(v.userIds)].sort((a, b) => a - b) }));
export type CampaignDraft = z.infer<typeof campaignDraftSchema>;
export type CampaignStatus = 'draft' | 'queued' | 'sending' | 'completed' | 'cancelled';
export type DeliveryStatus = 'queued' | 'processing' | 'accepted' | 'failed' | 'skipped' | 'unknown' | 'cancelled';
export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  queued: 'در صف', processing: 'در حال ارسال', accepted: 'پذیرفته‌شده در سرویس پوش', failed: 'ناموفق',
  skipped: 'ارسال نشد', unknown: 'نتیجه نامشخص', cancelled: 'لغوشده',
};
export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'پیش‌نویس', queued: 'در صف ارسال', sending: 'در حال ارسال', completed: 'پایان ارسال', cancelled: 'لغوشده',
};
export type CampaignStats = Record<DeliveryStatus, number> & { total: number; received: number; opened: number; customers: number };
export interface NativeCampaignDTO extends CampaignDraft {
  id: number; revision: number; status: CampaignStatus; createdAt: string; updatedAt: string;
  queuedAt: string | null; completedAt: string | null; createdBy: number | null; stats: CampaignStats;
}
export interface CampaignPreview {
  customers: number; reachable: number; devices: number; skipped: number; token: string; pushEnabled: boolean;
}
export interface CampaignCustomer { id: number; name: string; lastName: string; phone: string; storeName: string; devices: number }
export interface CampaignDeliveryDTO {
  id: number; userId: number | null; name: string; phone: string; status: DeliveryStatus; attempts: number;
  error: string | null; sentAt: string | null; receivedAt: string | null; openedAt: string | null; updatedAt: string;
}
// Older APKs can still route these events to their closest supported screen.
export function campaignEvent(destination: NativeDestination) {
  return `${destination === 'orders' ? 'order' : destination === 'documents' ? 'document' : destination}.announcement`;
}
