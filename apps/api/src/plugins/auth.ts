import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { forbidden, unauthorized } from '../lib/errors.js';
import { resolveSession, type UserRow } from '../services/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set for every request that carried a valid session token. */
    currentUser: UserRow | null;
    sessionToken: string | null;
  }
  interface FastifyInstance {
    requireUser: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function readToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  const cookie = (req.cookies as Record<string, string | undefined> | undefined)?.tamas_session;
  return cookie ?? null;
}

const plugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('currentUser', null);
  app.decorateRequest('sessionToken', null);

  // Resolved once per request so handlers and guards share the same lookup.
  app.addHook('onRequest', async (req) => {
    const token = readToken(req);
    req.sessionToken = token;
    req.currentUser = token ? await resolveSession(token) : null;
  });

  app.decorate('requireUser', async (req: FastifyRequest) => {
    if (!req.currentUser) throw unauthorized();
  });

  app.decorate('requireAdmin', async (req: FastifyRequest) => {
    if (!req.currentUser) throw unauthorized();
    if (req.currentUser.role !== 'admin') throw forbidden('این بخش فقط برای مدیران است.');
  });
};

export default fp(plugin, { name: 'auth' });
