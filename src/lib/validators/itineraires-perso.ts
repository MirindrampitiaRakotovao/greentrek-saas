import { z } from "zod";

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
