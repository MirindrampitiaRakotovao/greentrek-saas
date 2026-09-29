import Link from "next/link";

/**
 * Pagination par liens (`?page=n`) : fonctionne sans JavaScript et se partage par URL.
 * `params` conserve les filtres de la liste (valeurs vides ignorées).
 */
export function Pagination({
  basePath,
  page,
  pageCount,
  params = {},
}: {
  basePath: string;
  page: number;
  pageCount: number;
  params?: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;
  const hrefFor = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
    query.set("page", String(target));
    return `${basePath}?${query.toString()}`;
  };
  const linkClass =
    "rounded-full border border-gt-mist px-4 py-1.5 text-sm font-medium text-gt-teal-700 hover:bg-gt-cream";
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass}>
          Précédent
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-gt-teal-900/70">
        Page {page} sur {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={linkClass}>
          Suivant
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
