"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorize, parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import {
  addCircuitEtape,
  addCircuitPartenaire,
  createCircuit,
  deleteCircuit,
  moveCircuitEtape,
  removeCircuitEtape,
  removeCircuitPartenaire,
  setCircuitStatut,
  updateCircuit,
  updateCircuitEtape,
} from "@/lib/services/circuits";
import { createEtape, deleteEtape, updateEtape } from "@/lib/services/etapes";
import { createTroncon, deleteTroncon, updateTroncon } from "@/lib/services/troncons";
import { idSchema } from "@/lib/validators/backoffice";
import {
  addCircuitEtapeSchema,
  circuitPartenaireSchema,
  circuitSchema,
  circuitStatutSchema,
  etapeSchema,
  moveCircuitEtapeSchema,
  moveEtapeSchema,
  tronconSchema,
  updateCircuitEtapeSchema,
} from "@/lib/validators/circuits";

/*
 * Actions serveur des étapes et des circuits (étape E4). Même schéma que les autres
 * modules : session + client confiné + permission (`authorize`) → Zod → service.
 */

const ETAPES_PATH = "/dashboard/etapes";
const CIRCUITS_PATH = "/dashboard/circuits";

/* ─── Étapes ─────────────────────────────────────────────────────────────────── */

export async function createEtapeAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("creer", "etape");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(etapeSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await createEtape(auth.db, auth.user.agenceId, parsed.data);
  if (result.ok) revalidatePath(ETAPES_PATH);
  return toActionResult(result, "Étape ajoutée.");
}

export async function updateEtapeAction(id: string, input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "etape");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(etapeSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await updateEtape(auth.db, id, parsed.data);
  if (result.ok) revalidatePath(ETAPES_PATH);
  return toActionResult(result, "Étape enregistrée.");
}

/** Déplacement d'un marqueur sur la carte. */
export async function moveEtapeAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "etape");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(moveEtapeSchema, input);
  if (!parsed.ok) return parsed.result;
  const { id, latitude, longitude } = parsed.data;
  const result = await updateEtape(auth.db, id, { latitude, longitude });
  if (result.ok) revalidatePath(ETAPES_PATH);
  return toActionResult(result, "Position enregistrée.");
}

export async function deleteEtapeAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("supprimer", "etape");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await deleteEtape(auth.db, parsed.data.id);
  if (result.ok) revalidatePath(ETAPES_PATH);
  return toActionResult(result, "Étape supprimée.");
}

/* ─── Circuits ───────────────────────────────────────────────────────────────── */

export async function createCircuitAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("creer", "circuit");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(circuitSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await createCircuit(auth.db, auth.user.agenceId, parsed.data);
  if (!result.ok) return toActionResult(result);
  revalidatePath(CIRCUITS_PATH);
  // Suite logique : ajouter les étapes du nouveau circuit.
  redirect(`${CIRCUITS_PATH}/${result.data.id}`);
}

export async function updateCircuitAction(id: string, input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "circuit");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(circuitSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await updateCircuit(auth.db, id, parsed.data);
  if (result.ok) revalidatePath(CIRCUITS_PATH, "layout");
  return toActionResult(result, "Circuit enregistré.");
}

export async function setCircuitStatutAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "circuit");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(circuitStatutSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await setCircuitStatut(auth.db, parsed.data.id, parsed.data.statut);
  if (result.ok) revalidatePath(CIRCUITS_PATH, "layout");
  return toActionResult(result);
}

export async function deleteCircuitAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("supprimer", "circuit");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await deleteCircuit(auth.db, parsed.data.id);
  if (!result.ok) return toActionResult(result);
  revalidatePath(CIRCUITS_PATH);
  redirect(CIRCUITS_PATH);
}

/* ─── Étapes et partenaires d'un circuit (modification du circuit) ───────────── */

export async function addCircuitEtapeAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "circuit");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(addCircuitEtapeSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await addCircuitEtape(auth.db, parsed.data);
  if (result.ok) revalidatePath(CIRCUITS_PATH, "layout");
  return toActionResult(result);
}

export async function updateCircuitEtapeAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "circuit");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(updateCircuitEtapeSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await updateCircuitEtape(auth.db, parsed.data);
  if (result.ok) revalidatePath(CIRCUITS_PATH, "layout");
  return toActionResult(result);
}

export async function moveCircuitEtapeAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "circuit");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(moveCircuitEtapeSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await moveCircuitEtape(auth.db, parsed.data.id, parsed.data.direction);
  if (result.ok) revalidatePath(CIRCUITS_PATH, "layout");
  return toActionResult(result);
}

export async function removeCircuitEtapeAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "circuit");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await removeCircuitEtape(auth.db, parsed.data.id);
  if (result.ok) revalidatePath(CIRCUITS_PATH, "layout");
  return toActionResult(result);
}

export async function addCircuitPartenaireAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "circuit");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(circuitPartenaireSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await addCircuitPartenaire(auth.db, parsed.data);
  if (result.ok) revalidatePath(CIRCUITS_PATH, "layout");
  return toActionResult(result, "Prestation ajoutée.");
}

export async function removeCircuitPartenaireAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "circuit");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await removeCircuitPartenaire(auth.db, parsed.data.id);
  if (result.ok) revalidatePath(CIRCUITS_PATH, "layout");
  return toActionResult(result);
}

/* ─── Tronçons (arêtes du graphe, étape E5) ──────────────────────────────────── */

export async function createTronconAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("creer", "troncon");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(tronconSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await createTroncon(auth.db, auth.user.agenceId, parsed.data);
  if (result.ok) revalidatePath(ETAPES_PATH);
  return toActionResult(result, "Tronçon ajouté.");
}

export async function updateTronconAction(id: string, input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "troncon");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(tronconSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await updateTroncon(auth.db, id, parsed.data);
  if (result.ok) revalidatePath(ETAPES_PATH);
  return toActionResult(result, "Tronçon enregistré.");
}

export async function deleteTronconAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("supprimer", "troncon");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await deleteTroncon(auth.db, parsed.data.id);
  if (result.ok) revalidatePath(ETAPES_PATH);
  return toActionResult(result, "Tronçon supprimé.");
}
