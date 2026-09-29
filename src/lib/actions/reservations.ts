"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { getClientContext } from "@/lib/auth/session";
import {
  cancelReservationByClient,
  createReservation,
  payReservation,
} from "@/lib/services/reservations";
import { idSchema } from "@/lib/validators/backoffice";
import { paiementSchema, reservationSchema } from "@/lib/validators/reservations";

/*
 * Actions du tunnel de réservation et de l'espace client (étape E9). Le client et son agence
 * viennent de la session relue en base (`getClientContext`), jamais du navigateur : un client
 * ne peut réserver, payer ou annuler que dans SON agence et pour SES réservations.
 */

const NOT_CLIENT: ActionResult = { error: "Connectez-vous avec votre compte voyageur." };

function revalidateClient(slug: string) {
  revalidatePath(`/a/${slug}`, "layout");
  revalidatePath("/dashboard", "layout"); // l'agence voit la réservation (tableaux de bord)
}

export async function createReservationAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(reservationSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await createReservation(ctx.db, {
    ...parsed.data,
    agenceId: ctx.user.agenceId,
    agenceSlug: ctx.user.agenceSlug,
    clientId: ctx.user.id,
  });
  if (!result.ok) return toActionResult(result);
  revalidateClient(ctx.user.agenceSlug);
  // Étape suivante du tunnel : le paiement simulé.
  redirect(`/a/${ctx.user.agenceSlug}/paiement/${result.data.id}`);
}

export async function payReservationAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(paiementSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await payReservation(ctx.db, { ...parsed.data, clientId: ctx.user.id });
  if (!result.ok) return toActionResult(result);
  revalidateClient(ctx.user.agenceSlug);
  if (result.data.statut === "ECHOUE") {
    return { error: "Paiement refusé (simulation). Essayez un autre numéro ou moyen de paiement." };
  }
  redirect(`/a/${ctx.user.agenceSlug}/mon-compte/reservations/${parsed.data.reservationId}?paye=1`);
}

export async function cancelReservationAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await cancelReservationByClient(ctx.db, {
    reservationId: parsed.data.id,
    clientId: ctx.user.id,
  });
  if (result.ok) revalidateClient(ctx.user.agenceSlug);
  return toActionResult(result, "Réservation annulée. Les places ont été libérées.");
}
