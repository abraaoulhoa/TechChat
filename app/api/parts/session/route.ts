import { clearSessionCookie, createSessionCookie, matchesAccessCode, PartsApiError, partsConfig, partsFailure, partsJson, readPartsJson, requirePartsMutation, requireSameOrigin } from "@/lib/parts-auth";
import { recordLoginAttempt } from "@/lib/parts-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    partsConfig();
    requireSameOrigin(request);
    await recordLoginAttempt(request);
    const body = await readPartsJson(request);
    if (typeof body.code !== "string" || body.code.length > 512 || !matchesAccessCode(body.code)) {
      throw new PartsApiError("Código de acesso inválido.", 401);
    }
    return partsJson({ ok: true }, 200, { "Set-Cookie": createSessionCookie() });
  } catch (error) {
    return partsFailure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requirePartsMutation(request);
    return partsJson({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  } catch (error) {
    return partsFailure(error);
  }
}
