"use server";

import { revalidatePath } from "next/cache";

import { authorize, parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import {
  cancelReservationByAgency,
  confirmReservation,
  recordPayment,
  refundPayment,
  rejectPayment,
  validatePayment,
} from "@/lib/services/gestion-reservations";
import { idSchema } from "@/lib/validators/backoffice";
import { encaissementSchema } from "@/lib/validators/reservations";

/*
 * Actions du back-office sur les réservations et les paiements (étape E10) : session +
 * client confiné + permission (matrice §3 : ADMIN_AGENCE et STAFF ; pas le GUIDE) → Zod →
 * service. Pas d'action de suppression (décision D : traçabilité).
 */

function revalidateGestion() {
  revalidatePath("/dashboard", "layout");
  // Le client voit le nouveau statut dans son espace, le public les places libérées.
  revalidatePath("/a", "layout");
}

export async function confirmReservationAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "reservation");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await confirmReservation(auth.db, parsed.data.id);
  if (result.ok) revalidateGestion();
  return toActionResult(result, "Réservation confirmée.");
}

export async function cancelReservationAgencyAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("annuler", "reservation");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await cancelReservationByAgency(auth.db, parsed.data.id);
  if (result.ok) revalidateGestion();
  return toActionResult(result, "Réservation annulée, places libérées.");
}

export async function recordPaymentAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("creer", "paiement");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(encaissementSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await recordPayment(auth.db, parsed.data);
  if (!result.ok) return toActionResult(result);
  revalidateGestion();
  return {
    success: result.data.confirmee
      ? "Paiement enregistré : réservation entièrement payée et confirmée."
      : "Paiement enregistré.",
  };
}

export async function validatePaymentAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "paiement");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await validatePayment(auth.db, parsed.data.id);
  if (!result.ok) return toActionResult(result);
  revalidateGestion();
  return {
    success: result.data.confirmee
      ? "Paiement validé : réservation confirmée."
      : "Paiement validé.",
  };
}

export async function rejectPaymentAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "paiement");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await rejectPayment(auth.db, parsed.data.id);
  if (result.ok) revalidateGestion();
  return toActionResult(result, "Paiement refusé.");
}

export async function refundPaymentAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "paiement");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await refundPayment(auth.db, parsed.data.id);
  if (result.ok) revalidateGestion();
  return toActionResult(result, "Paiement remboursé (simulation).");
}
