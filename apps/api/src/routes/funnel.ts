import type { FastifyPluginAsync } from 'fastify';
import { funnelEventsSchema, savedCartSchema } from '@tamas/shared';
import { getSavedCart, recordFunnelEvents, saveUserCart } from '../services/funnel.js';

/** Storefront side of the sales funnel: behaviour events and the logged-in cart. */
const routes: FastifyPluginAsync = async (app) => {
  app.post(
    '/funnel/events',
    { config: { rateLimit: { max: 90, timeWindow: '1 minute' } } },
    async (req) => {
      const body = funnelEventsSchema.parse(req.body);
      const user = req.currentUser;
      // Staff browsing the shop would skew the customer funnel.
      if (user && user.role !== 'customer') return { ok: true, recorded: 0 };
      const recorded = await recordFunnelEvents(body.visitorId, user?.id ?? null, body.events);
      return { ok: true, recorded };
    },
  );

  app.get('/funnel/cart', { preHandler: [app.requireUser] }, async (req) => {
    return { ok: true, items: await getSavedCart(req.currentUser!.id) };
  });

  app.put(
    '/funnel/cart',
    { preHandler: [app.requireUser], config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req) => {
      const { items } = savedCartSchema.parse(req.body);
      await saveUserCart(req.currentUser!.id, items);
      return { ok: true };
    },
  );
};

export default routes;
