import assert from 'node:assert/strict';
import test from 'node:test';
import { funnelEventsSchema, parseFunnelAutomation, savedCartSchema } from '@tamas/shared';
import { followUpMessage, isSendingHour, tehranHour } from '../src/services/funnel.js';

test('follow-ups only go out between 09:00 and 21:00 Tehran time', () => {
  // Tehran is UTC+03:30 all year.
  assert.equal(tehranHour(new Date('2026-11-10T05:30:00Z')), 9);
  assert.equal(isSendingHour(new Date('2026-11-10T05:29:00Z')), false);
  assert.equal(isSendingHour(new Date('2026-11-10T05:30:00Z')), true);
  assert.equal(isSendingHour(new Date('2026-11-10T17:29:00Z')), true);
  assert.equal(isSendingHour(new Date('2026-11-10T17:30:00Z')), false);
  assert.equal(isSendingHour(new Date('2026-11-10T22:00:00Z')), false);
});

test('each follow-up links to the right place and fills its SMS template', () => {
  const cart = followUpMessage('cart_reminder_1', { name: 'رضا', items: 3, total: 1_250_000 }, 'https://shop.test/');
  assert.equal(cart.event, 'cart.reminder');
  assert.match(cart.text, /https:\/\/shop\.test\/checkout/);
  assert.match(cart.text, /۳ کالا/);
  assert.equal(cart.smsVariables.link, 'https://shop.test/checkout');
  assert.match(cart.smsDefault, /\{items\}/);

  const unpaid = followUpMessage('unpaid_order', { name: '', orderCode: 'TM-1001', total: 500_000 }, 'https://shop.test');
  assert.equal(unpaid.event, 'order.payment_reminder');
  assert.match(unpaid.text, /^همکار گرامی/);
  assert.match(unpaid.text, /TM-1001/);
  assert.match(unpaid.text, /https:\/\/shop\.test\/account/);

  const nudge = followUpMessage('browse_nudge', { name: 'سارا' }, 'https://shop.test');
  assert.equal(nudge.event, 'promotion');
  assert.equal(nudge.smsVariables.link, 'https://shop.test');
});

test('automation settings default to on and survive bad JSON', () => {
  assert.deepEqual(parseFunnelAutomation(null), { abandonedCart: true, unpaidOrder: true, browseNudge: true, smsFallback: true });
  assert.deepEqual(parseFunnelAutomation('{"browseNudge":false}'), { abandonedCart: true, unpaidOrder: true, browseNudge: false, smsFallback: true });
  assert.deepEqual(parseFunnelAutomation('not json'), { abandonedCart: true, unpaidOrder: true, browseNudge: true, smsFallback: true });
});

test('event and cart payloads are validated', () => {
  assert.equal(funnelEventsSchema.safeParse({ visitorId: 'abc', events: [{ type: 'visit' }] }).success, false);
  assert.equal(funnelEventsSchema.safeParse({ visitorId: 'a1b2c3d4-e5f6', events: [{ type: 'purchase' }] }).success, false);
  assert.equal(funnelEventsSchema.safeParse({ visitorId: 'a1b2c3d4-e5f6', events: [{ type: 'add_to_cart', productId: 'P-1' }] }).success, true);
  assert.equal(savedCartSchema.safeParse({ items: [{
    key: 'P-1::site', productId: 'P-1', title: 'قاب', color: null, colorCode: null, imageUrl: null,
    price: 1000, qty: 0, warehouse: 'site', maxStock: 5,
  }] }).success, false);
});
