import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { payReservation } from "@/lib/services/reservations";
import { PAIEMENT_REFUSE, paiementSchema } from "@/lib/validators/reservations";

/**
 * Paiement du reste à payer `{ methode, numero }` (même service que le site) : carte ou
 * Mobile Money réglés aussitôt (réservation confirmée), virement ou espèces à valider par
 * l'agence. Un numéro refusé renvoie 402 avec un message ; rien n'est conservé du numéro
 * hormis ses 4 derniers chiffres.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/reservations/[id]/paiement">,
) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const { id } = await params;
  const body = await readJson(request);
  const parsed = paiementSchema.safeParse({
    ...(body && typeof body === "object" ? body : {}),
    reservationId: id,
  });
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await payReservation(ctx.db, { ...parsed.data, clientId: ctx.user.id });
  if (!result.ok) return businessError(result.error, result.field);
  if (result.data.statut === "ECHOUE") return businessError(PAIEMENT_REFUSE, "numero");
  return json(result.data, { private: true });
}

export const OPTIONS = preflight;
