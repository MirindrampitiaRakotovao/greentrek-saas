import {
  businessError,
  json,
  preflight,
  readJson,
  UNAUTHORIZED,
  validationError,
} from "@/lib/mobile/http";
import { mobileClientFromRequest } from "@/lib/mobile/session";
import { answerItineraire } from "@/lib/services/itineraires-perso";
import { answerItineraireSchema } from "@/lib/validators/itineraires-perso";

/** Réponse à un itinéraire proposé par l'agence `{ decision, reponse }`. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/mobile/v1/itineraires/[id]/reponse">,
) {
  const ctx = await mobileClientFromRequest(request);
  if (!ctx) return UNAUTHORIZED();
  const { id } = await params;
  const body = await readJson(request);
  const parsed = answerItineraireSchema.safeParse({
    reponse: null,
    ...(body && typeof body === "object" ? body : {}),
    id,
  });
  if (!parsed.success) return validationError(parsed.error.issues);
  const result = await answerItineraire(ctx.db, { ...parsed.data, clientId: ctx.user.id });
  if (!result.ok) return businessError(result.error, result.field);
  return json(
    {
      message:
        parsed.data.decision === "ACCEPTE"
          ? "Merci ! L'agence est prévenue que vous acceptez cet itinéraire."
          : "L'agence est prévenue que vous déclinez cet itinéraire.",
    },
    { private: true },
  );
}

export const OPTIONS = preflight;
