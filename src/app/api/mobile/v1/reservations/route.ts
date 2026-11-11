import { currentAgence } from "@/lib/mobile/context";
import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { toMobileReservation } from "@/lib/mobile/reservations";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { createReservation, listClientReservations } from "@/lib/services/reservations";
import { reservationSchema } from "@/lib/validators/reservations";

/** Réservations du voyageur connecté (les siennes uniquement, §7.2), les plus récentes d'abord. */
export async function GET(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const [agence, reservations] = await Promise.all([
    currentAgence(ctx.db),
    listClientReservations(ctx.db, ctx.user.id),
  ]);
  return json(
    { reservations: reservations.map((r) => toMobileReservation(r, agence)) },
    { private: true },
  );
}

/**
 * Nouvelle réservation `{ sessionId, participants, remarques }` : même service que le site
 * (verrou anti-surbooking RG 13, montant figé RG 14). Le départ doit appartenir à l'agence du
 * compte : le client confiné ne voit pas les départs des autres agences.
 */
export async function POST(request: Request) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const parsed = reservationSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await createReservation(ctx.db, {
    ...parsed.data,
    agenceId: ctx.user.agenceId,
    agenceSlug: ctx.user.agenceSlug,
    clientId: ctx.user.id,
  });
  if (!result.ok) return businessError(result.error, result.field);
  return json(result.data, { status: 201, private: true });
}

export const OPTIONS = preflight;
