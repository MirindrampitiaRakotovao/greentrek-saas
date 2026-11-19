import { json, jsonError, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { toMobileItineraire } from "@/lib/mobile/itineraires";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { getItineraireClient } from "@/lib/services/itineraires-perso";

/** Un itinéraire du voyageur (404 s'il n'est pas à lui). */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/itineraires/[id]">,
) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const { id } = await params;
  const it = await getItineraireClient(ctx.db, id, ctx.user.id);
  if (!it) return jsonError("Itinéraire introuvable.", 404);
  return json(toMobileItineraire(it), { private: true });
}

export const OPTIONS = preflight;
