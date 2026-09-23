import { mkdir } from 'node:fs/promises';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { corsOrigins, env, isProd } from './env.js';
import { AppError } from './lib/errors.js';
import authPlugin from './plugins/auth.js';
import { storage } from './services/storage/index.js';

import adminDashboard from './routes/admin/dashboard.js';
import adminOrders from './routes/admin/orders.js';
import adminProducts from './routes/admin/products.js';
import adminSync from './routes/admin/sync.js';
import adminTaxonomy from './routes/admin/taxonomy.js';
import adminUploads from './routes/admin/uploads.js';
import adminUsers from './routes/admin/users.js';
import adminSlides from './routes/admin/slides.js';
import adminWarehouses from './routes/admin/warehouses.js';
import adminAttributes from './routes/admin/attributes.js';
import adminFinancial from './routes/admin/financial.js';
import adminComments from './routes/admin/comments.js';
import { accessGroupsRoutes } from './routes/admin/access-groups.js';
import { smsRoutes } from './routes/admin/sms.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payment.js';
import crmRoutes from './routes/crm.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isProd
      ? { level: env.LOG_LEVEL }
      : { level: env.LOG_LEVEL, transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } },
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(helmet, {
    // Uploaded images are served from this origin and embedded by the SPA on
    // another one, so the cross-origin resource policy has to allow it.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(cookie);

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // Behind a proxy the client IP arrives in a header; `trustProxy` decides
    // whether Fastify believes it.
    keyGenerator: (req) => req.ip,
  });

  await app.register(multipart, {
    limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 20 },
  });

  await app.register(authPlugin);

  // Serve uploads directly when the local driver is in use; behind nginx you
  // would normally let it serve this path instead.
  const root = storage.localRoot();
  if (root) {
    await mkdir(root, { recursive: true });
    await app.register(fastifyStatic, {
      root,
      prefix: `${env.STORAGE_PUBLIC_URL.replace(/\/$/, '')}/`,
      decorateReply: false,
      maxAge: '30d',
      immutable: true,
    });
  }

  app.get('/health', async () => ({ ok: true, uptime: process.uptime(), env: env.NODE_ENV }));


  /** One shape for every failure, so the client only ever parses `{ ok, error }`. */
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return reply.status(400).send({
        ok: false,
        code: 'validation_error',
        error: first?.message ?? 'ورودی نامعتبر است.',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ ok: false, code: err.code, error: err.message, ...err.extra });
    }

    if ((err as { statusCode?: number }).statusCode === 429) {
      return reply
        .status(429)
        .send({ ok: false, code: 'too_many_requests', error: 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد تلاش کنید.' });
    }

    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send({
      ok: false,
      code: 'internal_error',
      error: isProd ? 'خطای غیرمنتظره‌ای رخ داد. کمی بعد تلاش کنید.' : String((err as Error).message ?? err),
    });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ ok: false, code: 'not_found', error: 'این آدرس وجود ندارد.' });
  });

  /*
   * Order matters: `await app.register()` boots the plugin subtree straight
   * away, so the error and not-found handlers have to exist on the root
   * before the /api routes are registered or they never reach them.
   */
  await app.register(
      async (api) => {
        await api.register(catalogRoutes);
        await api.register(authRoutes);
        await api.register(orderRoutes);
        await api.register(paymentRoutes);
        await api.register(adminDashboard);
        await api.register(adminProducts);
        await api.register(adminTaxonomy);
        await api.register(adminOrders);
        await api.register(adminUsers);
        await api.register(adminUploads);
        await api.register(adminSync);
        await api.register(adminSlides);
        await api.register(adminWarehouses);
        await api.register(adminAttributes);
        await api.register(adminFinancial);
        await api.register(adminComments);
        await api.register(accessGroupsRoutes);
        await api.register(smsRoutes);
        await api.register(crmRoutes); // <-- CRM integration routes
      },
      { prefix: '/api' },
    );

  return app;
}
