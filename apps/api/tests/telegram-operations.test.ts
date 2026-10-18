import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL ||= 'postgres://test:test@127.0.0.1:5432/test';
process.env.APP_SECRET ||= 'telegram-test-secret-value';

const { parseTelegramAction } = await import('../src/services/telegram-operations.js');
const { parseTelegramUserIds, telegramSecretMatches } = await import('../src/services/telegram.js');

test('Telegram operator IDs accept common separators and reject unsafe values', () => {
  assert.deepEqual(parseTelegramUserIds('123456, ۹۹۹; abc\n123456 987654'), ['123456', '987654']);
});

test('Telegram callback parser accepts only versioned allowlisted operations', () => {
  assert.deepEqual(parseTelegramAction('tm1|ask|user|activate|42'), {
    stage: 'ask', entity: 'user', operation: 'activate', id: 42,
  });
  assert.deepEqual(parseTelegramAction('tm1|do|order|status|18|shipped'), {
    stage: 'do', entity: 'order', operation: 'status', id: 18, value: 'shipped',
  });
  assert.equal(parseTelegramAction('tm1|do|order|status|18|deleted'), null);
  assert.equal(parseTelegramAction('other|do|user|activate|42'), null);
});

test('Telegram webhook secret comparison fails closed', () => {
  assert.equal(telegramSecretMatches('abc123', 'abc123'), true);
  assert.equal(telegramSecretMatches('abc123', 'abc124'), false);
  assert.equal(telegramSecretMatches('', ''), false);
  assert.equal(telegramSecretMatches('abc123', undefined), false);
});
