import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeTelegramBotUsername,
  parseCustomerTelegramLinkToken,
  telegramContactBelongsToSender,
} from '../src/services/customer-telegram-model.js';

test('extracts only valid one-time link tokens from /start', () => {
  assert.equal(parseCustomerTelegramLinkToken('/start link_Abc_123456789-xyz'), 'Abc_123456789-xyz');
  assert.equal(parseCustomerTelegramLinkToken('/start@TamasBot link_Abc_123456789-xyz'), 'Abc_123456789-xyz');
  assert.equal(parseCustomerTelegramLinkToken('/start contact'), null);
  assert.equal(parseCustomerTelegramLinkToken('/start link_short'), null);
  assert.equal(parseCustomerTelegramLinkToken('/start link_bad token'), null);
});

test('accepts only a Telegram contact owned by the sender', () => {
  assert.equal(telegramContactBelongsToSender(42, 42), true);
  assert.equal(telegramContactBelongsToSender(7, 42), false);
  assert.equal(telegramContactBelongsToSender(undefined, 42), false);
});

test('normalizes a bot username without accepting URL fragments', () => {
  assert.equal(normalizeTelegramBotUsername(' @@Tamas_MarketBot '), 'Tamas_MarketBot');
  assert.equal(normalizeTelegramBotUsername('https://t.me/Tamas_MarketBot?start=abc'), 'Tamas_MarketBot');
  assert.equal(normalizeTelegramBotUsername('Tamas-Bot/?x=1'), '');
});
