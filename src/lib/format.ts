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
  // Usage français : « 1er novembre », pas « 1 novembre ».
  return date ? dateFormat.format(date).replace(/^1 /, "1er ") : fallback;
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

/*
 * Dates calendaires des colonnes SQL `DATE` (départs) : Prisma les lit à minuit UTC, on les
 * formate donc en UTC pour ne jamais décaler d'un jour.
 */
const dayMonthFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const dayMonthYearFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const monthYearFormat = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** « 10 oct. 2026 », « 10 – 12 oct. 2026 » ou « 30 oct. – 2 nov. 2026 ». */
export function formatDateRange(debut: Date, fin: Date): string {
  if (debut.getTime() === fin.getTime()) return dayMonthYearFormat.format(debut);
  const sameMonth =
    debut.getUTCFullYear() === fin.getUTCFullYear() && debut.getUTCMonth() === fin.getUTCMonth();
  if (sameMonth) return `${debut.getUTCDate()} – ${dayMonthYearFormat.format(fin)}`;
  const start =
    debut.getUTCFullYear() === fin.getUTCFullYear()
      ? dayMonthFormat.format(debut)
      : dayMonthYearFormat.format(debut);
  return `${start} – ${dayMonthYearFormat.format(fin)}`;
}

/** « octobre 2026 » (en-têtes de groupes de la liste des départs). */
export function formatMonthYear(date: Date): string {
  return monthYearFormat.format(date);
}
