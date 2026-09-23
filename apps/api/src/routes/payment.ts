import type { FastifyPluginAsync } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { orders, payments } from '../db/schema.js';
import { badRequest, notFound } from '../lib/errors.js';
// @ts-ignore
import paymentGateway from '../../../../payment/index.js';
import { env } from '../env.js';

const routes: FastifyPluginAsync = async (app) => {
  // Create a payment transaction and return the bank URL
  app.post(
    '/payment/create',
    { preHandler: [app.requireUser], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req) => {
      const { orderId } = z.object({ orderId: z.coerce.number().int() }).parse(req.body);
      
      const [order] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.userId, req.currentUser!.id), isNull(orders.deletedAt)))
        .limit(1);

      if (!order) throw notFound('سفارش پیدا نشد.');
      if (order.paymentStatus === 'paid') throw badRequest('این سفارش قبلاً پرداخت شده است.');

      const amount = order.total;
      
      // Calculate frontend redirect URL for callback
      const callbackUrl = `${req.headers.origin || 'https://tamas-fast-order.ir'}/payment/result`;

      try {
        const response = await paymentGateway.Create({
          amount,
          callback: callbackUrl,
          invoice_id: String(order.id),
          mobile: order.phone,
          description: `پرداخت سفارش ${order.orderCode}`,
        });

        const data = response.data;
        if (data && data.status === 'success') {
          const transid = data.transid;
          
          await db.insert(payments).values({
            orderId: order.id,
            userId: req.currentUser!.id,
            amount,
            gateway: 'aqayepardakht',
            refId: transid,
            status: 'pending',
          });

          return { ok: true, url: paymentGateway.StartPay(transid) };
        } else {
          throw new Error('خطا در ارتباط با درگاه پرداخت: ' + (data?.code || ''));
        }
      } catch (err) {
        req.log.error({ err }, 'Payment create failed');
        throw badRequest('خطا در ایجاد تراکنش بانکی. لطفاً کمی بعد تلاش کنید.');
      }
    }
  );

  // Callback from payment gateway (usually GET or POST)
  app.all('/payment/callback', async (req, reply) => {
    // Both GET query params and POST body could contain transid and status depending on bank
    const query = (req.method === 'POST' ? req.body : req.query) as any;
    
    const transid = query.transid;
    
    if (!transid) {
       return reply.redirect('/payment/result?status=failed&error=missing_transid');
    }

    const [paymentRecord] = await db
      .select()
      .from(payments)
      .where(eq(payments.refId, transid))
      .limit(1);

    if (!paymentRecord) {
       return reply.redirect('/payment/result?status=failed&error=invalid_transid');
    }

    if (paymentRecord.status === 'success') {
       return reply.redirect(`/payment/result?status=success&orderId=${paymentRecord.orderId}&trackingCode=${paymentRecord.trackingCode}`);
    }

    try {
      // Need to verify
      const verifyRes = await paymentGateway.Verify({
         amount: paymentRecord.amount,
         transid: transid,
      });

      const verifyData = verifyRes.data;

      if (verifyData && verifyData.status === 'success') {
        const trackingCode = verifyData.tracking_number || verifyData.code || transid;

        await db.transaction(async (tx) => {
           await tx.update(payments)
             .set({ status: 'success', trackingCode, updatedAt: new Date() })
             .where(eq(payments.id, paymentRecord.id));
             
           if (paymentRecord.orderId) {
             await tx.update(orders)
               .set({ paymentStatus: 'paid', status: 'confirmed', updatedAt: new Date() })
               .where(eq(orders.id, paymentRecord.orderId));
           }
        });

        return reply.redirect(`/payment/result?status=success&orderId=${paymentRecord.orderId}&trackingCode=${trackingCode}`);
      } else {
        await db.update(payments)
           .set({ status: 'failed', updatedAt: new Date() })
           .where(eq(payments.id, paymentRecord.id));
           
        return reply.redirect(`/payment/result?status=failed&orderId=${paymentRecord.orderId}&error=${verifyData?.code || 'verification_failed'}`);
      }
    } catch (err) {
      req.log.error({ err }, 'Payment verify failed');
      
      await db.update(payments)
         .set({ status: 'failed', updatedAt: new Date() })
         .where(eq(payments.id, paymentRecord.id));
         
      return reply.redirect(`/payment/result?status=failed&orderId=${paymentRecord.orderId}&error=server_error`);
    }
  });
};

export default routes;
