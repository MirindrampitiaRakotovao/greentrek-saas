import { businessError, json, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { blockUser, unblockUser } from "@/lib/services/voyageurs";

/** Bloquer un voyageur : plus aucun message dans les deux sens (étape 5c). */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/voyageurs/[id]/blocage">,
) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const { id } = await params;
  const result = await blockUser(ctx.db, {
    agenceId: ctx.user.agenceId,
    bloqueurId: ctx.user.id,
    bloqueId: id,
  });
  if (!result.ok) return businessError(result.error, result.field);
  return json({ ok: true }, { private: true });
}

/** Débloquer. */
export async function DELETE(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/voyageurs/[id]/blocage">,
) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const { id } = await params;
  const result = await unblockUser(ctx.db, ctx.user.id, id);
  if (!result.ok) return businessError(result.error, result.field);
  return json({ ok: true }, { private: true });
}

export const OPTIONS = preflight;
