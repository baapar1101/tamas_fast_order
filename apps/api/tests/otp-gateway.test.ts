import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withOtpGateway } from '../src/services/sms.js';
import type { SmsRuntimeConfig } from '../src/services/sms-config.js';

const base = { smsProvider: 'payamresan', firstFallback: 'melipayamak', secondFallback: 'smsir' } as SmsRuntimeConfig;

test('OTP_PROVIDER names the gateway login codes go through first', () => {
  assert.equal(withOtpGateway(base, 'rastin').smsProvider, 'rastin');
  assert.equal(withOtpGateway(base, 'rastin').firstFallback, 'melipayamak');
  assert.equal(withOtpGateway(base, 'melipayamak').smsProvider, 'melipayamak');
});

test('console and eldery keep the admin panel provider', () => {
  assert.equal(withOtpGateway(base, 'console').smsProvider, 'payamresan');
  assert.equal(withOtpGateway(base, 'eldery').smsProvider, 'payamresan');
});
