import { buildApp } from './app.js';
import { closeDb } from './db/client.js';
import { env } from './env.js';
import { startScheduler } from './scheduler.js';

const app = await buildApp();
const stopScheduler = startScheduler(app.log);

async function shutdown(signal: string): Promise<void> {
  app.log.info(`${signal} received, shutting down`);
  stopScheduler();
  try {
    await app.close();
    await closeDb();
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'shutdown failed');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error({ err }, 'failed to start');
  process.exit(1);
}
