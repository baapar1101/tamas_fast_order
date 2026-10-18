# Fastify Webhooks — Raw Body, HMAC, and Idempotency

Recipe for secure webhook processing in Fastify with HMAC signature verification and event deduplication.

## 1. Raw Body Parser

Fastify parses JSON by default, replacing the raw body. To verify HMAC you must keep the original bytes. Register a content type parser BEFORE route registration:

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const routes = async (app: FastifyInstance) => {
  // Register raw body parser for the webhook content type
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req: FastifyRequest, body: Buffer, done) => {
      try {
        const rawBody = Buffer.isBuffer(body) ? body : Buffer.from(body);
        (req as any).rawBody = rawBody;
        const parsed = JSON.parse(rawBody.toString());
        done(null, parsed);
      } catch (err) {
        done(err as Error);
      }
    }
  );

  // Now register the route — req.rawBody is available
  app.post('/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = (req as any).rawBody as Buffer;

    // Verify signature before processing
    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    // Process body safely
    const body = req.body as Record<string, any>;
    return processEvent(body);
  });
};

export default routes;
```

**Key points:**
- Use `parseAs: 'buffer'` to get a raw Buffer
- Cast `req` to access `rawBody` (not typed by default)
- Parse JSON only after signature verification succeeds
- Register parser before adding routes that need it

## 2. HMAC-SHA256 Signature Verification

```typescript
import crypto from 'crypto';

function verifySignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')}`;
  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expected),
  );
}
```

**Key points:**
- Use `crypto.timingSafeEqual` — never `===` for signature comparison (timing attack risk)
- Signature format is typically `sha256=<hex>` — strip prefix before comparison
- Read the secret from `process.env`, never hardcode

## 3. Event Deduplication

```typescript
class EventDeduplicator {
  private seen = new Set<string>();
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  isDuplicate(eventId: string): boolean {
    if (this.seen.has(eventId)) return true;

    // Prevent unbounded memory growth
    if (this.seen.size >= this.maxSize) {
      // Remove oldest half of entries
      const entries = Array.from(this.seen);
      const toRemove = entries.slice(0, Math.floor(entries.length / 2));
      for (const key of toRemove) this.seen.delete(key);
    }

    this.seen.add(eventId);
    return false;
  }

  reset(): void {
    this.seen.clear();
  }
}

// Usage in webhook handler:
const dedup = new EventDeduplicator(500);

app.post('/webhook', async (req, reply) => {
  const eventId = (req.body as Record<string, any>)?.eventId;
  if (!eventId) return reply.status(400).send({ error: 'Missing eventId' });
  if (dedup.isDuplicate(eventId)) {
    return reply.status(200).send({ status: 'duplicate', processed: false });
  }
  // Process event...
});
```

**Key points:**
- Cap the Set to prevent unbounded memory growth (500 entries recommended)
- When capped, remove oldest entries (not newest)
- Duplicate events get HTTP 200 — callers should not retry on 200
- In-memory dedup resets on server restart; use a DB flag for cross-instance dedup in production

## 4. Complete Webhook Route Pattern

```typescript
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';

const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      const raw = Buffer.isBuffer(body) ? body : Buffer.from(body);
      (req as any).rawBody = raw;
      try {
        done(null, JSON.parse(raw.toString()));
      } catch (err) {
        done(err as Error);
      }
    },
  );

  app.post('/crm/webhook', async (req, reply) => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = (req as any).rawBody as Buffer;

    // 1. Verify signature
    if (!verifySignature(rawBody, signature, process.env.CRM_WEBHOOK_SECRET ?? '')) {
      await logger.warn('Invalid webhook signature');
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    // 2. Parse and validate
    const event = req.body as { eventType: string; eventId: string; payload: Record<string, any> };
    if (!event.eventId || !event.eventType) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    // 3. Deduplicate
    if (dedup.isDuplicate(event.eventId)) {
      return reply.status(200).send({ status: 'duplicate' });
    }

    // 4. Process
    try {
      await processWebhookEvent(event);
      return reply.status(200).send({ status: 'ok' });
    } catch (err) {
      await logger.error(err);
      return reply.status(500).send({ error: 'Processing failed' });
    }
  });
};

export default webhookRoutes;
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using `req.body` (already parsed JSON) for HMAC | Use `req.rawBody` from the buffer parser |
| Comparing signatures with `===` | Use `crypto.timingSafeEqual` |
| No deduplication — events processed multiple times | Add `EventDeduplicator` with capped Set |
| Dedup Set grows unbounded | Cap at 500, remove oldest when full |
| Processing webhook before verifying signature | Always verify first, reject with 401 |
| Throwing on CRM sync failure inside webhook | Log and return 200; process failures asynchronously |