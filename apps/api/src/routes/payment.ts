import type { FastifyPluginAsync } from 'fastify';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { orders, payments } from '../db/schema.js';
// @ts-ignore
import paymentGateway from '@tamas/payment';
import { applyWalletTransaction } from '../services/wallet.js';
import { transitionOrderStatusInTransaction } from '../services/order-inventory.js';
import { quoteCartPaymentTerms } from '../services/cart-quote.js';
import { createGatewayPayment } from '../services/gateway-payment.js';
import { issueFirstPurchaseReward } from '../services/discounts.js';

const routes: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(String(body))));
  });
  app.post('/payment/terms/quote', async (req) => {
    const body = z.object({
      items: z.array(z.object({
        productId: z.string().trim().min(1).max(80),
        qty: z.coerce.number().int().min(1).max(10_000),
      })).min(1).max(200),
    }).parse(req.body);
    return { ok: true, ...(await quoteCartPaymentTerms(body.items)) };
  });

  // Create a payment transaction and return the bank URL
  app.post(
    '/payment/create',
    { preHandler: [app.requireUser], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (req) => {
      const { orderId } = z.object({ orderId: z.coerce.number().int().positive() }).parse(req.body);
      return { ok: true, url: await createGatewayPayment(req.currentUser!.id, orderId, req.log) };
    }
  );

  // Callback from payment gateway (usually GET or POST)
  app.all('/payment/callback', async (req, reply) => {
    // Both GET query params and POST body could contain transid and status depending on bank
    const query = z.object({ transid: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(200)).optional() })
      .parse((req.method === 'POST' ? req.body : req.query) ?? {});
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

    const isWalletTopup = paymentRecord.note?.startsWith('wallet_topup:') && paymentRecord.userId;
    const resultPath = isWalletTopup ? '/wallet' : '/payment/result';

    if (paymentRecord.status === 'success') {
       return reply.redirect(`${resultPath}?status=success&orderId=${paymentRecord.orderId ?? ''}&trackingCode=${paymentRecord.trackingCode ?? ''}`);
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

        const newlySettled = await db.transaction(async (tx) => {
           const claimed = await tx.update(payments)
             .set({ status: 'success', trackingCode, updatedAt: new Date() })
             .where(and(eq(payments.id, paymentRecord.id), ne(payments.status, 'success')))
             .returning({ id: payments.id });
           if (claimed.length === 0) return false;
             
           if (paymentRecord.orderId) {
             await transitionOrderStatusInTransaction(tx, paymentRecord.orderId, 'confirmed');
             await tx.update(orders)
               .set({ paymentStatus: 'paid', updatedAt: new Date() })
               .where(eq(orders.id, paymentRecord.orderId));
           }
           if (isWalletTopup && paymentRecord.userId) {
             await applyWalletTransaction(tx, {
               userId: paymentRecord.userId,
               direction: 'credit',
               type: 'deposit',
               amount: paymentRecord.amount,
               description: 'شارژ آنلاین کیف پول',
               reference: trackingCode,
               idempotencyKey: `payment:${paymentRecord.id}`,
             });
           }
           return true;
        });

        if (!newlySettled) return reply.redirect(`${resultPath}?status=success&orderId=${paymentRecord.orderId ?? ''}`);

        if (paymentRecord.orderId) {
          const [paidOrder] = await db.select().from(orders).where(eq(orders.id, paymentRecord.orderId)).limit(1);
          if (paidOrder) {
            void issueFirstPurchaseReward(paidOrder.id).catch((err) => req.log.error({ err }, 'failed to issue first purchase reward'));
            const { sendTelegramNotification } = await import('../services/telegram.js');
            void sendTelegramNotification('payment.paid', {
              title: '✅ پرداخت آنلاین موفق',
              fields: [
                { label: 'شماره سفارش', value: paidOrder.orderCode },
                { label: 'مشتری', value: paidOrder.customerName },
                { label: 'مبلغ', value: `${paymentRecord.amount.toLocaleString('fa-IR')} تومان` },
                { label: 'کد پیگیری', value: trackingCode },
              ],
            }).catch((err) => req.log.error({ err }, 'failed to send Telegram payment notification'));
            void import('../services/customer-messaging.js').then(({ sendCustomerNotification }) => sendCustomerNotification(
              paidOrder.userId,
              'payment.paid',
              '✅ پرداخت با موفقیت انجام شد',
              `پرداخت سفارش ${paidOrder.orderCode} به مبلغ ${paymentRecord.amount.toLocaleString('fa-IR')} تومان تأیید شد. کد پیگیری: ${trackingCode}`,
            )).catch((err) => req.log.error({ err }, 'failed to send customer Telegram payment notification'));
          }
        }
        if (isWalletTopup && paymentRecord.userId) {
          void import('../services/customer-messaging.js').then(({ sendCustomerNotification }) => sendCustomerNotification(
            paymentRecord.userId,
            'wallet.changed',
            '💳 کیف پول شارژ شد',
            `${paymentRecord.amount.toLocaleString('fa-IR')} تومان به کیف پول شما افزوده شد. موجودی جدید از بخش کیف پول قابل مشاهده است.`,
          )).catch((err) => req.log.error({ err }, 'failed to send customer Telegram wallet notification'));
        }

        return reply.redirect(`${resultPath}?status=success&orderId=${paymentRecord.orderId ?? ''}&trackingCode=${trackingCode}`);
      } else {
        await db.update(payments)
           .set({ status: 'failed', updatedAt: new Date() })
             .where(and(eq(payments.id, paymentRecord.id), ne(payments.status, 'success')));

        const { sendTelegramNotification } = await import('../services/telegram.js');
        void sendTelegramNotification('payment.failed', {
          title: '❌ پرداخت آنلاین ناموفق',
          fields: [
            { label: 'شناسه سفارش', value: paymentRecord.orderId },
            { label: 'مبلغ', value: `${paymentRecord.amount.toLocaleString('fa-IR')} تومان` },
            { label: 'خطا', value: verifyData?.code || 'verification_failed' },
          ],
        }).catch((notifyError) => req.log.error({ err: notifyError }, 'failed to send Telegram payment failure notification'));
        void import('../services/customer-messaging.js').then(({ sendCustomerNotification }) => sendCustomerNotification(
          paymentRecord.userId,
          'payment.failed',
          '❌ پرداخت ناموفق بود',
          `پرداخت ${paymentRecord.amount.toLocaleString('fa-IR')} تومان تأیید نشد. مبلغ کسرشده احتمالی طبق روال بانک بازگردانده می‌شود.`,
        )).catch((notifyError) => req.log.error({ err: notifyError }, 'failed to send customer Telegram payment failure notification'));
           
        return reply.redirect(`${resultPath}?status=failed&orderId=${paymentRecord.orderId ?? ''}&error=${verifyData?.code || 'verification_failed'}`);
      }
    } catch (err) {
      req.log.error({ err }, 'Payment verify failed');
      
      await db.update(payments)
         .set({ status: 'failed', updatedAt: new Date() })
         .where(and(eq(payments.id, paymentRecord.id), ne(payments.status, 'success')));

      const { sendTelegramNotification } = await import('../services/telegram.js');
      void sendTelegramNotification('payment.failed', {
        title: '❌ خطا در بررسی پرداخت',
        fields: [
          { label: 'شناسه سفارش', value: paymentRecord.orderId },
          { label: 'مبلغ', value: `${paymentRecord.amount.toLocaleString('fa-IR')} تومان` },
          { label: 'خطا', value: (err as Error).message },
        ],
      }).catch((notifyError) => req.log.error({ err: notifyError }, 'failed to send Telegram payment failure notification'));
      void import('../services/customer-messaging.js').then(({ sendCustomerNotification }) => sendCustomerNotification(
        paymentRecord.userId,
        'payment.failed',
        '❌ بررسی پرداخت ناموفق بود',
        `بررسی پرداخت ${paymentRecord.amount.toLocaleString('fa-IR')} تومان با خطا روبه‌رو شد. در صورت کسر وجه، مبلغ طبق روال بانک بازگردانده می‌شود.`,
      )).catch((notifyError) => req.log.error({ err: notifyError }, 'failed to send customer Telegram payment failure notification'));
         
      return reply.redirect(`${resultPath}?status=failed&orderId=${paymentRecord.orderId ?? ''}&error=server_error`);
    }
  });
};

export default routes;
