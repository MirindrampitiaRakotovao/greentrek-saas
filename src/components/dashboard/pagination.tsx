import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { pageItems } from "@/lib/pagination";

/**
 * Pagination numérotée en bas des listes (demande de l'étudiant) : Précédent, 1 … 4 5 6 … 12,
 * Suivant. Liens (`?page=n`) : fonctionne sans JavaScript et se partage par URL.
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
    if (target > 1) query.set("page", String(target));
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const arrow =
    "flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-gt-teal-800 hover:bg-white";
  const disabled = "flex items-center gap-1 px-3 py-2 text-sm text-gt-teal-900/35";

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex flex-wrap items-center justify-center gap-1 sm:justify-between"
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={arrow}>
          <Icon name="arrowRight" className="size-4 rotate-180" />
          Précédent
        </Link>
      ) : (
        <span className={disabled} aria-hidden="true">
          <Icon name="arrowRight" className="size-4 rotate-180" />
          Précédent
        </span>
      )}

      <ol className="flex items-center gap-1">
        {pageItems(page, pageCount).map((item, index) =>
          item === "…" ? (
            <li key={`ellipse-${index}`} aria-hidden="true" className="px-2 text-gt-teal-900/75">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={hrefFor(item)}
                aria-current={item === page ? "page" : undefined}
                aria-label={`Page ${item}`}
                className={`grid size-9 place-items-center rounded-full text-sm font-medium transition-colors ${
                  item === page
                    ? "bg-gt-teal-700 text-white shadow-sm"
                    : "text-gt-teal-900 hover:bg-white"
                }`}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ol>

      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={arrow}>
          Suivant
          <Icon name="arrowRight" className="size-4" />
        </Link>
      ) : (
        <span className={disabled} aria-hidden="true">
          Suivant
          <Icon name="arrowRight" className="size-4" />
        </span>
      )}
    </nav>
  );
}
