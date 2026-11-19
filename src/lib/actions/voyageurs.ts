"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { authorize, journal, parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import { getClientContext } from "@/lib/auth/session";
import { startPrivateConversation } from "@/lib/services/messagerie";
import {
  blockUser,
  deactivateClient,
  reportMessage,
  treatSignalement,
  unblockUser,
  updatePrivacy,
} from "@/lib/services/voyageurs";
import {
  privacySchema,
  privateMessageSchema,
  reportMessageSchema,
  userIdSchema,
} from "@/lib/validators/messagerie";

/*
 * Voyageurs entre eux (étape 5c). Côté voyageur : session relue en base, SES conversations et
 * SES réglages. Côté agence : signalements (modération) et désactivation d'un compte abusif.
 */

const NOT_CLIENT: ActionResult = { error: "Connectez-vous avec votre compte voyageur." };

/** Premier message à un autre voyageur de l'agence, puis ouverture de la conversation. */
export async function startPrivateConversationAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(privateMessageSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await startPrivateConversation(
    ctx.db,
    { id: ctx.user.id, role: ctx.user.role },
    { ...parsed.data, agenceId: ctx.user.agenceId },
  );
  if (!result.ok) return toActionResult(result);
  redirect(`/a/${ctx.user.agenceSlug}/mon-compte/messages/${result.data.conversationId}`);
}

export async function blockUserAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(userIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await blockUser(ctx.db, {
    agenceId: ctx.user.agenceId,
    bloqueurId: ctx.user.id,
    bloqueId: parsed.data.id,
  });
  if (result.ok) revalidatePath(`/a/${ctx.user.agenceSlug}/mon-compte`, "layout");
  return toActionResult(result, "Voyageur bloqué : vous ne recevrez plus ses messages.");
}

export async function unblockUserAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(userIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await unblockUser(ctx.db, ctx.user.id, parsed.data.id);
  if (result.ok) revalidatePath(`/a/${ctx.user.agenceSlug}/mon-compte`, "layout");
  return toActionResult(result, "Voyageur débloqué.");
}

export async function reportMessageAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(reportMessageSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await reportMessage(ctx.db, {
    ...parsed.data,
    agenceId: ctx.user.agenceId,
    auteurId: ctx.user.id,
  });
  return toActionResult(result, "Merci : l'agence va examiner ce message.");
}

export async function updatePrivacyAction(input: unknown): Promise<ActionResult> {
  const ctx = await getClientContext();
  if (!ctx) return NOT_CLIENT;
  const parsed = parseInput(privacySchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await updatePrivacy(ctx.db, ctx.user.id, parsed.data);
  if (result.ok) revalidatePath(`/a/${ctx.user.agenceSlug}/mon-compte`, "layout");
  return toActionResult(result, "Réglages enregistrés.");
}

/** Signalement traité (administrateur et personnel : droit de modération). */
export async function treatSignalementAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("moderer", "avis");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(userIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await treatSignalement(auth.db, parsed.data.id);
  if (result.ok) {
    await journal(auth, "SIGNALEMENT_TRAITE", "Signalement", parsed.data.id);
    revalidatePath("/dashboard/signalements");
  }
  return toActionResult(result, "Signalement traité.");
}

/** Désactivation du compte d'un voyageur abusif (administrateur de l'agence). */
export async function deactivateClientAction(input: unknown): Promise<ActionResult> {
  const auth = await authorize("modifier", "utilisateur");
  if (!auth.ok) return auth.result;
  const parsed = parseInput(userIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await deactivateClient(auth.db, parsed.data.id);
  if (result.ok) {
    await journal(auth, "CLIENT_DESACTIVE", "Utilisateur", parsed.data.id);
    revalidatePath("/dashboard/signalements");
  }
  return toActionResult(result, "Compte du voyageur désactivé.");
}
