"use server";

import { revalidatePath } from "next/cache";

import { authorize, journal, parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { getClientContext } from "@/lib/auth/session";
import { answerItineraire, proposeItineraire } from "@/lib/services/itineraires-perso";
import {
  answerItineraireSchema,
  proposeItineraireSchema,
} from "@/lib/validators/itineraires-perso";

/*
 * Itinéraires sur mesure (après E12). L'agence propose (administrateur et personnel : droit
 * « créer une réservation », comme pour les clients) ; le voyageur répond (session relue en
 * base, SES itinéraires seulement).
 */

/** L'agence envoie à un client l'itinéraire qu'elle vient de calculer. */
export async function proposeItineraireAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("creer", "reservation");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(proposeItineraireSchema, input);
  if (!parsed.ok) return parsed.result;
  const agence = await auth.db.agence.findFirstOrThrow({ select: { slug: true } });
  const result = await proposeItineraire(auth.db, {
    ...parsed.data,
    agenceId: auth.user.agenceId,
    agenceSlug: agence.slug,
    auteurId: auth.user.id,
  });
  if (result.ok) {
    await journal(auth, "ITINERAIRE_PROPOSE", "ItinerairePersonnalise", result.data.id);
    revalidatePath(`/dashboard/clients/${parsed.data.clientId}`);
  }
  return toActionResult(result, "Itinéraire envoyé au client.");
}

/** Le voyageur accepte ou décline l'itinéraire proposé par son agence. */
export async function answerItineraireAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return { error: "Connectez-vous avec votre compte voyageur." };
  const parsed = parseInput(answerItineraireSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await answerItineraire(ctx.db, { ...parsed.data, clientId: ctx.user.id });
  if (result.ok) {
    revalidatePath(`/a/${ctx.user.agenceSlug}/mon-compte`, "layout");
    revalidatePath("/dashboard", "layout");
  }
  return toActionResult(
    result,
    parsed.data.decision === "ACCEPTE"
      ? "Merci ! L'agence est prévenue que vous acceptez cet itinéraire."
      : "L'agence est prévenue que vous déclinez cet itinéraire.",
  );
}
