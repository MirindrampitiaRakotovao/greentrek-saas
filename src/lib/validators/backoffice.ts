import { z } from "zod";

import {
  checkbox,
  checkboxGroup,
  optionalEmail,
  optionalInt,
  optionalNumber,
  optionalPhone,
  optionalText,
  optionalImageUrl,
  optionalUrl,
  requiredText,
} from "@/lib/validators/common";

/* ─── Paramètres de l'agence (§7.3) ──────────────────────────────────────────── */

export const DEVISES = ["MGA", "EUR", "USD"] as const;
export const DEVISE_LABELS: Record<(typeof DEVISES)[number], string> = {
  MGA: "Ariary (MGA)",
  EUR: "Euro (EUR)",
  USD: "Dollar américain (USD)",
};

export const agencySettingsSchema = z.object({
  nom: requiredText(150),
  description: optionalText(2000),
  email: optionalEmail,
  telephone: optionalPhone,
  adresse: optionalText(255),
  ville: optionalText(100),
  pays: optionalText(100),
  devise: z.enum(DEVISES, { error: "Devise invalide." }),
  logoUrl: optionalUrl,
});
export type AgencySettingsInput = z.infer<typeof agencySettingsSchema>;

/* ─── Partenaires (§5.2, table 10) ───────────────────────────────────────────── */

export const TYPES_PARTENAIRE = ["HEBERGEMENT", "RESTAURATION", "ACTIVITE", "TRANSPORT"] as const;
export const TYPE_PARTENAIRE_LABELS: Record<(typeof TYPES_PARTENAIRE)[number], string> = {
  HEBERGEMENT: "Hébergement",
  RESTAURATION: "Restauration",
  ACTIVITE: "Activité",
  TRANSPORT: "Transport",
};

/** Coordonnées GPS : les deux ou aucune. */
function bothOrNone(data: { latitude: number | null; longitude: number | null }) {
  return (data.latitude === null) === (data.longitude === null);
}

export const partenaireSchema = z
  .object({
    nom: requiredText(150),
    type: z.enum(TYPES_PARTENAIRE, { error: "Type invalide." }),
    description: optionalText(2000),
    telephone: optionalPhone,
    email: optionalEmail,
    adresse: optionalText(255),
    latitude: optionalNumber(-90, 90, "La latitude"),
    longitude: optionalNumber(-180, 180, "La longitude"),
    tarifIndicatif: optionalInt(0, 100_000_000, "Le tarif"),
    imageUrl: optionalImageUrl,
    actif: checkbox,
  })
  .refine(bothOrNone, {
    error: "Renseignez la latitude et la longitude, ou aucune des deux.",
    path: ["longitude"],
  });
export type PartenaireInput = z.infer<typeof partenaireSchema>;

/* ─── Guides (§5.2, table 9) ─────────────────────────────────────────────────── */

export const LANGUES = ["fr", "mg", "en", "de", "it", "es", "zh"] as const;
export const LANGUE_LABELS: Record<(typeof LANGUES)[number], string> = {
  fr: "Français",
  mg: "Malagasy",
  en: "Anglais",
  de: "Allemand",
  it: "Italien",
  es: "Espagnol",
  zh: "Chinois",
};

export const guideSchema = z.object({
  prenom: requiredText(100),
  nom: requiredText(100),
  telephone: optionalPhone,
  bio: optionalText(2000),
  langues: checkboxGroup(LANGUES),
  experienceAnnees: optionalInt(0, 80, "L'expérience"),
  actif: checkbox,
  /** Compte utilisateur GUIDE à relier (facultatif : un guide peut ne pas avoir de compte). */
  utilisateurId: z
    .string()
    .nullable()
    .transform((value) => (value ? value : null)),
});
export type GuideInput = z.infer<typeof guideSchema>;

/** Identifiant seul (suppression). */
export const idSchema = z.object({ id: z.string().min(1) });
