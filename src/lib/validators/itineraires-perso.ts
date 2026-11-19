import { z } from "zod";

import { MAX_FREE_WAYPOINTS } from "@/lib/graph/waypoints";
import { optionalText, requiredText } from "@/lib/validators/common";

/* Itinéraires sur mesure (après E12) : proposition de l'agence, réponse du voyageur. */

export const proposeItineraireSchema = z.object({
  clientId: z.string().min(1),
  /** Calcul de l'historique (fait dans le calculateur juste avant). */
  historiqueId: z.string().min(1, { error: "Calculez d'abord l'itinéraire." }),
  titre: requiredText(150, "Donnez un titre à l'itinéraire."),
  message: optionalText(1000),
});
export type ProposeItineraireInput = z.infer<typeof proposeItineraireSchema>;

export const answerItineraireSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["ACCEPTE", "DECLINE"]),
  reponse: optionalText(1000),
});
export type AnswerItineraireInput = z.infer<typeof answerItineraireSchema>;

/**
 * Calcul demandé par un voyageur (étape 4b) : critères prédéfinis seulement (pas de
 * coefficients ni de choix d'algorithme), au plus 8 villages à visiter.
 */
export const clientCalculSchema = z
  .object({
    etapeDepartId: z.string().min(1, { error: "Choisissez le départ." }),
    etapeArriveeId: z.string().min(1, { error: "Choisissez l'arrivée." }),
    etapesImposees: z.array(z.string().min(1)).max(MAX_FREE_WAYPOINTS, {
      error: `${MAX_FREE_WAYPOINTS} villages à visiter au maximum.`,
    }),
    ordreLibre: z.boolean(),
    critere: z.enum(["PLUS_COURT", "PLUS_RAPIDE", "PLUS_FACILE"]),
  })
  .refine((d) => d.etapeDepartId !== d.etapeArriveeId || d.etapesImposees.length > 0, {
    error: "Choisissez une arrivée différente du départ, ou des villages à visiter.",
    path: ["etapeArriveeId"],
  });
export type ClientCalculInput = z.infer<typeof clientCalculSchema>;

/** Demande d'itinéraire envoyée à l'agence, à partir d'un calcul du voyageur. */
export const requestItineraireSchema = z.object({
  historiqueId: z.string().min(1, { error: "Calculez d'abord l'itinéraire." }),
  titre: requiredText(150, "Donnez un titre à votre itinéraire."),
  message: optionalText(1000),
});
