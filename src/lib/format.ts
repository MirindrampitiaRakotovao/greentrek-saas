/**
 * Formatage des dates pour l'affichage, en français et dans le fuseau de Madagascar
 * (UTC+3). Le fuseau est fixé : le rendu serveur et le navigateur affichent la même chose.
 */
const TIME_ZONE = "Indian/Antananarivo";

const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: TIME_ZONE });

export function formatDateTime(date: Date | null | undefined, fallback = "—"): string {
  return date ? dateTimeFormat.format(date) : fallback;
}

export function formatDate(date: Date | null | undefined, fallback = "—"): string {
  return date ? dateFormat.format(date) : fallback;
}
