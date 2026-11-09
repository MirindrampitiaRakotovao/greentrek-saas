import { z } from "zod";

import { loginSchema } from "@/lib/validators/auth";
import { vitrineSearchSchema } from "@/lib/validators/vitrine";

/* API de l'application mobile (après E12) : entrées validées à la frontière, comme ailleurs. */

/** Recherche du catalogue : filtres du site vitrine, plus un texte libre. */
export const catalogueQuerySchema = vitrineSearchSchema.extend({
  q: z.string().trim().max(100).optional().catch(undefined),
});
export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;

/** Connexion d'un voyageur : l'agence est obligatoire (compte propre à chaque agence). */
export const mobileLoginSchema = loginSchema
  .pick({ email: true, password: true })
  .extend({ agenceSlug: z.string().trim().min(1, { error: "Choisissez l'agence." }) });
