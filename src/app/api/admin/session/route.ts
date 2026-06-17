import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionValue,
  getAdminCookieOptions,
  isAdminPasswordConfigured,
  isAdminRequest,
  isValidAdminPassword,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

type LoginRequestBody = {
  password?: unknown;
};

export async function GET(req: NextRequest) {
  return NextResponse.json({
    success: true,
    configured: isAdminPasswordConfigured(),
    authenticated: isAdminRequest(req),
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminPasswordConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: "ADMIN_PASSWORD is not configured.",
        code: "ADMIN_PASSWORD_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  let body: LoginRequestBody;
  try {
    body = (await req.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (!isValidAdminPassword(body.password)) {
    return NextResponse.json(
      { success: false, error: "Invalid admin password." },
      { status: 401 },
    );
  }

  const sessionValue = createAdminSessionValue();
  if (!sessionValue) {
    return NextResponse.json(
      { success: false, error: "Unable to create admin session." },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ success: true, authenticated: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, sessionValue, getAdminCookieOptions());
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, authenticated: false });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...getAdminCookieOptions(),
    maxAge: 0,
  });
  return response;
}
