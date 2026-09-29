/** Taille de page par défaut des listes du back-office (§12 : pagination des listes). */
export const PAGE_SIZE = 20;

/** Lit le numéro de page dans l'URL (`?page=2`) ; toute valeur invalide donne la page 1. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
};

/** Arguments Prisma `skip` / `take` pour une page donnée. */
export function pageArgs(page: number, pageSize = PAGE_SIZE) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * Numéros de page à afficher : toujours la première et la dernière, la page courante et ses
 * voisines, « … » pour les trous (ex. page 6 sur 12 : 1 … 5 6 7 … 12). Un « … » ne remplace
 * jamais une seule page : on affiche alors directement ce numéro.
 */
export function pageItems(page: number, count: number, siblings = 1): (number | "…")[] {
  if (count <= 1) return [1];
  const items: (number | "…")[] = [];
  const start = Math.max(2, page - siblings);
  const end = Math.min(count - 1, page + siblings);
  items.push(1);
  if (start === 3) items.push(2);
  else if (start > 3) items.push("…");
  for (let p = start; p <= end; p += 1) items.push(p);
  if (end === count - 2) items.push(count - 1);
  else if (end < count - 2) items.push("…");
  items.push(count);
  return items;
}
