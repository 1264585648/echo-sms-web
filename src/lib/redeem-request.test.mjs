import assert from 'node:assert/strict';
import test from 'node:test';

import { readRedeemRequestBody } from './redeem-request.ts';

test('returns a stable invalid result for malformed JSON', async () => {
  const req = new Request('https://example.test/api/card-secret/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not-json',
  });

  assert.deepEqual(await readRedeemRequestBody(req), {
    ok: false,
    error: 'Invalid JSON body.',
  });
});

test('rejects null or non-object redeem request bodies', async () => {
  const req = new Request('https://example.test/api/card-secret/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'null',
  });

  assert.deepEqual(await readRedeemRequestBody(req), {
    ok: false,
    error: 'Card secret code, target service, and countryId are required',
  });
});

test('requires non-empty string redeem fields and trims accepted values', async () => {
  const invalidReq = new Request('https://example.test/api/card-secret/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: ' card-123 ', targetService: '', countryId: 0 }),
  });
  assert.deepEqual(await readRedeemRequestBody(invalidReq), {
    ok: false,
    error: 'Card secret code, target service, and countryId are required',
  });

  const validReq = new Request('https://example.test/api/card-secret/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: ' card-123 ', targetService: ' tg ', countryId: ' 0 ' }),
  });
  assert.deepEqual(await readRedeemRequestBody(validReq), {
    ok: true,
    body: {
      code: 'card-123',
      targetService: 'tg',
      countryId: '0',
    },
  });
});
