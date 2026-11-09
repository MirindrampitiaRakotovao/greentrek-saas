/** Départ dans les `days` prochains jours (dates calendaires « AAAA-MM-JJ », comparées en UTC). */
export function departWithinDays(
  depart: { dateDebut: string } | null,
  days: number,
  now: Date,
): boolean {
  if (!depart) return false;
  const debut = Date.parse(`${depart.dateDebut}T00:00:00Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return debut >= today && debut <= today + days * 86_400_000;
}
