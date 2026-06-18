import assert from 'node:assert/strict';
import test from 'node:test';

import { checkRateLimit, getClientIp } from './rate-limit.ts';

test('allows max attempts within a window and limits the next one', () => {
  const store = new Map();

  const first = checkRateLimit({
    key: 'login:203.0.113.10',
    max: 2,
    windowMs: 60_000,
    now: 1_000,
    store,
  });
  const second = checkRateLimit({
    key: 'login:203.0.113.10',
    max: 2,
    windowMs: 60_000,
    now: 2_000,
    store,
  });
  const third = checkRateLimit({
    key: 'login:203.0.113.10',
    max: 2,
    windowMs: 60_000,
    now: 3_000,
    store,
  });

  assert.equal(first.limited, false);
  assert.equal(first.remaining, 1);
  assert.equal(second.limited, false);
  assert.equal(second.remaining, 0);
  assert.equal(third.limited, true);
  assert.equal(third.remaining, 0);
  assert.equal(third.retryAfterSeconds, 58);
});

test('resets attempts after the window expires', () => {
  const store = new Map();

  assert.equal(
    checkRateLimit({ key: 'redeem:ip:198.51.100.4', max: 1, windowMs: 1_000, now: 1_000, store }).limited,
    false,
  );
  assert.equal(
    checkRateLimit({ key: 'redeem:ip:198.51.100.4', max: 1, windowMs: 1_000, now: 1_500, store }).limited,
    true,
  );

  const afterReset = checkRateLimit({
    key: 'redeem:ip:198.51.100.4',
    max: 1,
    windowMs: 1_000,
    now: 2_001,
    store,
  });

  assert.equal(afterReset.limited, false);
  assert.equal(afterReset.remaining, 0);
  assert.equal(afterReset.retryAfterSeconds, 1);
});

test('uses the first forwarded IP before falling back', () => {
  assert.equal(
    getClientIp(new Headers({ 'x-forwarded-for': ' 203.0.113.7, 10.0.0.1 ' })),
    '203.0.113.7',
  );
  assert.equal(getClientIp(new Headers({ 'x-real-ip': '198.51.100.9' })), '198.51.100.9');
  assert.equal(getClientIp(new Headers()), 'unknown');
});

test('removes expired buckets while checking a different key', () => {
  const store = new Map([
    ['expired-a', { count: 1, resetAt: 900 }],
    ['expired-b', { count: 1, resetAt: 999 }],
    ['active', { count: 1, resetAt: 2_000 }],
  ]);

  checkRateLimit({
    key: 'new-key',
    max: 2,
    windowMs: 1_000,
    now: 1_000,
    store,
  });

  assert.equal(store.has('expired-a'), false);
  assert.equal(store.has('expired-b'), false);
  assert.equal(store.has('active'), true);
  assert.equal(store.has('new-key'), true);
  assert.equal(store.size, 2);
});

test('caps the store by evicting the oldest buckets', () => {
  const store = new Map([
    ['oldest', { count: 1, resetAt: 10_000 }],
    ['middle', { count: 1, resetAt: 10_000 }],
  ]);

  checkRateLimit({
    key: 'newest',
    max: 2,
    windowMs: 1_000,
    now: 1_000,
    store,
    maxEntries: 2,
  });

  assert.equal(store.has('oldest'), false);
  assert.equal(store.has('middle'), true);
  assert.equal(store.has('newest'), true);
  assert.equal(store.size, 2);
});
