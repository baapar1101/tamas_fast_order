import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { forbidden, unauthorized } from '../lib/errors.js';
import { resolveSession, type UserSession } from '../services/auth.js';
import { corsOrigins, env, isProd } from '../env.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set for every request that carried a valid session token. */
    currentUser: UserSession | null;
    sessionToken: string | null;
  }
  interface FastifyInstance {
    requireUser: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (permission: string) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function readToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  const cookie = (req.cookies as Record<string, string | undefined> | undefined)?.tamas_session;
  return cookie ?? null;
}

export function setBrowserSession(reply: FastifyReply, token: string): void {
  reply.header('Cache-Control', 'private, no-store');
  reply.setCookie('tamas_session', token, {
    path: '/', httpOnly: true, secure: isProd, sameSite: 'lax',
    maxAge: env.SESSION_TTL_DAYS * 86400,
  });
}

export function createAuthPlugin(resolver = resolveSession): FastifyPluginAsync {
 return async (app) => {
  app.decorateRequest('currentUser', null);
  app.decorateRequest('sessionToken', null);

  // Resolved once per request so handlers and guards share the same lookup.
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/api/auth/')) reply.header('Cache-Control', 'private, no-store');
    const token = readToken(req);
    const bearer = req.headers.authorization?.startsWith('Bearer ');
    if (token && !bearer && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      const sameOrigin = origin === new URL(env.PUBLIC_SITE_URL).origin || (!isProd && typeof origin === 'string' && corsOrigins.includes(origin));
      if (!sameOrigin) throw forbidden('مبدأ درخواست معتبر نیست.');
    }
    req.sessionToken = token;
    req.currentUser = token ? await resolver(token) : null;
    // Existing Bearer-only sessions need a secure browser transport for <img>
    // and PDF links. Reuse the same revocable token, never put it in a URL.
    if (req.url.split('?')[0] === '/api/auth/me' && bearer && req.currentUser && req.cookies.tamas_session !== token) {
      setBrowserSession(reply, token!);
    }
  });

  app.decorate('requireUser', async (req: FastifyRequest) => {
    if (!req.currentUser) throw unauthorized();
  });

  app.decorate('requireAdmin', async (req: FastifyRequest) => {
    if (!req.currentUser) throw unauthorized();
    if (!req.currentUser.isActive) throw forbidden('حساب شما غیرفعال است.');
    if (req.currentUser.role !== 'admin' && req.currentUser.role !== 'operator') throw forbidden('این بخش فقط برای مدیران است.');
  });

  app.decorate('requirePermission', (permission: string) => async (req: FastifyRequest) => {
    if (!req.currentUser) throw unauthorized();
    if (!req.currentUser.isActive) throw forbidden('حساب شما غیرفعال است.');
    if (req.currentUser.role === 'admin') return; // Admin has all permissions
    if (req.currentUser.role !== 'operator') throw forbidden('دسترسی غیرمجاز.');
    
    const perms = req.currentUser.permissions || [];
    if (!perms.includes(permission) && !perms.includes('*')) {
      throw forbidden('شما به این بخش دسترسی ندارید.');
    }
  });
 };
}

export default fp(createAuthPlugin(), { name: 'auth' });
