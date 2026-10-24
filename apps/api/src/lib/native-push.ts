import { z } from 'zod';
export const nativeDeviceSchema = z.object({
  installationId: z.string().uuid(),
  token: z.string().trim().min(30).max(4096).regex(/^[A-Za-z0-9_:-]+$/),
  platform: z.literal('android'),
}).strict();
export type NativeDeviceInput = z.infer<typeof nativeDeviceSchema>;
/** No customer name, debt, account number, identity data or documents leave our server. */
export function nativeMessage(event: string) {
  const title = event.startsWith('order.') ? 'به‌روزرسانی سفارش تماس مارکت'
    : event.startsWith('payment.') || event.startsWith('installment.') || event.startsWith('cheque.') ? 'پیام جدید بخش پرداخت تماس مارکت'
      : 'پیام جدید تماس مارکت';
  return { notification: { title, body: 'برای مشاهدهٔ جزئیات، اپ تماس مارکت را باز کنید.' },
    data: { screen: 'account', event: event.slice(0, 100) },
    android: { priority: 'HIGH' as const, ttl: '86400s', notification: { channel_id: 'orders', visibility: 'PRIVATE' as const } },
  };
}
