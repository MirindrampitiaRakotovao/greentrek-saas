"use server";

import { revalidatePath } from "next/cache";

import { authorize, journal, parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { getClientContext } from "@/lib/auth/session";
import {
  answerDepartSurMesure,
  cancelDepartSurMesure,
  programDepart,
} from "@/lib/services/departs-sur-mesure";
import type { AlgorithmOutcome } from "@/lib/services/itineraires";
import {
  answerDemande,
  answerItineraire,
  computeForClient,
  proposeItineraire,
  requestItineraire,
} from "@/lib/services/itineraires-perso";
import {
  answerDepartSchema,
  answerItineraireSchema,
  departIdSchema,
  programDepartSchema,
  clientCalculSchema,
  proposeItineraireSchema,
  requestItineraireSchema,
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

const NOT_CLIENT: ActionResult = { error: "Connectez-vous avec votre compte voyageur." };

/** Étape 4b : le voyageur calcule un itinéraire sur le réseau de son agence. */
export async function computeClientItineraireAction(
  input: unknown,
): Promise<ActionResult & { outcomes?: AlgorithmOutcome[] }> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(clientCalculSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await computeForClient(ctx.db, {
    ...parsed.data,
    agenceId: ctx.user.agenceId,
    clientId: ctx.user.id,
  });
  if (!result.ok) return toActionResult(result);
  return { outcomes: [result.data] };
}

/** Étape 4b : le voyageur envoie son itinéraire à l'agence, puis ouvre sa fiche. */
export async function requestItineraireAction(
  input: unknown,
): Promise<ActionResult & { id?: string }> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(requestItineraireSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await requestItineraire(ctx.db, {
    ...parsed.data,
    agenceId: ctx.user.agenceId,
    clientId: ctx.user.id,
  });
  if (!result.ok) return toActionResult(result);
  revalidatePath(`/a/${ctx.user.agenceSlug}/mon-compte`, "layout");
  revalidatePath("/dashboard", "layout");
  return { success: "Itinéraire envoyé à l'agence.", id: result.data.id };
}

/** Étape 4b : l'agence accepte ou décline la demande d'un voyageur. */
export async function answerDemandeAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("creer", "reservation");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(answerItineraireSchema, input);
  if (!parsed.ok) return parsed.result;
  const agence = await auth.db.agence.findFirstOrThrow({ select: { slug: true } });
  const result = await answerDemande(auth.db, { ...parsed.data, agenceSlug: agence.slug });
  if (result.ok) {
    await journal(auth, "ITINERAIRE_REPONDU", "ItinerairePersonnalise", parsed.data.id, {
      decision: parsed.data.decision,
    });
    revalidatePath("/dashboard/itineraires-sur-mesure", "layout");
  }
  return toActionResult(
    result,
    parsed.data.decision === "ACCEPTE"
      ? "Demande acceptée : le voyageur est prévenu."
      : "Demande déclinée : le voyageur est prévenu.",
  );
}

/* ─── Étape 9 : départ d'un itinéraire sur mesure ─── */

/** Le voyageur programme (ou modifie) le départ de son itinéraire accepté. */
export async function programDepartAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(programDepartSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await programDepart(ctx.db, {
    ...parsed.data,
    agenceId: ctx.user.agenceId,
    clientId: ctx.user.id,
  });
  if (!result.ok) return toActionResult(result);
  revalidatePath(`/a/${ctx.user.agenceSlug}/mon-compte`, "layout");
  revalidatePath("/dashboard", "layout");
  return {
    success: result.data.modifie
      ? "Départ modifié : l'agence est prévenue."
      : "Départ programmé : l'agence va le confirmer.",
  };
}

/** Le voyageur annule son départ, avant le jour du début. */
export async function cancelDepartSurMesureAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(departIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await cancelDepartSurMesure(ctx.db, { id: parsed.data.id, clientId: ctx.user.id });
  if (result.ok) {
    revalidatePath(`/a/${ctx.user.agenceSlug}/mon-compte`, "layout");
    revalidatePath("/dashboard", "layout");
  }
  return toActionResult(result, "Départ annulé : l'agence est prévenue.");
}

/** L'agence confirme (tarif, guide, message) ou refuse le départ demandé. */
export async function answerDepartSurMesureAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("creer", "reservation");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(answerDepartSchema, input);
  if (!parsed.ok) return parsed.result;
  const agence = await auth.db.agence.findFirstOrThrow({ select: { slug: true } });
  const result = await answerDepartSurMesure(auth.db, { ...parsed.data, agenceSlug: agence.slug });
  if (result.ok) {
    await journal(
      auth,
      parsed.data.decision === "CONFIRME"
        ? "DEPART_SUR_MESURE_CONFIRME"
        : "DEPART_SUR_MESURE_REFUSE",
      "DepartSurMesure",
      parsed.data.id,
    );
    revalidatePath("/dashboard/itineraires-sur-mesure", "layout");
  }
  return toActionResult(
    result,
    parsed.data.decision === "CONFIRME"
      ? "Départ confirmé : le voyageur est prévenu."
      : "Départ refusé : le voyageur est prévenu.",
  );
}
