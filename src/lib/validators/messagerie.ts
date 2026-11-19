import { z } from "zod";

import { optionalText, requiredText } from "@/lib/validators/common";

/* Messagerie entre les voyageurs, l'agence et les guides (ajoutée après E12). */

export const MESSAGE_MAX = 2000;

const contenu = requiredText(MESSAGE_MAX, "Écrivez votre message.");

export const messageSchema = z.object({
  conversationId: z.string().min(1),
  contenu,
});
export type MessageInput = z.infer<typeof messageSchema>;

/** Nouvelle conversation : liée à une réservation, ou question générale d'un client. */
export const startConversationSchema = z.object({
  reservationId: z
    .string()
    .nullable()
    .transform((value) => (value ? value : null)),
  sujet: optionalText(200),
  contenu,
});
export type StartConversationInput = z.infer<typeof startConversationSchema>;

export const conversationIdSchema = z.object({ conversationId: z.string().min(1) });

/* ─── Voyageurs entre eux (étape 5c) ───────────────────────────────────────────── */

export const privateMessageSchema = z.object({
  destinataireId: z.string().min(1),
  contenu,
});

export const reportMessageSchema = z.object({
  messageId: z.string().min(1),
  motif: optionalText(500),
});

export const privacySchema = z.object({
  presenceVisible: z.boolean(),
  messagesVoyageurs: z.boolean(),
});

export const userIdSchema = z.object({ id: z.string().min(1) });
