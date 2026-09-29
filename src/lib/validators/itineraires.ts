import { z } from "zod";

import { MAX_FREE_WAYPOINTS } from "@/lib/graph/waypoints";

/** Demande de calcul d'itinéraire (page « Calculer un itinéraire », §6.5). */

export const CRITERES = ["PLUS_COURT", "PLUS_RAPIDE", "PLUS_FACILE", "PERSONNALISE"] as const;
export type Critere = (typeof CRITERES)[number];

export const MODES_ALGORITHME = ["DIJKSTRA", "ASTAR", "COMPARER"] as const;
export type ModeAlgorithme = (typeof MODES_ALGORITHME)[number];

const coefficient = z
  .number({ error: "Nombre attendu." })
  .min(0, { error: "Au moins 0." })
  .max(100);

export const itineraireSchema = z
  .object({
    etapeDepartId: z.string().min(1, { error: "Choisissez le départ." }),
    etapeArriveeId: z.string().min(1, { error: "Choisissez l'arrivée." }),
    /** Étapes imposées, dans l'ordre souhaité (ordre fixé) ou à optimiser (ordre libre). */
    etapesImposees: z.array(z.string().min(1)).max(20, { error: "20 étapes imposées au maximum." }),
    ordreLibre: z.boolean(),
    critere: z.enum(CRITERES),
    alpha: coefficient,
    beta: coefficient,
    gamma: coefficient,
    algorithme: z.enum(MODES_ALGORITHME),
  })
  .refine((data) => data.critere !== "PERSONNALISE" || data.alpha + data.beta > 0, {
    error: "α ou β doit être strictement positif (sinon un tronçon facile aurait un poids nul).",
    path: ["alpha"],
  })
  .refine((data) => !data.ordreLibre || data.etapesImposees.length <= MAX_FREE_WAYPOINTS, {
    error: `L'ordre libre est limité à ${MAX_FREE_WAYPOINTS} étapes imposées.`,
    path: ["etapesImposees"],
  });
export type ItineraireInput = z.infer<typeof itineraireSchema>;

export const benchmarkSchema = z.object({
  critere: z.enum(["PLUS_COURT", "PLUS_RAPIDE", "PLUS_FACILE"]),
});
