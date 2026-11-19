import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { computeForClient } from "@/lib/services/itineraires-perso";
import { clientCalculSchema } from "@/lib/validators/itineraires-perso";

/**
 * Meilleur itinéraire sur le réseau de l'agence du voyageur `{ etapeDepartId, etapeArriveeId,
 * etapesImposees, ordreLibre, critere }` (étape 4b) ; 30 calculs par heure au plus.
 */
export async function POST(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const parsed = clientCalculSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await computeForClient(ctx.db, {
    ...parsed.data,
    agenceId: ctx.user.agenceId,
    clientId: ctx.user.id,
  });
  if (!result.ok) return businessError(result.error, result.field);
  const o = result.data;
  return json(
    {
      found: o.found,
      message: o.message ?? null,
      historiqueId: o.historiqueId ?? null,
      distanceKm: Math.round(o.distanceKm * 100) / 100,
      dureeMinutes: o.dureeMinutes,
      difficulteMoyenne: o.difficulteMoyenne,
      etapes: o.path,
    },
    { private: true },
  );
}

export const OPTIONS = preflight;
