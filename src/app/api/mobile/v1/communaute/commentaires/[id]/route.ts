import { businessError, json, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { deleteCommentaire } from "@/lib/services/communaute";

/** Suppression de SON commentaire. */
export async function DELETE(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/communaute/commentaires/[id]">,
) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const result = await deleteCommentaire(ctx.user.id, (await params).id);
  if (!result.ok) return businessError(result.error, result.field);
  return json({ ok: true }, { private: true });
}

export const OPTIONS = preflight;
