import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { toMobileItineraire } from "@/lib/mobile/itineraires";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { listItinerairesClient, requestItineraire } from "@/lib/services/itineraires-perso";
import { requestItineraireSchema } from "@/lib/validators/itineraires-perso";

/** Itinéraires sur mesure du voyageur (les siens uniquement), les plus récents d'abord. */
export async function GET(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const items = await listItinerairesClient(ctx.db, ctx.user.id);
  return json({ itineraires: items.map(toMobileItineraire) }, { private: true });
}

/** Demande d'itinéraire envoyée à l'agence `{ historiqueId, titre, message }` (étape 4b). */
export async function POST(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const parsed = requestItineraireSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await requestItineraire(ctx.db, {
    ...parsed.data,
    agenceId: ctx.user.agenceId,
    clientId: ctx.user.id,
  });
  if (!result.ok) return businessError(result.error, result.field);
  return json(result.data, { status: 201, private: true });
}

export const OPTIONS = preflight;
