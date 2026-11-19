import { json, preflight, UNAUTHORIZED } from "@/lib/mobile/http";
import { toMobileItineraire } from "@/lib/mobile/itineraires";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { listItinerairesClient } from "@/lib/services/itineraires-perso";

/** Itinéraires sur mesure du voyageur (les siens uniquement), les plus récents d'abord. */
export async function GET(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const items = await listItinerairesClient(ctx.db, ctx.user.id);
  return json({ itineraires: items.map(toMobileItineraire) }, { private: true });
}

export const OPTIONS = preflight;
