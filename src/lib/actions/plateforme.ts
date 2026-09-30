"use server";

import { revalidatePath } from "next/cache";

import { parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { getAdminDb } from "@/lib/admin-db";
import { getCurrentUser } from "@/lib/auth/session";
import { type Action, can, type Resource } from "@/lib/permissions";
import {
  assignPlan,
  createPlan,
  setAgenceStatut,
  setPlanActif,
  updatePlan,
} from "@/lib/services/plateforme";
import { type ActivityInput, logPlatformActivity } from "@/lib/services/journal";
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

type SuperAdminAuth = { ok: true; userId: string } | { ok: false; result: ActionResult };

async function authorizeSuperAdmin(action: Action, resource: Resource): Promise<SuperAdminAuth> {
  const user = await getCurrentUser();
  if (user?.role !== "SUPER_ADMIN" || !can(user.role, action, resource)) {
    return {
      ok: false,
      result: { error: "Vous n'avez pas les droits nécessaires pour cette action." },
    };
  }
  return { ok: true, userId: user.id };
}

/** Journal d'activité de la plateforme (`agenceId` = agence concernée, ou null). */
async function journalPlateforme(
  auth: { userId: string },
  agenceId: string | null,
  input: Omit<ActivityInput, "utilisateurId">,
): Promise<void> {
  await logPlatformActivity(getAdminDb(), agenceId, { ...input, utilisateurId: auth.userId });
}

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
  revalidatePath("/tarifs");
}

export async function setAgenceStatutAction(input: unknown): Promise<ActionResult> {
  const auth = await authorizeSuperAdmin("modifier", "agence");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(agenceStatutSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await setAgenceStatut(parsed.data.id, parsed.data.statut);
  if (result.ok) {
    await journalPlateforme(auth, parsed.data.id, {
      action: "AGENCE_STATUT",
      entite: "Agence",
      entiteId: parsed.data.id,
      details: { statut: parsed.data.statut },
    });
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
  const auth = await authorizeSuperAdmin("modifier", "abonnement");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(assignPlanSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await assignPlan(parsed.data);
  if (result.ok) {
    await journalPlateforme(auth, parsed.data.agenceId, {
      action: "PLAN_ATTRIBUE",
      entite: "Abonnement",
      details: { planId: parsed.data.planId },
    });
    revalidateAdmin();
    revalidatePath("/dashboard", "layout"); // l'agence voit son nouveau plan
  }
  return toActionResult(result, "Plan attribué : les nouvelles limites s'appliquent.");
}

export async function createPlanAction(input: unknown): Promise<ActionResult> {
  const auth = await authorizeSuperAdmin("creer", "plan");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(planSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await createPlan(parsed.data);
  if (result.ok) {
    await journalPlateforme(auth, null, {
      action: "PLAN_MODIFIE",
      entite: "Plan",
      details: { code: parsed.data.code },
    });
    revalidateAdmin();
  }
  return toActionResult(result, "Plan créé.");
}

export async function updatePlanAction(id: string, input: unknown): Promise<ActionResult> {
  const auth = await authorizeSuperAdmin("modifier", "plan");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(planSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await updatePlan(id, parsed.data);
  if (result.ok) {
    await journalPlateforme(auth, null, { action: "PLAN_MODIFIE", entite: "Plan", entiteId: id });
    revalidateAdmin();
    revalidatePath("/dashboard", "layout");
  }
  return toActionResult(result, "Plan enregistré.");
}

export async function setPlanActifAction(input: unknown): Promise<ActionResult> {
  const auth = await authorizeSuperAdmin("modifier", "plan");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(planActifSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await setPlanActif(parsed.data.id, parsed.data.actif);
  if (result.ok) revalidateAdmin();
  return toActionResult(result, parsed.data.actif ? "Plan réactivé." : "Plan désactivé.");
}
