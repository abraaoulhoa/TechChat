import { partsFailure, partsJson, requirePartsMutation } from "@/lib/parts-auth";
import { scanPart, validPartId } from "@/lib/parts-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requirePartsMutation(request);
    return partsJson({ part: await scanPart(validPartId((await context.params).id)) });
  } catch (error) {
    return partsFailure(error);
  }
}
