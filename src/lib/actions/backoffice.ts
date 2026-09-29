"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorize, parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { updateAgencySettings } from "@/lib/services/agency-settings";
import { createGuide, deleteGuide, updateGuide } from "@/lib/services/guides";
import { createPartenaire, deletePartenaire, updatePartenaire } from "@/lib/services/partenaires";
import {
  agencySettingsSchema,
  guideSchema,
  idSchema,
  partenaireSchema,
} from "@/lib/validators/backoffice";

/*
 * Actions serveur des paramètres, partenaires et guides. Même schéma que l'équipe (E3a) :
 * session relue en base + client confiné → permission du rôle → validation Zod → service.
 */

/* ─── Paramètres ─────────────────────────────────────────────────────────────── */

export async function updateAgencySettingsAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "agence");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(agencySettingsSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await updateAgencySettings(auth.db, auth.user.agenceId, parsed.data);
  if (result.ok) revalidatePath("/dashboard", "layout"); // le nom apparaît dans le menu
  return toActionResult(result, "Paramètres enregistrés.");
}

/* ─── Partenaires ────────────────────────────────────────────────────────────── */

const PARTENAIRES_PATH = "/dashboard/partenaires";

export async function createPartenaireAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("creer", "partenaire");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(partenaireSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await createPartenaire(auth.db, auth.user.agenceId, parsed.data);
  if (!result.ok) return toActionResult(result);
  revalidatePath(PARTENAIRES_PATH);
  redirect(PARTENAIRES_PATH);
}

export async function updatePartenaireAction(id: string, input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "partenaire");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(partenaireSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await updatePartenaire(auth.db, id, parsed.data);
  if (result.ok) revalidatePath(PARTENAIRES_PATH);
  return toActionResult(result, "Partenaire enregistré.");
}

export async function deletePartenaireAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("supprimer", "partenaire");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await deletePartenaire(auth.db, parsed.data.id);
  if (!result.ok) return toActionResult(result);
  revalidatePath(PARTENAIRES_PATH);
  redirect(PARTENAIRES_PATH);
}

/* ─── Guides ─────────────────────────────────────────────────────────────────── */

const GUIDES_PATH = "/dashboard/guides";

export async function createGuideAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("creer", "guide");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(guideSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await createGuide(auth.db, auth.user.agenceId, parsed.data);
  if (!result.ok) return toActionResult(result);
  revalidatePath(GUIDES_PATH);
  redirect(GUIDES_PATH);
}

export async function updateGuideAction(id: string, input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "guide");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(guideSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await updateGuide(auth.db, id, parsed.data);
  if (result.ok) revalidatePath(GUIDES_PATH);
  return toActionResult(result, "Fiche enregistrée.");
}

export async function deleteGuideAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("supprimer", "guide");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await deleteGuide(auth.db, parsed.data.id);
  if (!result.ok) return toActionResult(result);
  revalidatePath(GUIDES_PATH);
  redirect(GUIDES_PATH);
}
