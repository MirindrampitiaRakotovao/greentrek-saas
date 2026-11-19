"use server";

import { revalidatePath } from "next/cache";

import { parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { getAdminDb } from "@/lib/admin-db";
import { getClientContext, getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import {
  addCommentaire,
  createPublication,
  deleteCommentaire,
  deletePublication,
  dismissReport,
  hideReportedContent,
  reportContent,
  restoreReportedContent,
  setJaime,
} from "@/lib/services/communaute";
import { logPlatformActivity } from "@/lib/services/journal";
import type { ServiceResult } from "@/lib/services/result";
import { deleteImage, fileToBuffer, saveImage, UploadError } from "@/lib/uploads";
import {
  commentaireSchema,
  idSchema,
  jaimeSchema,
  PHOTOS_MAX,
  publicationSchema,
  reportContentSchema,
} from "@/lib/validators/communaute";

/*
 * Communauté (étape 5d). Côté voyageur : session relue en base (`getClientContext`), il
 * n'agit que sur SES contenus. Côté plateforme : modération réservée au super admin.
 */

const NOT_CLIENT: ActionResult = { error: "Connectez-vous avec votre compte voyageur." };

function revalidateFeed(slug: string) {
  revalidatePath(`/a/${slug}/mon-compte/communaute`, "layout");
}

/** Nouvelle publication (`FormData` : reservationId, legende, photos ×1 à 4). */
export async function createPublicationAction(formData: FormData): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(publicationSchema, {
    reservationId: formData.get("reservationId"),
    legende: formData.get("legende") || null,
  });
  if (!parsed.ok) return parsed.result;
  const files = formData.getAll("photos").filter((f) => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Ajoutez au moins une photo." };
  if (files.length > PHOTOS_MAX) return { error: `${PHOTOS_MAX} photos au maximum.` };

  const saved: string[] = [];
  try {
    for (const file of files) saved.push(await saveImage(await fileToBuffer(file), "publications"));
  } catch (error: unknown) {
    await Promise.all(saved.map((url) => deleteImage(url)));
    if (error instanceof UploadError) return { error: error.message };
    throw error;
  }
  const result = await createPublication(ctx.user.id, { ...parsed.data, photos: saved });
  if (!result.ok) await Promise.all(saved.map((url) => deleteImage(url)));
  else revalidateFeed(ctx.user.agenceSlug);
  return toActionResult(result, "Publication partagée avec la communauté.");
}

export async function deletePublicationAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await deletePublication(ctx.user.id, parsed.data.id);
  if (result.ok) {
    await Promise.all(result.data.photos.map((url) => deleteImage(url)));
    revalidateFeed(ctx.user.agenceSlug);
  }
  return toActionResult(result, "Publication supprimée.");
}

export async function setJaimeAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(jaimeSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await setJaime(ctx.user.id, parsed.data.publicationId, parsed.data.jaime);
  return toActionResult(result);
}

export async function addCommentaireAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(commentaireSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await addCommentaire(ctx.user.id, parsed.data);
  if (result.ok) revalidateFeed(ctx.user.agenceSlug);
  return toActionResult(result, "Commentaire publié.");
}

export async function deleteCommentaireAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await deleteCommentaire(ctx.user.id, parsed.data.id);
  if (result.ok) revalidateFeed(ctx.user.agenceSlug);
  return toActionResult(result, "Commentaire supprimé.");
}

export async function reportContentAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(reportContentSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await reportContent(ctx.user.id, parsed.data);
  return toActionResult(result, "Merci : l'équipe de la plateforme va examiner ce contenu.");
}

/* ─── Modération (super admin) ───────────────────────────────────────────────── */

async function moderate(
  input: unknown,
  run: (id: string) => Promise<ServiceResult>,
  action: "COMMUNAUTE_MASQUE" | "COMMUNAUTE_RETABLI" | "COMMUNAUTE_CLASSE",
  success: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.role !== "SUPER_ADMIN" || !can(user.role, "moderer", "communaute")) {
    return { error: "Vous n'avez pas les droits nécessaires pour cette action." };
  }
  const parsed = parseInput(idSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await run(parsed.data.id);
  if (result.ok) {
    await logPlatformActivity(getAdminDb(), null, {
      utilisateurId: user.id,
      action,
      entite: "SignalementCommunaute",
      entiteId: parsed.data.id,
    });
    revalidatePath("/admin", "layout");
    revalidatePath("/a", "layout");
  }
  return toActionResult(result, success);
}

export async function hideReportedContentAction(input: unknown): Promise<ActionResult> {
  return moderate(input, (id) => hideReportedContent(id), "COMMUNAUTE_MASQUE", "Contenu masqué.");
}

export async function restoreReportedContentAction(input: unknown): Promise<ActionResult> {
  return moderate(
    input,
    (id) => restoreReportedContent(id),
    "COMMUNAUTE_RETABLI",
    "Contenu de nouveau visible.",
  );
}

export async function dismissReportAction(input: unknown): Promise<ActionResult> {
  return moderate(input, (id) => dismissReport(id), "COMMUNAUTE_CLASSE", "Signalement classé.");
}
