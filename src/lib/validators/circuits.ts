import { z } from "zod";

import { SLUG_PATTERN } from "@/lib/validators/auth";
import {
  checkbox,
  optionalInt,
  optionalText,
  optionalUrl,
  requiredInt,
  requiredNumber,
  requiredText,
} from "@/lib/validators/common";

/* ─── Étapes (nœuds du graphe, §5.2 table 4) ─────────────────────────────────── */

export const TYPES_ETAPE = [
  "VILLAGE",
  "POINT_INTERET",
  "HEBERGEMENT",
  "RESTAURATION",
  "EMBARCADERE",
  "AUTRE",
] as const;
export type TypeEtape = (typeof TYPES_ETAPE)[number];

export const TYPE_ETAPE_LABELS: Record<TypeEtape, string> = {
  VILLAGE: "Village",
  POINT_INTERET: "Point d'intérêt",
  HEBERGEMENT: "Hébergement",
  RESTAURATION: "Restauration",
  EMBARCADERE: "Embarcadère",
  AUTRE: "Autre",
};

export const etapeSchema = z.object({
  nom: requiredText(150),
  type: z.enum(TYPES_ETAPE, { error: "Type invalide." }),
  description: optionalText(2000),
  latitude: requiredNumber(-90, 90, "La latitude"),
  longitude: requiredNumber(-180, 180, "La longitude"),
  altitudeM: optionalInt(-500, 9000, "L'altitude"),
});
export type EtapeInput = z.infer<typeof etapeSchema>;

/** Déplacement d'un marqueur sur la carte (coordonnées seules). */
export const moveEtapeSchema = z.object({
  id: z.string().min(1),
  latitude: requiredNumber(-90, 90, "La latitude"),
  longitude: requiredNumber(-180, 180, "La longitude"),
});

/* ─── Circuits (§5.2 table 3) ────────────────────────────────────────────────── */

export const DIFFICULTES = ["FACILE", "MOYENNE", "DIFFICILE"] as const;
export const DIFFICULTE_LABELS: Record<(typeof DIFFICULTES)[number], string> = {
  FACILE: "Facile",
  MOYENNE: "Moyenne",
  DIFFICILE: "Difficile",
};

export const STATUT_CIRCUIT_LABELS = {
  BROUILLON: "Brouillon",
  PUBLIE: "Publié",
  ARCHIVE: "Archivé",
} as const;

export const circuitSchema = z.object({
  titre: requiredText(200),
  slug: z
    .string()
    .trim()
    .min(3, { error: "Au moins 3 caractères." })
    .max(200)
    .regex(SLUG_PATTERN, { error: "Minuscules, chiffres et tirets uniquement." }),
  resume: optionalText(500),
  description: optionalText(5000),
  difficulte: z.enum(DIFFICULTES, { error: "Difficulté invalide." }),
  dureeJours: requiredInt(1, 60, "La durée"),
  prixParPersonne: requiredInt(0, 100_000_000, "Le prix"),
  capaciteMax: requiredInt(1, 200, "La capacité"),
  imagePrincipaleUrl: optionalUrl,
});
export type CircuitInput = z.infer<typeof circuitSchema>;

export const circuitStatutSchema = z.object({
  id: z.string().min(1),
  statut: z.enum(["BROUILLON", "PUBLIE", "ARCHIVE"]),
});

/* ─── Étapes d'un circuit (CircuitEtape) ─────────────────────────────────────── */

const circuitEtapeDetails = {
  jour: optionalInt(1, 60, "Le jour"),
  dureeSejourMin: optionalInt(0, 10_080, "La durée de séjour"),
  notes: optionalText(500),
};

export const addCircuitEtapeSchema = z.object({
  circuitId: z.string().min(1),
  etapeId: z.string().min(1, { error: "Choisissez une étape." }),
  ...circuitEtapeDetails,
});
export type AddCircuitEtapeInput = z.infer<typeof addCircuitEtapeSchema>;

export const updateCircuitEtapeSchema = z.object({
  id: z.string().min(1),
  ...circuitEtapeDetails,
});
export type UpdateCircuitEtapeInput = z.infer<typeof updateCircuitEtapeSchema>;

export const moveCircuitEtapeSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

/* ─── Partenaires inclus dans un circuit (CircuitPartenaire) ─────────────────── */

export const circuitPartenaireSchema = z.object({
  circuitId: z.string().min(1),
  partenaireId: z.string().min(1, { error: "Choisissez un partenaire." }),
  etapeId: z
    .string()
    .nullable()
    .transform((value) => (value ? value : null)),
  prestation: requiredText(200),
  prixUnitaire: optionalInt(0, 100_000_000, "Le prix"),
  inclusDansPrix: checkbox,
});
export type CircuitPartenaireInput = z.infer<typeof circuitPartenaireSchema>;

/* ─── Tronçons (arêtes du graphe, §5.2 table 5) ──────────────────────────────── */

export const tronconSchema = z
  .object({
    etapeDepartId: z.string().min(1, { error: "Choisissez l'étape de départ." }),
    etapeArriveeId: z.string().min(1, { error: "Choisissez l'étape d'arrivée." }),
    distanceKm: requiredNumber(0.01, 1000, "La distance"),
    dureeMinutes: requiredInt(1, 100_000, "La durée"),
    deniveleM: optionalInt(-9000, 9000, "Le dénivelé"),
    difficulte: requiredInt(1, 5, "La difficulté"),
    bidirectionnel: checkbox,
    distanceEstimee: checkbox,
    commentaire: optionalText(500),
  })
  // RG 6 : un tronçon relie deux étapes DISTINCTES.
  .refine((data) => data.etapeDepartId !== data.etapeArriveeId, {
    error: "Le départ et l'arrivée doivent être deux étapes différentes.",
    path: ["etapeArriveeId"],
  });
export type TronconInput = z.infer<typeof tronconSchema>;

export const DIFFICULTE_TRONCON_LABELS: Record<number, string> = {
  1: "1 · Très facile",
  2: "2 · Facile",
  3: "3 · Moyen",
  4: "4 · Difficile",
  5: "5 · Très difficile",
};
