import { partsFailure, partsJson, readPartsJson, requirePartsMutation } from "@/lib/parts-auth";
import { editPart, partForm, removePart, validPartId } from "@/lib/parts-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    requirePartsMutation(request);
    const id = validPartId((await context.params).id);
    const form = partForm(await readPartsJson(request));
    return partsJson({ part: await editPart(id, form) });
  } catch (error) {
    return partsFailure(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    requirePartsMutation(request);
    await removePart(validPartId((await context.params).id));
    return partsJson({ ok: true });
  } catch (error) {
    return partsFailure(error);
  }
}
