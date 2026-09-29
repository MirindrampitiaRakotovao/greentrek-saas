import { z } from "zod";

import { DIFFICULTES } from "@/lib/validators/circuits";

/*
 * Recherche du site vitrine (§7.1) : filtres lus dans l'URL (`?date=…&voyageurs=…`).
 * Une URL est modifiable à la main : toute valeur invalide est simplement ignorée (`catch`)
 * au lieu de provoquer une erreur, et la page affiche alors la recherche sans ce filtre.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  });

export const MAX_VOYAGEURS = 50;

export const vitrineSearchSchema = z.object({
  /** Partir à partir de cette date (incluse). */
  date: isoDate.optional().catch(undefined),
  /** Nombre de voyageurs : il faut au moins autant de places libres sur le départ. */
  voyageurs: z.coerce.number().int().min(1).max(MAX_VOYAGEURS).optional().catch(undefined),
  difficulte: z.enum(DIFFICULTES).optional().catch(undefined),
});
export type VitrineSearch = z.infer<typeof vitrineSearchSchema>;

/** Lit les paramètres d'URL de la recherche (valeurs vides ou multiples tolérées). */
export function parseVitrineSearch(params: Record<string, string | string[] | undefined>) {
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) || undefined;
  return vitrineSearchSchema.parse({
    date: first(params.date),
    voyageurs: first(params.voyageurs),
    difficulte: first(params.difficulte),
  });
}
