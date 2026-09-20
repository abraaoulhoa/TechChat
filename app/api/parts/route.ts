import { getDashboard, OPTIONS } from "@/app/parts/parts-model";
import { partsFailure, partsJson, readPartsJson, requirePartsMutation, requirePartsSession } from "@/lib/parts-auth";
import { insertPart, listParts, partForm } from "@/lib/parts-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requirePartsSession(request);
    const parts = await listParts();
    return partsJson({ parts, dashboard: getDashboard(parts), options: OPTIONS });
  } catch (error) {
    return partsFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    requirePartsMutation(request);
    const form = partForm(await readPartsJson(request));
    return partsJson({ part: await insertPart(form) }, 201);
  } catch (error) {
    return partsFailure(error);
  }
}
