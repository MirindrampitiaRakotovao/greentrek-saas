/**
 * Calendrier des tableaux de bord, dans le fuseau de Madagascar : UTC+3 toute l'année
 * (pas d'heure d'été). Un « jour » ou un « mois » s'entend en heure locale de l'agence :
 * une réservation faite le 1er à 1 h du matin à Mahambo compte bien pour le nouveau mois.
 */
export const MADAGASCAR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Composantes (année, mois 0-11, jour) de la date locale à Madagascar. */
function localParts(date: Date) {
  const local = new Date(date.getTime() + MADAGASCAR_OFFSET_MS);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate() };
}

/** Instant UTC correspondant à minuit (heure de Madagascar) d'une date locale. */
function localMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - MADAGASCAR_OFFSET_MS);
}

/** Minuit local du jour de `date`, décalé de `offsetDays` jours. */
export function startOfDay(date: Date, offsetDays = 0): Date {
  const { year, month, day } = localParts(date);
  return localMidnight(year, month, day + offsetDays);
}

/** Minuit local du 1er du mois de `date`, décalé de `offsetMonths` mois. */
export function startOfMonth(date: Date, offsetMonths = 0): Date {
  const { year, month } = localParts(date);
  return localMidnight(year, month + offsetMonths, 1);
}

/** Clé de jour local « AAAA-MM-JJ ». */
export function dayKey(date: Date): string {
  const { year, month, day } = localParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Clé de mois local « AAAA-MM ». */
export function monthKey(date: Date): string {
  const { year, month } = localParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Nombre de jours entiers entre deux instants (arrondi à l'inférieur). */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/** Variation en % de `previous` à `current` ; `null` si la période précédente est nulle. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Date calendaire locale (Madagascar) sous la forme attendue par une colonne SQL `DATE` :
 * minuit UTC de ce jour. Prisma lit et écrit les colonnes `@db.Date` en UTC ; comparer une
 * date de départ à `startOfDay` (21 h UTC la veille) inclurait à tort les départs d'hier.
 */
export function calendarDate(date: Date, offsetDays = 0): Date {
  const { year, month, day } = localParts(date);
  return new Date(Date.UTC(year, month, day + offsetDays));
}

/** Jours restants (arrondis au supérieur, jamais négatifs) avant `date`. */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / DAY_MS));
}
