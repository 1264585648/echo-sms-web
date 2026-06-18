import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSmsWebhookSecret } from './sms-webhook-auth.ts';

test('returns 503 when the SMS webhook secret is not configured', () => {
  assert.deepEqual(validateSmsWebhookSecret(undefined, 'provided-secret'), {
    ok: false,
    status: 503,
    error: 'SMS webhook secret is not configured',
  });
});

test('returns 401 when the SMS webhook secret header is missing', () => {
  assert.deepEqual(validateSmsWebhookSecret('expected-secret', null), {
    ok: false,
    status: 401,
    error: 'Unauthorized',
  });
});

test('returns 401 when the SMS webhook secret header is wrong', () => {
  assert.deepEqual(validateSmsWebhookSecret('expected-secret', 'wrong-secret'), {
    ok: false,
    status: 401,
    error: 'Unauthorized',
  });
});

test('returns 401 when the SMS webhook secret header has the same length but differs', () => {
  assert.deepEqual(validateSmsWebhookSecret('expected-secret', 'expected-secreu'), {
    ok: false,
    status: 401,
    error: 'Unauthorized',
  });
});

test('authorizes matching SMS webhook secrets', () => {
  assert.deepEqual(validateSmsWebhookSecret('  expected-secret  ', ' expected-secret '), {
    ok: true,
  });
});
