import { z } from "zod";

import { requiredInt, requiredText } from "@/lib/validators/common";

/*
 * Console super admin (§7.4, étape E11) : plans fictifs, attribution d'un plan, suspension.
 */

/** Fonctionnalités d'un plan : une par ligne dans le formulaire, tableau en base (JSON). */
const fonctionnalites = z.preprocess(
  (value) =>
    Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
        : [],
  z
    .array(z.string().trim().min(1).max(80, { error: "80 caractères au maximum par ligne." }))
    .max(12, { error: "12 fonctionnalités au maximum." }),
);

export const planSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,29}$/, {
      error: "Majuscules, chiffres et _ (2 à 30 caractères, commence par une lettre).",
    }),
  nom: requiredText(100),
  prixMensuel: requiredInt(0, 100_000_000, "Le prix"),
  maxCircuits: requiredInt(1, 10_000, "Le nombre de circuits"),
  maxUtilisateurs: requiredInt(1, 10_000, "Le nombre de comptes"),
  maxSessionsActives: requiredInt(1, 100_000, "Le nombre de départs actifs"),
  fonctionnalites,
});
export type PlanInput = z.infer<typeof planSchema>;

export const DUREES_ABONNEMENT = ["1", "3", "6", "12", "illimitee"] as const;
export const DUREE_LABELS: Record<(typeof DUREES_ABONNEMENT)[number], string> = {
  "1": "1 mois",
  "3": "3 mois",
  "6": "6 mois",
  "12": "12 mois",
  illimitee: "Sans échéance",
};

export const assignPlanSchema = z.object({
  agenceId: z.string().min(1),
  planId: z.string().min(1, { error: "Choisissez un plan." }),
  duree: z.enum(DUREES_ABONNEMENT, { error: "Choisissez une durée." }),
  statut: z.enum(["ACTIF", "ESSAI"], { error: "Statut invalide." }),
});
export type AssignPlanInput = z.infer<typeof assignPlanSchema>;

export const agenceStatutSchema = z.object({
  id: z.string().min(1),
  statut: z.enum(["ACTIVE", "SUSPENDUE"]),
});

export const planActifSchema = z.object({ id: z.string().min(1), actif: z.boolean() });
