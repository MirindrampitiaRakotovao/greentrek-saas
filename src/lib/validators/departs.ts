import { z } from "zod";

import { optionalInt, optionalText, requiredInt } from "@/lib/validators/common";

/*
 * Départs (SessionDepart, §5.2 table 7) : l'objet « disponibilité » d'un circuit.
 * Les dates restent des chaînes « AAAA-MM-JJ » dans le schéma (valeur d'un champ date,
 * validation idempotente) ; le service les convertit en dates SQL.
 */

export const STATUTS_SESSION = ["OUVERTE", "COMPLETE", "ANNULEE", "TERMINEE"] as const;
export type StatutSessionValue = (typeof STATUTS_SESSION)[number];

export const STATUT_SESSION_LABELS: Record<StatutSessionValue, string> = {
  OUVERTE: "Ouvert",
  COMPLETE: "Complet",
  ANNULEE: "Annulé",
  TERMINEE: "Terminé",
};

/** Date calendaire « AAAA-MM-JJ » existante (refuse par exemple le 30 février). */
function isoDate(label: string) {
  return z
    .string({ error: `${label} est requise.` })
    .trim()
    .min(1, { error: `${label} est requise.` })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Date invalide." })
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
    }, "Date invalide.");
}

const departFields = {
  dateDebut: isoDate("La date de début"),
  dateFin: isoDate("La date de fin"),
  placesTotal: requiredInt(1, 200, "Le nombre de places"),
  prixParPersonne: optionalInt(0, 100_000_000, "Le prix"),
  guideId: z
    .string()
    .nullable()
    .transform((value) => (value ? value : null)),
  notes: optionalText(1000),
};

/** RG 10 : la date de fin est postérieure ou égale à la date de début (format ISO : ordre lexical). */
const datesOrdered = (data: { dateDebut: string; dateFin: string }) =>
  data.dateFin >= data.dateDebut;
const DATES_ERROR = {
  error: "La date de fin doit être postérieure ou égale à la date de début (RG 10).",
  path: ["dateFin"],
};

export const departSchema = z
  .object({
    circuitId: z.string().min(1, { error: "Choisissez un circuit." }),
    ...departFields,
  })
  .refine(datesOrdered, DATES_ERROR);
export type DepartInput = z.infer<typeof departSchema>;

/** Modification : le circuit d'un départ ne change pas (les réservations y sont rattachées). */
export const updateDepartSchema = z.object(departFields).refine(datesOrdered, DATES_ERROR);
export type UpdateDepartInput = z.infer<typeof updateDepartSchema>;

/** Filtres de la liste des départs (paramètres d'URL). */
export const PERIODES = ["a-venir", "passes", "tous"] as const;
export type Periode = (typeof PERIODES)[number];

export const departFiltersSchema = z.object({
  periode: z.enum(PERIODES).catch("a-venir"),
  circuitId: z
    .string()
    .optional()
    .catch(undefined)
    .transform((value) => value || undefined),
  statut: z.enum(STATUTS_SESSION).optional().catch(undefined),
});
export type DepartFilters = z.infer<typeof departFiltersSchema>;
