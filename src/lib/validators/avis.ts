import { z } from "zod";

import { optionalText, requiredInt } from "@/lib/validators/common";

/* Avis des voyageurs (§5.2 table 17, étape E12). */

export const avisSchema = z.object({
  reservationId: z.string().min(1),
  note: requiredInt(1, 5, "La note"),
  commentaire: optionalText(1000),
});
export type AvisInput = z.infer<typeof avisSchema>;

export const moderationSchema = z.object({
  id: z.string().min(1),
  statut: z.enum(["PUBLIE", "REJETE"]),
});

export const STATUT_AVIS_LABELS = {
  EN_ATTENTE: "À modérer",
  PUBLIE: "Publié",
  REJETE: "Rejeté",
} as const;

export const avisFiltersSchema = z.object({
  statut: z.enum(["EN_ATTENTE", "PUBLIE", "REJETE"]).optional().catch(undefined),
});

export const notificationsReadSchema = z.object({
  ids: z.array(z.string().min(1)).max(100).optional(),
});
