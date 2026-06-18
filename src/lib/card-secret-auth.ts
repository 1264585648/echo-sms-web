export const CARD_SECRET_CODE_HEADER = 'x-card-secret-code';

export type CardSecretLookup = (code: string) => Promise<{ id: string } | null>;

export type CardSecretAuthResult =
  | {
      ok: true;
      code: string;
      cardSecretId: string;
    }
  | {
      ok: false;
      status: 401 | 403;
      error: string;
    };

type AuthorizeCardSecretForOrderArgs = {
  code: string | null | undefined;
  orderCardSecretId: string;
  findCardSecretByCode: CardSecretLookup;
};

function normalizeCardSecretCode(value: unknown) {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readCardSecretCodeFromHeader(headers: Headers) {
  return normalizeCardSecretCode(headers.get(CARD_SECRET_CODE_HEADER));
}

export function readCardSecretCodeFromBody(body: unknown) {
  if (!body || typeof body !== 'object') return null;

  return normalizeCardSecretCode((body as { cardSecretCode?: unknown }).cardSecretCode);
}

export async function readCardSecretCodeFromJsonBody(req: Request) {
  try {
    return readCardSecretCodeFromBody(await req.json());
  } catch {
    return null;
  }
}

export async function authorizeCardSecretForOrder({
  code,
  orderCardSecretId,
  findCardSecretByCode,
}: AuthorizeCardSecretForOrderArgs): Promise<CardSecretAuthResult> {
  const normalizedCode = normalizeCardSecretCode(code);

  if (!normalizedCode) {
    return {
      ok: false,
      status: 401,
      error: 'Card secret code is required',
    };
  }

  const secret = await findCardSecretByCode(normalizedCode);

  if (!secret || secret.id !== orderCardSecretId) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden',
    };
  }

  return {
    ok: true,
    code: normalizedCode,
    cardSecretId: secret.id,
  };
}
