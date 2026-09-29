import type { StatutReservation, StatutSession } from "@/generated/prisma/client";

/**
 * Règles des départs (étape E7), en fonctions PURES testées unitairement.
 */

/** Réservations qui occupent des places : toutes sauf les annulées. */
export function placesReservees(
  reservations: readonly { nombrePersonnes: number; statut: StatutReservation }[],
): number {
  return reservations
    .filter((r) => r.statut !== "ANNULEE")
    .reduce((total, r) => total + r.nombrePersonnes, 0);
}

/**
 * Statut « effectif » d'un départ (RG 11), recalculé à chaque changement :
 * 1. ANNULEE reste ANNULEE (décision de l'agence, définitive) ;
 * 2. sinon TERMINEE si la date de fin est passée ;
 * 3. sinon COMPLETE si toutes les places sont réservées ;
 * 4. sinon OUVERTE (y compris un départ redevenu disponible après une annulation).
 *
 * `today` est la date calendaire du jour, au format des colonnes SQL `DATE` (minuit UTC,
 * voir `calendarDate`) : un départ qui finit aujourd'hui n'est pas encore terminé.
 */
export function computeSessionStatut(
  session: { statut: StatutSession; dateFin: Date; placesTotal: number },
  reservees: number,
  today: Date,
): StatutSession {
  if (session.statut === "ANNULEE") return "ANNULEE";
  if (session.dateFin.getTime() < today.getTime()) return "TERMINEE";
  if (reservees >= session.placesTotal) return "COMPLETE";
  return "OUVERTE";
}

/**
 * Date de fin proposée : un circuit de N jours commençant le jour J finit le jour J + N − 1
 * (un circuit d'une journée commence et finit le même jour, RG 10 : fin ≥ début).
 */
export function defaultDateFin(dateDebut: Date, dureeJours: number): Date {
  return new Date(dateDebut.getTime() + Math.max(0, dureeJours - 1) * 86_400_000);
}

/**
 * Premier jour de départ encore réservable : demain. Un départ du jour a commencé ; on ne
 * le réserve plus, comme on ne l'annule plus (RG 15, décision D de l'étape E9 : jusqu'à la
 * veille). `today` est une date calendaire (minuit UTC, voir `calendarDate`).
 */
export function firstBookableDate(today: Date): Date {
  return new Date(today.getTime() + 86_400_000);
}

/** Deux périodes [début, fin] (jours inclus) se chevauchent-elles ? */
export function periodsOverlap(
  a: { dateDebut: Date; dateFin: Date },
  b: { dateDebut: Date; dateFin: Date },
): boolean {
  return (
    a.dateDebut.getTime() <= b.dateFin.getTime() && b.dateDebut.getTime() <= a.dateFin.getTime()
  );
}

/** « AAAA-MM-JJ » (saisie d'un champ date) → minuit UTC, format des colonnes SQL DATE. */
export function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Minuit UTC → « AAAA-MM-JJ » (valeur d'un champ date). */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
