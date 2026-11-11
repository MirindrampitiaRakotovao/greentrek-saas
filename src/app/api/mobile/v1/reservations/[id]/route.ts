import { currentAgence } from "@/lib/mobile/context";
import { json, jsonError, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { toMobileReservation } from "@/lib/mobile/reservations";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { getClientReservation } from "@/lib/services/reservations";

/** Une réservation du voyageur (404 pour la réservation d'un autre client ou d'une autre agence). */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/reservations/[id]">,
) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const { id } = await params;
  const [agence, reservation] = await Promise.all([
    currentAgence(ctx.db),
    getClientReservation(ctx.db, id, ctx.user.id),
  ]);
  if (!reservation) return jsonError("Réservation introuvable.", 404);
  return json(toMobileReservation(reservation, agence), { private: true });
}

export const OPTIONS = preflight;
