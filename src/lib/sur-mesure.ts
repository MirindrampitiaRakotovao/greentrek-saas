/**
 * Départ d'un itinéraire sur mesure (étape 9) : règles pures, testées.
 *
 * Durée proposée : on suppose 6 heures de marche par jour (hypothèse documentée dans
 * docs/AVANCEMENT.md, à ajuster par l'agence) ; le voyageur peut changer la date de fin.
 */
export const HEURES_MARCHE_PAR_JOUR = 6;

/** Nombre de jours proposé pour un itinéraire de `dureeMinutes` minutes de marche (≥ 1). */
export function suggestedDays(dureeMinutes: number): number {
  return Math.max(1, Math.ceil(dureeMinutes / (HEURES_MARCHE_PAR_JOUR * 60)));
}

/** Date de fin proposée (colonne `@db.Date`, minuit UTC) : début + jours − 1. */
export function suggestedEnd(dateDebut: Date, dureeMinutes: number): Date {
  return new Date(dateDebut.getTime() + (suggestedDays(dureeMinutes) - 1) * 86_400_000);
}

export const STATUT_DEPART_SUR_MESURE_LABELS = {
  DEMANDE: "En attente de l'agence",
  CONFIRME: "Confirmé",
  REFUSE: "Refusé",
  ANNULE: "Annulé",
} as const;
