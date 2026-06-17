import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "echo_sms_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const SESSION_PAYLOAD = "echo-sms-admin-session-v1";

export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

function getAdminPassword(): string | null {
  const password = process.env.ADMIN_PASSWORD?.trim();
  return password ? password : null;
}

function signSession(password: string): string {
  return createHmac("sha256", password).update(SESSION_PAYLOAD).digest("hex");
}

export function createAdminSessionValue(): string | null {
  const password = getAdminPassword();
  if (!password) return null;
  return `v1.${signSession(password)}`;
}

export function isValidAdminSessionValue(value: string | undefined): boolean {
  const expected = createAdminSessionValue();
  if (!value || !expected) return false;

  const actualBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
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
