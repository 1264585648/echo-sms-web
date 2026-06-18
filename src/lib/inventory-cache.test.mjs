import assert from 'node:assert/strict';
import test from 'node:test';

import { createInventoryCache, isValidInventoryCountryId } from './inventory-cache.ts';

test('validates inventory country IDs as short simple tokens', () => {
  assert.equal(isValidInventoryCountryId('0'), true);
  assert.equal(isValidInventoryCountryId('us-1'), true);
  assert.equal(isValidInventoryCountryId('cn_mainland'), true);
  assert.equal(isValidInventoryCountryId(''), false);
  assert.equal(isValidInventoryCountryId('../secret'), false);
  assert.equal(isValidInventoryCountryId('a'.repeat(33)), false);
});

test('inventory cache removes expired entries opportunistically', () => {
  const cache = createInventoryCache({ maxEntries: 10 });

  cache.set('expired', { success: true, inventory: [] }, 1_000, 1_000);
  cache.set('active', { success: true, inventory: [{ id: 'tg' }] }, 5_000, 1_000);

  assert.deepEqual(cache.get('expired', 2_001), null);
  assert.deepEqual(cache.get('active', 2_001), { success: true, inventory: [{ id: 'tg' }] });
  assert.equal(cache.size(), 1);
});

test('inventory cache caps entries by evicting oldest keys', () => {
  const cache = createInventoryCache({ maxEntries: 2 });

  cache.set('oldest', { success: true, inventory: [] }, 10_000, 1_000);
  cache.set('middle', { success: true, inventory: [] }, 10_000, 1_001);
  cache.set('newest', { success: true, inventory: [] }, 10_000, 1_002);

  assert.deepEqual(cache.get('oldest', 1_003), null);
  assert.notEqual(cache.get('middle', 1_003), null);
  assert.notEqual(cache.get('newest', 1_003), null);
  assert.equal(cache.size(), 2);
});
