import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminCredentialsMatch, adminLoginEnabled } from '../src/lib/admin-login.ts';

const config = { username: 'Owner', password: 'a-long-enough-pass' };

test('admin env login is off unless both values are set and the password is long', () => {
  assert.equal(adminLoginEnabled({ username: '', password: 'a-long-enough-pass' }), false);
  assert.equal(adminLoginEnabled({ username: 'owner', password: 'short' }), false);
  assert.equal(adminLoginEnabled(config), true);
});

test('admin env login accepts only the exact password; username ignores case and spaces', () => {
  assert.equal(adminCredentialsMatch(config, ' owner ', 'a-long-enough-pass'), true);
  assert.equal(adminCredentialsMatch(config, 'owner', 'a-long-enough-pasS'), false);
  assert.equal(adminCredentialsMatch(config, 'someone', 'a-long-enough-pass'), false);
  assert.equal(adminCredentialsMatch({ username: 'owner', password: 'short' }, 'owner', 'short'), false);
});
