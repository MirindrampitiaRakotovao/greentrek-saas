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

const integerFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/**
 * Montant dans la devise de l'agence. L'Ariary s'affiche « 25 000 Ar » (usage local, §8.4),
 * alors qu'Intl afficherait « 25 000 MGA ». Montants entiers (pas de centimes, décision E1).
 */
export function formatMoney(amount: number | null | undefined, devise: string, fallback = "—") {
  if (amount === null || amount === undefined) return fallback;
  if (devise === "MGA") return `${integerFormat.format(amount)} Ar`;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: devise,
    maximumFractionDigits: 0,
  }).format(amount);
}
