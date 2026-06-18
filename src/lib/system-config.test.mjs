import assert from 'node:assert/strict';
import test from 'node:test';

import { readSystemConfigMap } from './system-config.ts';

test('reads only requested system config keys into a map', async () => {
  const calls = [];
  const systemConfig = {
    async findMany(args) {
      calls.push(args);
      return [
        { key: 'HERO_API_KEY', value: 'secret' },
        { key: 'SERVICES', value: '[]' },
      ];
    },
  };

  const config = await readSystemConfigMap(systemConfig, [
    'HERO_API_KEY',
    'SERVICES',
    'HERO_API_KEY',
  ]);

  assert.deepEqual(config, {
    HERO_API_KEY: 'secret',
    SERVICES: '[]',
  });
  assert.deepEqual(calls, [
    { where: { key: { in: ['HERO_API_KEY', 'SERVICES'] } } },
  ]);
});

test('can still read all system config when keys are omitted', async () => {
  const calls = [];
  const systemConfig = {
    async findMany(args) {
      calls.push(args);
      return [{ key: 'COUNTRIES', value: '[]' }];
    },
  };

  const config = await readSystemConfigMap(systemConfig);

  assert.deepEqual(config, { COUNTRIES: '[]' });
  assert.deepEqual(calls, [undefined]);
});
