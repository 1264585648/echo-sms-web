import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authorizeCardSecretForOrder,
  readCardSecretCodeFromBody,
  readCardSecretCodeFromHeader,
} from './card-secret-auth.ts';

test('reads a trimmed card secret code from the request header', () => {
  const headers = new Headers({ 'x-card-secret-code': '  card-123  ' });

  assert.equal(readCardSecretCodeFromHeader(headers), 'card-123');
});

test('reads a trimmed card secret code from a JSON body object', () => {
  assert.equal(readCardSecretCodeFromBody({ cardSecretCode: '  card-123  ' }), 'card-123');
});

test('rejects a missing card secret without calling the lookup', async () => {
  let lookupCalled = false;

  const result = await authorizeCardSecretForOrder({
    code: '',
    orderCardSecretId: 'secret-owner',
    findCardSecretByCode: async () => {
      lookupCalled = true;
      return { id: 'secret-owner' };
    },
  });

  assert.equal(lookupCalled, false);
  assert.deepEqual(result, {
    ok: false,
    status: 401,
    error: 'Card secret code is required',
  });
});

test('rejects a card secret that does not own the order', async () => {
  const result = await authorizeCardSecretForOrder({
    code: 'other-secret',
    orderCardSecretId: 'secret-owner',
    findCardSecretByCode: async () => ({ id: 'secret-other' }),
  });

  assert.deepEqual(result, {
    ok: false,
    status: 403,
    error: 'Forbidden',
  });
});

test('authorizes a card secret that owns the order', async () => {
  const result = await authorizeCardSecretForOrder({
    code: '  owner-secret  ',
    orderCardSecretId: 'secret-owner',
    findCardSecretByCode: async (code) => {
      assert.equal(code, 'owner-secret');
      return { id: 'secret-owner' };
    },
  });

  assert.deepEqual(result, {
    ok: true,
    code: 'owner-secret',
    cardSecretId: 'secret-owner',
  });
});
