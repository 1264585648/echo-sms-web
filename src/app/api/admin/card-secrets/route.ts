import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: 401 },
  );
}

// Helper to generate a random 12-char code securely: XXXX-XXXX-XXXX
function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const bytes = randomBytes(12);
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) result += '-';
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const secrets = await db.cardSecret.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ success: true, secrets });
  } catch (error: any) {
    console.error("Fetch card secrets error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const data = await req.json();
    let { value, count } = data;

    value = parseFloat(value);
    count = parseInt(count);

    if (isNaN(value) || value <= 0) {
      return NextResponse.json({ success: false, error: "Invalid value" }, { status: 400 });
    }

    if (isNaN(count) || count <= 0 || count > 50) {
      count = 1;
    }

    const created = [];
    for (let i = 0; i < count; i++) {
      const secret = await db.cardSecret.create({
        data: {
          code: generateCode(),
          value: value,
          status: "UNUSED",
        }
      });
      created.push(secret);
    }

    return NextResponse.json({ success: true, created });
  } catch (error: any) {
    console.error("Generate card secrets error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
