import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";

type ConfigRecord = {
  key: string;
  value: string;
};

type ConfigUpdate = {
  key: string;
  value: string;
};

const PUBLIC_CONFIG_KEYS = ["COUNTRIES"] as const;
const SECRET_CONFIG_KEYS = new Set(["HERO_API_KEY"]);

function toConfigMap(configs: ConfigRecord[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const conf of configs) {
    result[conf.key] = conf.value;
  }
  return result;
}

function isConfigUpdate(item: unknown): item is ConfigUpdate {
  if (!item || typeof item !== "object") return false;
  const candidate = item as { key?: unknown; value?: unknown };
  return typeof candidate.key === "string" && typeof candidate.value === "string";
}

function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
    { status: 401 },
  );
}

export async function GET(req: NextRequest) {
  try {
    const isAdminQuery = req.nextUrl.searchParams.get("admin") === "1";

    if (!isAdminQuery) {
      const configs = await db.systemConfig.findMany({
        where: { key: { in: [...PUBLIC_CONFIG_KEYS] } },
      });
      return NextResponse.json({ success: true, config: toConfigMap(configs) });
    }

    if (!isAdminRequest(req)) return unauthorizedResponse();

    const configs = await db.systemConfig.findMany();
    const result = toConfigMap(configs);
    const hasHeroApiKey = Boolean(result.HERO_API_KEY);

    for (const key of SECRET_CONFIG_KEYS) {
      delete result[key];
    }

    return NextResponse.json({
      success: true,
      config: result,
      hasHeroApiKey,
    });
  } catch (error: unknown) {
    console.error("Fetch config error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  try {
    const data: unknown = await req.json();
    if (!Array.isArray(data)) {
      return NextResponse.json(
        { success: false, error: "Expected an array of { key, value }" },
        { status: 400 },
      );
    }

    const updates = data.filter(isConfigUpdate).filter((item) => {
      if (item.key !== "HERO_API_KEY") return true;
      return item.value.trim().length > 0;
    });

    if (updates.length !== data.length) {
      const onlySkippedEmptySecret = data.every((item) => {
        if (!isConfigUpdate(item)) return false;
        return item.key === "HERO_API_KEY" ? item.value.trim().length === 0 : true;
      });

      if (!onlySkippedEmptySecret) {
        return NextResponse.json(
          { success: false, error: "Each item must include string key and value." },
          { status: 400 },
        );
      }
    }

    const results = await Promise.all(
      updates.map((item) =>
        db.systemConfig.upsert({
          where: { key: item.key },
          update: { value: item.value },
          create: { key: item.key, value: item.value },
        }),
      ),
    );

    return NextResponse.json({ success: true, count: results.length });
  } catch (error: unknown) {
    console.error("Update config error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
