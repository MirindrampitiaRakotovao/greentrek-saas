"use server";

import { redirect } from "next/navigation";

import { parseInput, toActionResult } from "@/lib/actions/helpers";
import type { ActionResult } from "@/lib/actions/types";
import type { AuthUser } from "@/lib/auth/authenticate";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import {
  markConversationRead,
  sendMessage,
  startConversation,
  type Viewer,
} from "@/lib/services/messagerie";
import { getTenantDb, type TenantDb } from "@/lib/tenant";
import {
  conversationIdSchema,
  messageSchema,
  startConversationSchema,
} from "@/lib/validators/messagerie";

/*
 * Actions de la messagerie (après E12), communes au back-office, à l'espace du guide et à
 * l'espace client : session relue en base → permission (matrice) → Zod → service, qui
 * applique la portée de chaque rôle (ses conversations seulement).
 */

type MessagingContext = { user: AuthUser & { agenceId: string }; viewer: Viewer; db: TenantDb };

async function messagingContext(): Promise<MessagingContext | null> {
  const user = await getCurrentUser();
  if (!user?.agenceId || !can(user.role, "creer", "message")) return null;
  return {
    user: { ...user, agenceId: user.agenceId },
    viewer: { id: user.id, role: user.role },
    db: getTenantDb(user.agenceId),
  };
}

/** Adresse du fil d'une conversation, selon l'espace de l'utilisateur. */
function threadPath(user: AuthUser, conversationId: string): string {
  return user.role === "CLIENT" && user.agenceSlug
    ? `/a/${user.agenceSlug}/mon-compte/messages/${conversationId}`
    : `/dashboard/messages/${conversationId}`;
}

const REFUS: ActionResult = { error: "Session expirée ou accès refusé." };

export async function sendMessageAction(input: unknown): Promise<ActionResult> {
  const ctx = await messagingContext();
  if (!ctx) return REFUS;
  const parsed = parseInput(messageSchema, input);
  if (!parsed.ok) return parsed.result;
  return toActionResult(await sendMessage(ctx.db, ctx.viewer, parsed.data));
}

/** Nouvelle conversation (ou message ajouté à celle de la réservation), puis ouverture du fil. */
export async function startConversationAction(input: unknown): Promise<ActionResult> {
  const ctx = await messagingContext();
  if (!ctx) return REFUS;
  const parsed = parseInput(startConversationSchema, input);
  if (!parsed.ok) return parsed.result;
  const result = await startConversation(ctx.db, ctx.viewer, {
    ...parsed.data,
    agenceId: ctx.user.agenceId,
  });
  if (!result.ok) return toActionResult(result);
  redirect(threadPath(ctx.user, result.data.conversationId));
}

/** Conversation ouverte : lue jusqu'à maintenant (appelée par le fil, pas par le rendu). */
export async function markConversationReadAction(input: unknown): Promise<ActionResult> {
  const ctx = await messagingContext();
  if (!ctx) return REFUS;
  const parsed = parseInput(conversationIdSchema, input);
  if (!parsed.ok) return parsed.result;
  return toActionResult(await markConversationRead(ctx.db, ctx.viewer, parsed.data.conversationId));
}
