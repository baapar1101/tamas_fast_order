import assert from 'node:assert/strict';
import test from 'node:test';
import { publicSettings } from '../src/lib/public-settings.js';

test('bootstrap only exposes reviewed storefront settings, including for legacy secret names', () => {
  const source = {
    store_name: 'تماس مارکت', payment_methods: '[]', storefront_filters: '[]',
    CRM_API_KEY: 'secret', CRM_WEBHOOK_SECRET: 'secret',
    private_TELEGRAM_BOT_TOKEN: 'secret', TELEGRAM_GROUPS: 'internal',
    sms_config_melipayamak_username: 'internal', FUTURE_INTEGRATION_CONFIG: 'secret',
  };
  assert.deepEqual(publicSettings(source), {
    store_name: 'تماس مارکت', payment_methods: '[]', storefront_filters: '[]',
  });
  assert.equal(Object.keys(source).length, 9);
});
