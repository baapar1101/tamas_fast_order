import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
// @ts-ignore
import paymentGateway from '@tamas/payment';
import { db } from '../db/client.js';
import { payments } from '../db/schema.js';
import { badRequest } from '../lib/errors.js';
import { getAllSettings } from '../services/settings.js';
import { walletSnapshot } from '../services/wallet.js';

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireUser);

  app.get('/wallet', async (req) => {
    const q = z.object({ page: z.coerce.number().int().min(1).default(1), perPage: z.coerce.number().int().min(1).max(100).default(20) }).parse(req.query);
    const settings = await getAllSettings();
    const result = await walletSnapshot(req.currentUser!.id, q.perPage, (q.page - 1) * q.perPage);
    return {
      ok: true,
      wallet: result.wallet,
      transactions: result.entries,
      total: result.total,
      page: q.page,
      perPage: q.perPage,
      config: {
        enabled: settings.WALLET_ENABLED !== 'false',
        orderPaymentEnabled: settings.WALLET_ORDER_PAYMENT_ENABLED !== 'false',
        minTopup: Number(settings.WALLET_MIN_TOPUP || 50_000),
        maxTopup: Number(settings.WALLET_MAX_TOPUP || 100_000_000),
      },
    };
  });

  app.post('/wallet/topup', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req) => {
    const { amount } = z.object({ amount: z.coerce.number().int().positive() }).parse(req.body);
    const settings = await getAllSettings();
    const min = Number(settings.WALLET_MIN_TOPUP || 50_000);
    const max = Number(settings.WALLET_MAX_TOPUP || 100_000_000);
    if (settings.WALLET_ENABLED === 'false') throw badRequest('کیف پول موقتاً غیرفعال است.');
    if (amount < min || amount > max) throw badRequest(`مبلغ شارژ باید بین ${min.toLocaleString('fa-IR')} تا ${max.toLocaleString('fa-IR')} تومان باشد.`);

    try {
      const response = await paymentGateway.Create({
        amount,
        callback: `${req.headers.origin || 'https://tamasmarket.com'}/payment/result`,
        invoice_id: `wallet-${req.currentUser!.id}-${Date.now()}`,
        mobile: req.currentUser!.phone,
        description: 'شارژ کیف پول تماس مارکت',
      });
      if (response.data?.status !== 'success' || !response.data.transid) throw new Error(response.data?.code || 'gateway_error');
      const transid = response.data.transid;
      await db.insert(payments).values({
        userId: req.currentUser!.id,
        amount,
        gateway: 'aqayepardakht',
        refId: transid,
        status: 'pending',
        note: `wallet_topup:${req.currentUser!.id}`,
      });
      return { ok: true, url: paymentGateway.StartPay(transid) };
    } catch (err: any) {
      req.log.error({ err: err.response?.data || err.message }, 'wallet topup create failed');
      throw badRequest('اتصال به درگاه پرداخت انجام نشد. کمی بعد دوباره تلاش کنید.');
    }
  });
};

export default routes;
