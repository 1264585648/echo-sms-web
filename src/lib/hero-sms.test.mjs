import assert from 'node:assert/strict';
import test from 'node:test';

import { HeroSMSClient, HeroSMSRequestTimeoutError } from './hero-sms.ts';

test('keeps fake API key responses local and fast', async () => {
  const client = new HeroSMSClient('test_fake_api_key', {
    fetch: async () => {
      throw new Error('fetch should not be called for fake API key responses');
    },
    timeoutMs: 1,
  });

  const prices = await client.getPrices('tg', '0');

  assert.equal(prices['0'].tg.cost, '15.00');
});

test('aborts upstream fetch after the configured timeout', { timeout: 500 }, async () => {
  const client = new HeroSMSClient('real_api_key', {
    timeoutMs: 20,
    fetch: async (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('The operation was aborted.', 'AbortError')),
          { once: true },
        );
      }),
  });

  await assert.rejects(
    () => client.getBalance(),
    (error) =>
      error instanceof HeroSMSRequestTimeoutError &&
      error.message === 'HeroSMS request timed out after 20ms',
  );
});

test('preserves upstream AbortError when the local timeout did not fire', async () => {
  const upstreamAbort = new DOMException('Upstream aborted before sending headers.', 'AbortError');
  const client = new HeroSMSClient('real_api_key', {
    timeoutMs: 1_000,
    fetch: async () => {
      throw upstreamAbort;
    },
  });

  await assert.rejects(() => client.getBalance(), upstreamAbort);
});
