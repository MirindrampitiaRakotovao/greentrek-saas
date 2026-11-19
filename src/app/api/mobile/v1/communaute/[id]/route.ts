import { toMobilePublicationDetail } from "@/lib/mobile/communaute";
import { businessError, json, jsonError, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { deletePublication, getPublication } from "@/lib/services/communaute";
import { deleteImage } from "@/lib/uploads";

type Ctx = RouteContext<"/api/mobile/v1/communaute/[id]">;

/** Une publication et ses commentaires. */
export async function GET(request: Request, { params }: Ctx) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const p = await getPublication(ctx.user.id, (await params).id);
  if (!p) return jsonError("Publication introuvable.", 404);
  return json(toMobilePublicationDetail(p), { private: true });
}

/** Suppression de SA publication (et de ses photos). */
export async function DELETE(request: Request, { params }: Ctx) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const result = await deletePublication(ctx.user.id, (await params).id);
  if (!result.ok) return businessError(result.error, result.field);
  await Promise.all(result.data.photos.map((url) => deleteImage(url)));
  return json({ ok: true }, { private: true });
}

export const OPTIONS = preflight;
