import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getTelegramConfig, telegramSecretMatches } from '../services/telegram.js';
import { handleTelegramUpdate, type TelegramUpdate } from '../services/telegram-operations.js';

const updateSchema = z.object({
  update_id: z.number().int().nonnegative(),
}).passthrough();

const routes: FastifyPluginAsync = async (app) => {
  app.post('/telegram/webhook', async (req, reply) => {
    const config = await getTelegramConfig();
    const header = req.headers['x-telegram-bot-api-secret-token'];
    const received = Array.isArray(header) ? header[0] : header;
    if (!telegramSecretMatches(config.webhookSecret, received)) {
      return reply.status(401).send({ ok: false, error: 'invalid telegram secret' });
    }

    const update = updateSchema.parse(req.body) as TelegramUpdate;
    // Acknowledge Telegram even if the downstream action fails. The handler
    // reports business errors back to the authorized operator in Telegram.
    void handleTelegramUpdate(update).catch((error) => req.log.error({ err: error }, 'telegram operation failed'));
    return { ok: true };
  });
};

export default routes;
