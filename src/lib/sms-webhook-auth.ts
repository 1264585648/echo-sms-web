import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';

export const SMS_WEBHOOK_SECRET_HEADER = 'x-echo-sms-webhook-secret';

export type SmsWebhookAuthResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: 401 | 503;
      error: string;
    };

function normalizeSecret(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function timingSafeSecretEqual(expectedSecret: string, actualSecret: string) {
  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');
  const actualBuffer = Buffer.from(actualSecret, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function validateSmsWebhookSecret(
  configuredSecret: string | undefined,
  providedSecret: string | null
): SmsWebhookAuthResult {
  const expectedSecret = normalizeSecret(configuredSecret);

  if (!expectedSecret) {
    return {
      ok: false,
      status: 503,
      error: 'SMS webhook secret is not configured',
    };
  }

  const actualSecret = normalizeSecret(providedSecret);

  if (!actualSecret || !timingSafeSecretEqual(expectedSecret, actualSecret)) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
    };
  }

  return { ok: true };
}
