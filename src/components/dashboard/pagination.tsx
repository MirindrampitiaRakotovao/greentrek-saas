import Link from "next/link";

/** Pagination par liens (`?page=n`) : fonctionne sans JavaScript et se partage par URL. */
export function Pagination({
  basePath,
  page,
  pageCount,
}: {
  basePath: string;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const linkClass =
    "rounded-full border border-gt-mist px-4 py-1.5 text-sm font-medium text-gt-teal-700 hover:bg-gt-cream";
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={`${basePath}?page=${page - 1}`} className={linkClass}>
          Précédent
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-gt-teal-900/70">
        Page {page} sur {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={`${basePath}?page=${page + 1}`} className={linkClass}>
          Suivant
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
