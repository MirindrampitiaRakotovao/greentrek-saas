"use server";

import { revalidatePath } from "next/cache";

import { forbiddenToResult, journal, parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { requireAgencyUser } from "@/lib/auth/session";
import { assertCan } from "@/lib/permissions";
import {
  changePassword,
  createMember,
  setMemberActive,
  updateMember,
  updateProfile,
} from "@/lib/services/team";
import {
  changePasswordSchema,
  createMemberSchema,
  setMemberActiveSchema,
  updateMemberSchema,
  updateProfileSchema,
} from "@/lib/validators/team";

/*
 * Actions serveur de l'équipe et du profil. Chaque action suit le même schéma :
 * 1. session relue en base + client confiné à l'agence (`requireAgencyUser`) ;
 * 2. permission du rôle (`assertCan`, matrice §3) ;
 * 3. validation Zod de l'entrée (le navigateur n'est jamais cru sur parole) ;
 * 4. appel du service métier, qui applique les règles de gestion.
 */

const TEAM_PATH = "/dashboard/equipe";

export async function createMemberAction(input: unknown): Promise<ActionResult> {
  const { user, db } = await requireAgencyUser();
  try {
    assertCan(user.role, "creer", "utilisateur");
  } catch (error: unknown) {
    return forbiddenToResult(error);
  }
  const parsed = parseInput(createMemberSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await createMember(db, user.agenceId, parsed.data);
  if (result.ok) {
    await journal({ user, db }, "MEMBRE_AJOUTE", "Utilisateur", undefined, {
      role: parsed.data.role,
    });
    revalidatePath(TEAM_PATH);
  }
  // Formulaire en modale sur la liste : message de succès, pas de redirection.
  return toActionResult(result, "Membre ajouté à l'équipe.");
}

export async function updateMemberAction(input: unknown): Promise<ActionResult> {
  const { user, db } = await requireAgencyUser();
  try {
    assertCan(user.role, "modifier", "utilisateur");
  } catch (error: unknown) {
    return forbiddenToResult(error);
  }
  const parsed = parseInput(updateMemberSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await updateMember(db, user.agenceId, user.id, parsed.data);
  if (result.ok) revalidatePath(TEAM_PATH);
  return toActionResult(result, "Modifications enregistrées.");
}

export async function setMemberActiveAction(input: unknown): Promise<ActionResult> {
  const { user, db } = await requireAgencyUser();
  try {
    assertCan(user.role, "modifier", "utilisateur");
  } catch (error: unknown) {
    return forbiddenToResult(error);
  }
  const parsed = parseInput(setMemberActiveSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await setMemberActive(db, user.id, parsed.data.id, parsed.data.actif);
  if (result.ok) {
    await journal({ user, db }, "MEMBRE_ACTIVATION", "Utilisateur", parsed.data.id, {
      actif: parsed.data.actif,
    });
    revalidatePath(TEAM_PATH);
  }
  return toActionResult(result, parsed.data.actif ? "Compte réactivé." : "Compte désactivé.");
}

/** Profil personnel : tout membre du personnel peut modifier SON propre profil. */
export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const { user, db } = await requireAgencyUser();
  const parsed = parseInput(updateProfileSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await updateProfile(db, user.id, parsed.data);
  if (result.ok) revalidatePath("/dashboard", "layout"); // le nom apparaît dans le menu
  return toActionResult(result, "Profil mis à jour.");
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const { user, db } = await requireAgencyUser();
  const parsed = parseInput(changePasswordSchema, input);
  if (!parsed.ok) return parsed.result;

  const result = await changePassword(db, user.id, parsed.data);
  return toActionResult(result, "Mot de passe modifié.");
}
