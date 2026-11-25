import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { orderCreateSchema } from '@tamas/shared';
import { createOrder, listOrdersForUser } from '../services/orders.js';
import { processUpload } from '../services/uploads.js';
import { clearUserCart } from '../services/funnel.js';
import { submitOrderPaymentInfo } from '../services/order-payment-info.js';

const routes: FastifyPluginAsync = async (app) => {
  app.post(
    '/orders',
    { preHandler: [app.requireUser], config: { rateLimit: { max: 30, timeWindow: '10 minutes' } } },
    async (req) => {
      const body = orderCreateSchema.parse(req.body);
      const order = await createOrder(req.currentUser!, body);
      // The cart became an order: no abandoned-cart reminder for it.
      void clearUserCart(req.currentUser!.id).catch((err) => req.log.warn({ err }, 'failed to clear saved cart'));
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
        checkNote: z.string().optional(),
      }).parse(req.body);

      return submitOrderPaymentInfo(req.currentUser!.id, body, req.log);
    },
  );

  /** Generic file upload for authenticated users (receipts, credit docs, etc) */
  app.post(
    '/uploads',
    { preHandler: [app.requireUser], config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } },
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
            privateScope: 'payment',
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
