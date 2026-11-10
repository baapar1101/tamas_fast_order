import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTelegramBotUsername } from './customer-telegram-model.js';

describe('normalizeTelegramBotUsername', () => {
  it('handles basic usernames', () => {
    assert.equal(normalizeTelegramBotUsername('my_bot_username'), 'my_bot_username');
    assert.equal(normalizeTelegramBotUsername('@my_bot_username'), 'my_bot_username');
    assert.equal(normalizeTelegramBotUsername('@@my_bot_username'), 'my_bot_username');
  });

  it('handles http/https URLs', () => {
    assert.equal(normalizeTelegramBotUsername('http://t.me/my_bot_username'), 'my_bot_username');
    assert.equal(normalizeTelegramBotUsername('https://t.me/my_bot_username'), 'my_bot_username');
    assert.equal(normalizeTelegramBotUsername('http://www.t.me/my_bot_username'), 'my_bot_username');
    assert.equal(normalizeTelegramBotUsername('https://www.t.me/my_bot_username'), 'my_bot_username');
  });

  it('handles URLs with query strings or paths', () => {
    assert.equal(normalizeTelegramBotUsername('https://t.me/my_bot_username?start=123'), 'my_bot_username');
    assert.equal(normalizeTelegramBotUsername('https://t.me/my_bot_username#hash'), 'my_bot_username');
    assert.equal(normalizeTelegramBotUsername('https://t.me/my_bot_username/'), 'my_bot_username');
    assert.equal(normalizeTelegramBotUsername('https://t.me/my_bot_username/?start=123'), 'my_bot_username');
  });

  it('returns empty string for undefined or empty input', () => {
    assert.equal(normalizeTelegramBotUsername(undefined), '');
    assert.equal(normalizeTelegramBotUsername(''), '');
    assert.equal(normalizeTelegramBotUsername('   '), '');
  });

  it('returns empty string for invalid usernames (too short, too long, invalid chars)', () => {
    assert.equal(normalizeTelegramBotUsername('a'), ''); // too short
    assert.equal(normalizeTelegramBotUsername('1234'), ''); // too short
    assert.equal(normalizeTelegramBotUsername('A'.repeat(65)), ''); // too long
    assert.equal(normalizeTelegramBotUsername('my-bot-username'), ''); // invalid characters (hyphen)
    assert.equal(normalizeTelegramBotUsername('my_bot_name!'), ''); // invalid character (!)
    assert.equal(normalizeTelegramBotUsername('@short'), 'short'); // 'short' is 5 chars, wait, it IS 5 chars, let me check. 'short' is 5, valid.
    assert.equal(normalizeTelegramBotUsername('@shor'), ''); // too short (4 chars)
  });

  it('handles usernames that are exactly 5 or 64 characters long', () => {
    assert.equal(normalizeTelegramBotUsername('abcde'), 'abcde');
    const longName = 'a'.repeat(64);
    assert.equal(normalizeTelegramBotUsername(longName), longName);
  });
});
