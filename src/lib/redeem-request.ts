export type RedeemRequestBody = {
  code: string;
  targetService: string;
  countryId: string;
};

export type RedeemRequestBodyResult =
  | {
      ok: true;
      body: RedeemRequestBody;
    }
  | {
      ok: false;
      error: string;
    };

const REQUIRED_REDEEM_FIELDS_ERROR =
  'Card secret code, target service, and countryId are required';

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function readRedeemRequestBody(
  req: Request,
): Promise<RedeemRequestBodyResult> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return {
      ok: false,
      error: 'Invalid JSON body.',
    };
  }

  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return {
      ok: false,
      error: REQUIRED_REDEEM_FIELDS_ERROR,
    };
  }

  const body = rawBody as Record<string, unknown>;
  const code = readNonEmptyString(body.code);
  const targetService = readNonEmptyString(body.targetService);
  const countryId = readNonEmptyString(body.countryId);

  if (!code || !targetService || !countryId) {
    return {
      ok: false,
      error: REQUIRED_REDEEM_FIELDS_ERROR,
    };
  }

  return {
    ok: true,
    body: {
      code,
      targetService,
      countryId,
    },
  };
}
