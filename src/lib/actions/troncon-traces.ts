"use server";

import { revalidatePath } from "next/cache";

import { authorize, parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import {
  clearTrace,
  proposeAndSaveTrace,
  proposeTrace,
  saveTrace,
  type TraceProposal,
} from "@/lib/services/troncon-traces";
import { saveTraceSchema, tronconIdSchema } from "@/lib/validators/circuits";

/*
 * Tracés réels des tronçons (étape 6b-2). Droit requis : « modifier un tronçon »
 * (administrateur et personnel, matrice §3). Chemin : session + client confiné →
 * permission → Zod → service.
 */

const ETAPES_PATH = "/dashboard/etapes";

/** Proposition d'OpenStreetMap, affichée sur la carte ; rien n'est enregistré. */
export async function proposeTraceAction(
  input: unknown,
): Promise<ActionResult & { proposal?: TraceProposal }> {
  const auth = await authorize("modifier", "troncon");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(tronconIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await proposeTrace(auth.db, parsed.data.tronconId);
  return result.ok ? { proposal: result.data } : toActionResult(result);
}

export async function saveTraceAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "troncon");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(saveTraceSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await saveTrace(auth.db, parsed.data);
  if (!result.ok) return toActionResult(result);
  revalidatePath(ETAPES_PATH);
  return {
    success: parsed.data.remplacerDistance
      ? `Tracé enregistré : distance ${result.data.distanceKm.toLocaleString("fr-FR")} km, mesurée sur le tracé.`
      : "Tracé enregistré.",
  };
}

export async function clearTraceAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "troncon");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(tronconIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await clearTrace(auth.db, parsed.data.tronconId);
  if (result.ok) revalidatePath(ETAPES_PATH);
  return toActionResult(result, "Tracé effacé : ligne droite entre les étapes.");
}

/** Un tronçon de « Proposer tous les tracés » (la page enchaîne les appels un par un). */
export async function proposeAndSaveTraceAction(
  input: unknown,
): Promise<ActionResult & { status?: "deja" | "enregistre" }> {
  const auth = await authorize("modifier", "troncon");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(tronconIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await proposeAndSaveTrace(auth.db, parsed.data.tronconId);
  return result.ok ? { status: result.data.status } : toActionResult(result);
}

/** Fin de « Proposer tous les tracés » : rafraîchit la carte une seule fois. */
export async function refreshNetworkAction(): Promise<void> {
  const auth = await authorize("lire", "troncon");
  if (auth.ok) revalidatePath(ETAPES_PATH);
}
