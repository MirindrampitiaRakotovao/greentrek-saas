import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { createAvis } from "@/lib/services/avis";
import { avisSchema } from "@/lib/validators/avis";

/**
 * Avis sur un séjour terminé `{ note, commentaire }` (RG 17 : réservation TERMINEE, un seul
 * avis, titulaire seulement ; publié après modération par l'agence). Même service que le site.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/reservations/[id]/avis">,
) {
  const session = await mobileClientFromRequest(request);
  if (!session) return UNAUTHORIZED();
  const { id } = await params;
  const body = await readJson(request);
  const parsed = avisSchema.safeParse({
    ...(body && typeof body === "object" ? body : {}),
    reservationId: id,
  });
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await createAvis(session.db, {
    ...parsed.data,
    agenceId: session.user.agenceId,
    clientId: session.user.id,
  });
  if (!result.ok) return businessError(result.error, result.field);
  return json(
    { message: "Merci pour votre avis ! Il sera publié après relecture par l'agence." },
    { status: 201, private: true },
  );
}

export const OPTIONS = preflight;
