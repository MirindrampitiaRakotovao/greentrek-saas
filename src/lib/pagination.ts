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
