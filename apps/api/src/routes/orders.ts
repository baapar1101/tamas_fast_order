import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import { orderCreateSchema } from '@tamas/shared';
import { createOrder, listOrdersForUser } from '../services/orders.js';
import { processUpload } from '../services/uploads.js';
import { db } from '../db/client.js';
import { orders } from '../db/schema.js';

const routes: FastifyPluginAsync = async (app) => {
  app.post(
    '/orders',
    { preHandler: [app.requireUser], config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } },
    async (req) => {
      const body = orderCreateSchema.parse(req.body);
      const order = await createOrder(req.currentUser!, body);
      return { ok: true, order, message: `سفارش شما با شماره ${order.orderCode} ثبت شد.` };
    },
  );

  app.get('/orders', { preHandler: [app.requireUser] }, async (req) => {
    return { ok: true, orders: await listOrdersForUser(req.currentUser!.id) };
  });

  /** Submit secondary payment info (card-to-card receipt, check details, etc.) */
  app.post(
    '/orders/payment-info',
    { preHandler: [app.requireUser], config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } },
    async (req) => {
      const body = z.object({
        orderId: z.coerce.number().int(),
        paymentMethod: z.string(),
        depositorName: z.string().optional(),
        refNumber: z.string().optional(),
        receiptNote: z.string().optional(),
        receiptImageUrl: z.string().optional(),
        businessName: z.string().optional(),
        creditNote: z.string().optional(),
        checkNumber: z.string().optional(),
        checkBankName: z.string().optional(),
        checkDate: z.string().optional(),
        checkNote: z.string().optional(),
      }).parse(req.body);

      const [order] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, body.orderId), eq(orders.userId, req.currentUser!.id), isNull(orders.deletedAt)))
        .limit(1);

      if (!order) {
        return { ok: false, message: 'سفارش یافت نشد.' };
      }

      // Build a payment info note
      const { orderId, ...info } = body;
      const existingNote = order.note || '';
      const paymentNote = `\n--- اطلاعات پرداخت (${new Date().toLocaleDateString('fa-IR')}) ---\n${JSON.stringify(info, null, 2)}`;

      await db.update(orders)
        .set({ note: existingNote + paymentNote, updatedAt: new Date() })
        .where(eq(orders.id, orderId));

      return { ok: true, message: 'اطلاعات پرداخت با موفقیت ثبت شد.' };
    },
  );

  /** Upload receipt for an order */
  app.post(
    '/orders/upload-receipt',
    { preHandler: [app.requireUser], config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } },
    async (req) => {
      if (!req.isMultipart()) return { ok: false, message: 'درخواست نامعتبر است.' };

      let uploadedUrl = '';
      for await (const part of req.parts()) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer();
          const result = await processUpload({
            buffer,
            filename: part.filename || 'receipt.jpg',
            mimeType: part.mimetype,
            kind: 'other',
            uploadedBy: req.currentUser!.id,
          });
          uploadedUrl = result.url;
          break; // only one receipt
        }
      }

      if (!uploadedUrl) return { ok: false, message: 'فایلی یافت نشد.' };
      return { ok: true, url: uploadedUrl };
    },
  );
};

export default routes;
