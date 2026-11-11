import { businessError, json, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { cancelReservationByClient } from "@/lib/services/reservations";

/** Annulation par le voyageur (RG 15 : seulement avant le départ ; places libérées). */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/reservations/[id]/annulation">,
) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const { id } = await params;
  const result = await cancelReservationByClient(ctx.db, {
    reservationId: id,
    clientId: ctx.user.id,
  });
  if (!result.ok) return businessError(result.error, result.field);
  return json({ message: "Réservation annulée. Les places ont été libérées." }, { private: true });
}

export const OPTIONS = preflight;
