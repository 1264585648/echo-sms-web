import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAdminSessionValue,
  isValidAdminPassword,
  isValidAdminSessionValue,
} from './admin-auth.ts';

const ORIGINAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ORIGINAL_ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;

function setEnvValue(key, value) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

function withAdminEnv(env, callback) {
  setEnvValue('ADMIN_PASSWORD', env.ADMIN_PASSWORD);
  setEnvValue('ADMIN_SESSION_SECRET', env.ADMIN_SESSION_SECRET);

  try {
    callback();
  } finally {
    setEnvValue('ADMIN_PASSWORD', ORIGINAL_ADMIN_PASSWORD);
    setEnvValue('ADMIN_SESSION_SECRET', ORIGINAL_ADMIN_SESSION_SECRET);
  }
}

test('validates the admin login password with ADMIN_PASSWORD', () => {
  withAdminEnv(
    {
      ADMIN_PASSWORD: 'login-password',
      ADMIN_SESSION_SECRET: 'session-signing-secret',
    },
    () => {
      assert.equal(isValidAdminPassword('login-password'), true);
      assert.equal(isValidAdminPassword('session-signing-secret'), false);
    },
  );
});

test('signs admin sessions with ADMIN_SESSION_SECRET before ADMIN_PASSWORD', () => {
  withAdminEnv(
    {
      ADMIN_PASSWORD: 'initial-login-password',
      ADMIN_SESSION_SECRET: 'stable-session-secret',
    },
    () => {
      const sessionValue = createAdminSessionValue();
      assert.equal(typeof sessionValue, 'string');
      assert.equal(isValidAdminSessionValue(sessionValue), true);

      process.env.ADMIN_PASSWORD = 'rotated-login-password';
      assert.equal(isValidAdminSessionValue(sessionValue), true);

      process.env.ADMIN_SESSION_SECRET = 'rotated-session-secret';
      assert.equal(isValidAdminSessionValue(sessionValue), false);
    },
  );
});

test('falls back to ADMIN_PASSWORD when ADMIN_SESSION_SECRET is not configured', () => {
  withAdminEnv(
    {
      ADMIN_PASSWORD: 'fallback-login-password',
      ADMIN_SESSION_SECRET: undefined,
    },
    () => {
      const sessionValue = createAdminSessionValue();
      assert.equal(typeof sessionValue, 'string');
      assert.equal(isValidAdminSessionValue(sessionValue), true);

      process.env.ADMIN_PASSWORD = 'rotated-fallback-password';
      assert.equal(isValidAdminSessionValue(sessionValue), false);
    },
  );
});
