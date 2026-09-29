import { type Arc, type Criteria, GraphError } from "@/lib/graph/types";

/**
 * Fonction de poids d'un tronçon (§6.1) :
 *
 *   w(e) = α · distanceKm + β · (dureeMinutes / 60) + γ · pénalité(e)
 *
 * Pénalité de difficulté (décision A de l'étape E6) : l'effort en plus des « kilomètres
 * faciles », pénalité(e) = (difficulté − 1) × distanceKm. Elle vaut 0 pour un tronçon de
 * difficulté 1 ; avec γ = 2, un kilomètre de difficulté 5 compte comme 9 kilomètres.
 *
 * Garantie w(e) > 0 : distance et durée sont strictement positives (RG 6, contraintes de la
 * base), α, β, γ ≥ 0 et α + β > 0 (vérifié par `validateCriteria`). Dijkstra et A* exigent
 * des poids positifs.
 */

export const CRITERIA_PRESETS = {
  PLUS_COURT: { alpha: 1, beta: 0, gamma: 0 },
  PLUS_RAPIDE: { alpha: 0, beta: 1, gamma: 0 },
  PLUS_FACILE: { alpha: 1, beta: 0, gamma: 2 },
} as const satisfies Record<string, Criteria>;

export type CriteriaPreset = keyof typeof CRITERIA_PRESETS;

export const CRITERIA_LABELS: Record<CriteriaPreset | "PERSONNALISE", string> = {
  PLUS_COURT: "Plus court",
  PLUS_RAPIDE: "Plus rapide",
  PLUS_FACILE: "Plus facile",
  PERSONNALISE: "Personnalisé",
};

export function difficultyPenalty(arc: Pick<Arc, "difficulte" | "distanceKm">): number {
  return (arc.difficulte - 1) * arc.distanceKm;
}

export function arcWeight(arc: Arc, criteria: Criteria): number {
  return (
    criteria.alpha * arc.distanceKm +
    criteria.beta * (arc.dureeMinutes / 60) +
    criteria.gamma * difficultyPenalty(arc)
  );
}

/** Refuse des coefficients qui pourraient produire un poids nul ou négatif. */
export function validateCriteria(criteria: Criteria): void {
  const values = [criteria.alpha, criteria.beta, criteria.gamma];
  if (values.some((v) => !Number.isFinite(v) || v < 0)) {
    throw new GraphError(
      "CRITERES_INVALIDES",
      "Les coefficients α, β et γ doivent être positifs ou nuls.",
    );
  }
  if (criteria.alpha + criteria.beta <= 0) {
    throw new GraphError(
      "CRITERES_INVALIDES",
      "α ou β doit être strictement positif : sinon un tronçon facile aurait un poids nul.",
    );
  }
}
