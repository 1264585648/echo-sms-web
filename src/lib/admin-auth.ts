import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "echo_sms_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const SESSION_PAYLOAD_PREFIX = "echo-sms-admin-session-v2";

export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

function getAdminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD?.trim();
  return password ? password : null;
}

function getAdminSessionSigningSecret(): string | null {
  const sessionSecret = process.env.ADMIN_SESSION_SECRET?.trim();
  return sessionSecret ? sessionSecret : getAdminPassword();
}

function signSession(sessionSigningSecret: string, expiresAt: number): string {
  const payload = `${SESSION_PAYLOAD_PREFIX}|${expiresAt}`;
  return createHmac("sha256", sessionSigningSecret).update(payload).digest("hex");
}

export function createAdminSessionValue(): string | null {
  const sessionSigningSecret = getAdminSessionSigningSecret();
  if (!sessionSigningSecret) return null;

  const expiresAt = Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
  return `v2.${expiresAt}.${signSession(sessionSigningSecret, expiresAt)}`;
}

export function isValidAdminSessionValue(value: string | undefined): boolean {
  if (!value || !value.startsWith("v2.")) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;

  const [, expiresAtStr] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);

  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

  const sessionSigningSecret = getAdminSessionSigningSecret();
  if (!sessionSigningSecret) return false;

  const expectedSignature = signSession(sessionSigningSecret, expiresAt);
  const expectedToken = `v2.${expiresAt}.${expectedSignature}`;

  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expectedToken);
  if (actualBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function isAdminRequest(req: NextRequest): boolean {
  return isValidAdminSessionValue(req.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

export function isValidAdminPassword(password: unknown): boolean {
  const expected = getAdminPassword();
  if (typeof password !== "string" || !expected) return false;

  const actualBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  };
}
