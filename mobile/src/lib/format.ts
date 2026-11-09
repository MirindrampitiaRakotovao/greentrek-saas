/**
 * Formats français de l'application (fonctions pures, testées par la suite de tests du site).
 * Mêmes conventions que le site : « 60 000 Ar », dates calendaires des départs en UTC
 * (colonnes SQL DATE renvoyées par l'API au format « AAAA-MM-JJ »).
 */

const MOIS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/** « 60 000 Ar » (Ariary) ; autre devise : « 60 000 EUR ». Espaces fines insécables. */
export function formatMoney(amount: number, devise = "MGA"): string {
  const digits = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${digits} ${devise === "MGA" ? "Ar" : devise}`;
}

function parts(isoDay: string) {
  const [y, m, d] = isoDay.split("-").map(Number);
  return { y: y ?? 0, m: (m ?? 1) - 1, d: d ?? 1 };
}

/** « 4 oct. 2026 » ; « 1er » pour le premier du mois. */
export function formatDay(isoDay: string): string {
  const { y, m, d } = parts(isoDay);
  return `${d === 1 ? "1er" : d} ${MOIS[m]} ${y}`;
}

/** « 12 – 14 nov. 2026 », « 30 oct. – 2 nov. 2026 », ou un seul jour. */
export function formatDayRange(debut: string, fin: string): string {
  if (debut === fin) return formatDay(debut);
  const a = parts(debut);
  const b = parts(fin);
  const jour = (d: number) => (d === 1 ? "1er" : String(d));
  if (a.y === b.y && a.m === b.m) return `${jour(a.d)} – ${jour(b.d)} ${MOIS[b.m]} ${b.y}`;
  if (a.y === b.y) return `${jour(a.d)} ${MOIS[a.m]} – ${jour(b.d)} ${MOIS[b.m]} ${b.y}`;
  return `${formatDay(debut)} – ${formatDay(fin)}`;
}

export function formatDuree(jours: number): string {
  return `${jours} jour${jours > 1 ? "s" : ""}`;
}

export function formatPlaces(n: number): string {
  return `${n} place${n > 1 ? "s" : ""} libre${n > 1 ? "s" : ""}`;
}

export const DIFFICULTE_LABELS: Record<string, string> = {
  FACILE: "Facile",
  MOYENNE: "Moyenne",
  DIFFICILE: "Difficile",
};

/** Note sur 5 : « 4,5 ». */
export function formatNote(note: number): string {
  const arrondi = Math.round(note * 10) / 10;
  return Number.isInteger(arrondi) ? String(arrondi) : arrondi.toFixed(1).replace(".", ",");
}

/**
 * Adresse de l'API à partir de l'adresse du serveur de développement Expo (« 192.168.1.20:8081 »
 * ou « 192.168.1.20:8081/… ») : même ordinateur, port du site (3000 par défaut).
 */
export function apiBaseFromHost(hostUri: string | null | undefined, port = 3000): string | null {
  if (!hostUri) return null;
  const host = hostUri
    .replace(/^[a-z]+:\/\//i, "")
    .split("/")[0]
    ?.split(":")[0];
  return host ? `http://${host}:${port}` : null;
}

/** Adresse absolue d'une image servie par le site (« /images/… »), ou adresse déjà absolue. */
export function absoluteUrl(base: string, path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}
