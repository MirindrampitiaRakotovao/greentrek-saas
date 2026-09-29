import { z } from "zod";

import { optionalInt, optionalText, requiredText } from "@/lib/validators/common";

/*
 * Réservation d'un client (§7.2, tunnel) et paiement simulé (§5.2 tables 8, 12 et 13).
 * Le montant n'est jamais envoyé par le navigateur : le serveur le calcule (RG 14).
 */

/** Plafond d'une réservation (en plus des places libres du départ). */
export const MAX_PERSONNES_PAR_RESERVATION = 20;

export const participantSchema = z.object({
  prenom: requiredText(100, "Prénom requis."),
  nom: requiredText(100, "Nom requis."),
  age: optionalInt(0, 120, "L'âge"),
  nationalite: optionalText(100),
  contactUrgence: optionalText(191),
});
export type ParticipantInput = z.infer<typeof participantSchema>;

export const reservationSchema = z.object({
  sessionId: z.string().min(1),
  // RG 12 : au moins une personne ; un participant par personne (décision B de l'étape E9).
  participants: z
    .array(participantSchema)
    .min(1, { error: "Au moins une personne." })
    .max(MAX_PERSONNES_PAR_RESERVATION, {
      error: `${MAX_PERSONNES_PAR_RESERVATION} personnes au maximum par réservation.`,
    }),
  remarques: optionalText(1000),
});
export type ReservationInput = z.infer<typeof reservationSchema>;

export const METHODES_PAIEMENT = ["CARTE_SIMULEE", "MOBILE_MONEY", "VIREMENT", "ESPECES"] as const;
export type MethodePaiementValue = (typeof METHODES_PAIEMENT)[number];

export const METHODE_PAIEMENT_LABELS: Record<MethodePaiementValue, string> = {
  CARTE_SIMULEE: "Carte bancaire (simulée)",
  MOBILE_MONEY: "Mobile Money (simulé)",
  VIREMENT: "Virement bancaire",
  ESPECES: "Espèces à l'agence",
};

export const STATUT_PAIEMENT_LABELS = {
  EN_ATTENTE: "En attente",
  VALIDE: "Validé",
  ECHOUE: "Échoué",
  REMBOURSE: "Remboursé",
} as const;

/** Moyens réglés immédiatement (simulation) ; les autres attendent la validation de l'agence. */
export const PAIEMENT_IMMEDIAT: readonly MethodePaiementValue[] = ["CARTE_SIMULEE", "MOBILE_MONEY"];

/**
 * Numéro de test : un numéro (carte ou téléphone) qui se termine par 0000 simule un refus,
 * pour montrer ce cas pendant la démonstration (décision A de l'étape E9).
 */
export const NUMERO_REFUSE_SUFFIXE = "0000";

export const paiementSchema = z
  .object({
    reservationId: z.string().min(1),
    methode: z.enum(METHODES_PAIEMENT, { error: "Choisissez un moyen de paiement." }),
    // Numéro simulé : chiffres et espaces, jamais conservé (seuls les 4 derniers chiffres).
    numero: z
      .string()
      .trim()
      .transform((value) => value.replace(/\s+/g, ""))
      .pipe(z.string().regex(/^\d*$/, { error: "Chiffres uniquement." }))
      .optional(),
  })
  .refine(
    (data) => {
      if (data.methode === "CARTE_SIMULEE") return /^\d{16}$/.test(data.numero ?? "");
      if (data.methode === "MOBILE_MONEY") return /^\d{10}$/.test(data.numero ?? "");
      return true;
    },
    {
      error: "Numéro invalide (carte : 16 chiffres ; Mobile Money : 10 chiffres).",
      path: ["numero"],
    },
  );
export type PaiementInput = z.infer<typeof paiementSchema>;
