import type { FastifyPluginAsync } from 'fastify';
import { orderCreateSchema } from '@tamas/shared';
import { createOrder, listOrdersForUser } from '../services/orders.js';

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
};

export default routes;
