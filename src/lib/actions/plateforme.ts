"use server";

import { revalidatePath } from "next/cache";

import { parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { getCurrentUser } from "@/lib/auth/session";
import { type Action, can, type Resource } from "@/lib/permissions";
import {
  assignPlan,
  createPlan,
  setAgenceStatut,
  setPlanActif,
  updatePlan,
} from "@/lib/services/plateforme";
import {
  agenceStatutSchema,
  assignPlanSchema,
  planActifSchema,
  planSchema,
} from "@/lib/validators/plateforme";

/*
 * Actions de la console super admin (§7.4, étape E11). Chaque action relit la session en
 * base (`getCurrentUser`) et exige le rôle SUPER_ADMIN et la permission de la matrice §3 avant
 * d'utiliser le client non confiné (dans les services de `plateforme.ts`).
 */

async function authorizeSuperAdmin(
  action: Action,
  resource: Resource,
): Promise<ActionResult | null> {
  const user = await getCurrentUser();
  if (user?.role !== "SUPER_ADMIN" || !can(user.role, action, resource)) {
    return { error: "Vous n'avez pas les droits nécessaires pour cette action." };
  }
  return null;
}

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
  revalidatePath("/tarifs");
}

export async function setAgenceStatutAction(input: unknown): Promise<ActionResult> {
  const refus = await authorizeSuperAdmin("modifier", "agence");
  if (refus) return refus;
  const parsed = parseInput(agenceStatutSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await setAgenceStatut(parsed.data.id, parsed.data.statut);
  if (result.ok) {
    revalidateAdmin();
    revalidatePath("/a", "layout"); // site vitrine : disponible ou non (RG 19)
  }
  return toActionResult(
    result,
    parsed.data.statut === "SUSPENDUE"
      ? "Agence suspendue : son équipe et son site ne sont plus accessibles."
      : "Agence réactivée.",
  );
}

export async function assignPlanAction(input: unknown): Promise<ActionResult> {
  const refus = await authorizeSuperAdmin("modifier", "abonnement");
  if (refus) return refus;
  const parsed = parseInput(assignPlanSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await assignPlan(parsed.data);
  if (result.ok) {
    revalidateAdmin();
    revalidatePath("/dashboard", "layout"); // l'agence voit son nouveau plan
  }
  return toActionResult(result, "Plan attribué : les nouvelles limites s'appliquent.");
}

export async function createPlanAction(input: unknown): Promise<ActionResult> {
  const refus = await authorizeSuperAdmin("creer", "plan");
  if (refus) return refus;
  const parsed = parseInput(planSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await createPlan(parsed.data);
  if (result.ok) revalidateAdmin();
  return toActionResult(result, "Plan créé.");
}

export async function updatePlanAction(id: string, input: unknown): Promise<ActionResult> {
  const refus = await authorizeSuperAdmin("modifier", "plan");
  if (refus) return refus;
  const parsed = parseInput(planSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await updatePlan(id, parsed.data);
  if (result.ok) {
    revalidateAdmin();
    revalidatePath("/dashboard", "layout");
  }
  return toActionResult(result, "Plan enregistré.");
}

export async function setPlanActifAction(input: unknown): Promise<ActionResult> {
  const refus = await authorizeSuperAdmin("modifier", "plan");
  if (refus) return refus;
  const parsed = parseInput(planActifSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await setPlanActif(parsed.data.id, parsed.data.actif);
  if (result.ok) revalidateAdmin();
  return toActionResult(result, parsed.data.actif ? "Plan réactivé." : "Plan désactivé.");
}
