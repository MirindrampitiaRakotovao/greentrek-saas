"use server";

import { revalidatePath } from "next/cache";

import { authorize, journal, parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { getClientContext, getCurrentUser } from "@/lib/auth/session";
import { getAdminDb } from "@/lib/admin-db";
import { createAvis, moderateAvis } from "@/lib/services/avis";
import { markNotificationsRead } from "@/lib/services/notifications";
import { getTenantDb } from "@/lib/tenant";
import { avisSchema, moderationSchema, notificationsReadSchema } from "@/lib/validators/avis";

/* Avis des voyageurs et notifications (étape E12). */

/** Dépôt d'un avis par le client titulaire d'une réservation terminée (RG 17). */
export async function createAvisAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return { error: "Connectez-vous avec votre compte voyageur." };
  const parsed = parseInput(avisSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await createAvis(ctx.db, {
    ...parsed.data,
    agenceId: ctx.user.agenceId,
    clientId: ctx.user.id,
  });
  if (result.ok) revalidatePath(`/a/${ctx.user.agenceSlug}`, "layout");
  return toActionResult(
    result,
    "Merci pour votre avis ! Il sera publié après relecture par l'agence.",
  );
}

/** Modération par l'agence (ADMIN_AGENCE, STAFF : matrice §3). */
export async function moderateAvisAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("moderer", "avis");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(moderationSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await moderateAvis(auth.db, parsed.data.id, parsed.data.statut);
  if (!result.ok) return toActionResult(result);
  await journal(auth, "AVIS_MODERE", "Avis", parsed.data.id, { statut: parsed.data.statut });
  revalidatePath("/dashboard", "layout");
  revalidatePath("/a", "layout"); // le site vitrine affiche les avis publiés
  return { success: parsed.data.statut === "PUBLIE" ? "Avis publié." : "Avis rejeté." };
}

/** Marque comme lues les notifications de l'utilisateur connecté (toutes ou certaines). */
export async function markNotificationsReadAction(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Session expirée." };
  const parsed = parseInput(notificationsReadSchema, input);
  if (!parsed.ok) return parsed.result;
  // Seules les notifications de l'utilisateur lui-même sont touchées (filtre utilisateurId).
  const db = user.agenceId ? getTenantDb(user.agenceId) : getAdminDb();
  await markNotificationsRead(db, user.id, parsed.data.ids);
  revalidatePath("/", "layout");
  return {};
}

/** Raccourcis pour les boutons de la page de modération (entrée : l'identifiant seul). */
export async function publishAvisAction(input: { id: string }): Promise<ActionResult> {
  return moderateAvisAction({ id: input.id, statut: "PUBLIE" });
}

export async function rejectAvisAction(input: { id: string }): Promise<ActionResult> {
  return moderateAvisAction({ id: input.id, statut: "REJETE" });
}
