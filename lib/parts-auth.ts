import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const PARTS_UNAVAILABLE = "O controle compartilhado ainda está sendo conectado. Tente novamente em instantes.";
const COOKIE_NAME = "techchat-parts-session";
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_BODY_BYTES = 32 * 1024;

export class PartsApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryAfter?: number) {
    super(message);
  }
}

export function partsConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  const accessCode = process.env.PARTS_ACCESS_CODE;
  if (!databaseUrl?.trim() || !accessCode?.trim()) {
    throw new PartsApiError(PARTS_UNAVAILABLE, 503);
  }
  return { databaseUrl, accessCode };
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function matchesAccessCode(code: string) {
  return timingSafeEqual(digest(code), digest(partsConfig().accessCode));
}

function signature(value: string) {
  return createHmac("sha256", partsConfig().accessCode)
    .update(`techchat:parts:session:v1:${value}`).digest("base64url");
}

function cookie(value: string, maxAge: number) {
  return `${COOKIE_NAME}=${value}; Path=/api/parts; HttpOnly; SameSite=Strict; Max-Age=${maxAge}; Expires=${new Date(Date.now() + maxAge * 1000).toUTCString()}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function createSessionCookie() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const value = `${expires}.${randomBytes(24).toString("base64url")}`;
  return cookie(`${value}.${signature(value)}`, SESSION_SECONDS);
}

export function clearSessionCookie() {
  return cookie("", 0);
}

export function requirePartsSession(request: Request) {
  partsConfig();
  const value = (request.headers.get("cookie") ?? "").split(";")
    .map(item => item.trim()).find(item => item.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  const match = value?.match(/^(\d{10})\.([A-Za-z0-9_-]{32})\.([A-Za-z0-9_-]{43})$/);
  const now = Math.floor(Date.now() / 1000);
  if (!match || Number(match[1]) <= now || Number(match[1]) > now + SESSION_SECONDS
    || !timingSafeEqual(digest(match[3]), digest(signature(`${match[1]}.${match[2]}`)))) {
    throw new PartsApiError("Informe o código de acesso da equipe para continuar.", 401);
  }
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (origin !== new URL(request.url).origin || (site && site !== "same-origin" && site !== "none")) {
    throw new PartsApiError("Origem da solicitação não permitida.", 403);
  }
}

export function requirePartsMutation(request: Request) {
  requirePartsSession(request);
  requireSameOrigin(request);
}

export function loginBucketKey(request: Request) {
  // Vercel overwrites x-vercel-forwarded-for at its trusted ingress.
  const address = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for") ?? "unknown"
    : request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "local";
  const ip = address.split(",")[0].trim().slice(0, 200);
  return createHmac("sha256", partsConfig().accessCode)
    .update(`techchat:parts:login:${ip}`).digest("hex");
}

export async function readPartsJson(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new PartsApiError("Envie os dados no formato JSON.", 415);
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    throw new PartsApiError("Os dados enviados ultrapassam o tamanho permitido.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new PartsApiError("Informe os dados da solicitação.", 400);
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new PartsApiError("Os dados enviados ultrapassam o tamanho permitido.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new PartsApiError("Os dados enviados não contêm um JSON válido.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new PartsApiError("Envie um objeto com os dados da solicitação.", 400);
  }
  return body as Record<string, unknown>;
}

export function partsJson(body: unknown, status = 200, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  headers.set("Cache-Control", "no-store, private");
  headers.set("Vary", "Cookie");
  return Response.json(body, { status, headers });
}

export function partsFailure(error: unknown) {
  if (error instanceof PartsApiError) {
    return partsJson({ error: error.message }, error.status,
      error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined);
  }
  // Never return driver errors, SQL details, connection URLs, or environment values.
  return partsJson({ error: "Não foi possível acessar os registros compartilhados. Tente novamente em instantes." }, 503);
}
