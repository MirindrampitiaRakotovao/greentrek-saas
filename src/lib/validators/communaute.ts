import { z } from "zod";

import { optionalText, requiredText } from "@/lib/validators/common";

/* Communauté des voyageurs (étape 5d) : publications après un séjour, commentaires. */

export const PHOTOS_MAX = 8;
export const LEGENDE_MAX = 1000;
export const COMMENTAIRE_MAX = 1000;

/** Champs d'une publication (les photos arrivent à part, en fichiers). */
export const publicationSchema = z.object({
  reservationId: z.string().min(1, { error: "Choisissez le séjour." }),
  legende: optionalText(LEGENDE_MAX),
});

export const commentaireSchema = z.object({
  publicationId: z.string().min(1),
  contenu: requiredText(COMMENTAIRE_MAX, "Écrivez votre commentaire."),
});

export const jaimeSchema = z.object({ publicationId: z.string().min(1), jaime: z.boolean() });

export const reportContentSchema = z.object({
  cible: z.enum(["PUBLICATION", "COMMENTAIRE"]),
  cibleId: z.string().min(1),
  motif: optionalText(500),
});

export const idSchema = z.object({ id: z.string().min(1) });

/**
 * Liste des photos enregistrée en JSON : relue et vérifiée (jamais de confiance aveugle).
 * Photos envoyées par les voyageurs (`/fichiers/publications/…`) ou photos libres livrées
 * avec le projet pour les publications de départ (`/images/communaute/…`, créditées).
 */
export const photosJsonSchema = z.array(
  z.string().regex(/^(\/fichiers\/publications\/[^/]+|\/images\/communaute\/[a-z0-9-]+\.jpg)$/),
);

export const TRIS = ["recentes", "populaires"] as const;
export type Tri = (typeof TRIS)[number];

/** Filtres du fil : tri, recherche (légende, circuit, agence), destination (circuit). */
export const feedFiltersSchema = z.object({
  tri: z.enum(TRIS).catch("recentes"),
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .catch(undefined)
    .transform((v) => v || undefined),
  circuit: z.string().max(30).optional().catch(undefined),
  /** « Mes publications » seulement. */
  moi: z.literal("1").optional().catch(undefined),
});
export type FeedFilters = z.infer<typeof feedFiltersSchema>;
