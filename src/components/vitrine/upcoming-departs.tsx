import Link from "next/link";

import { CircuitVisual } from "@/components/vitrine/circuit-visual";
import { formatDuree } from "@/components/vitrine/circuit-card";
import { formatDateRange, formatMoney } from "@/lib/format";
import type { UpcomingDepart } from "@/lib/services/vitrine";
import { DIFFICULTE_LABELS } from "@/lib/validators/circuits";

/** Prochains départs ouverts (§8.4, section 8) : date, circuit, places libres, prix. */
export function UpcomingDeparts({
  departs,
  agenceSlug,
  devise,
}: {
  departs: readonly UpcomingDepart[];
  agenceSlug: string;
  devise: string;
}) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {departs.map((d) => (
        <li key={d.id}>
          <Link
            href={`/a/${agenceSlug}/circuits/${d.circuit.slug}#departs`}
            className="group flex h-full gap-4 rounded-3xl bg-white p-3 shadow-md shadow-gt-teal-900/10 transition hover:-translate-y-1 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <div className="size-24 shrink-0 overflow-hidden rounded-2xl">
              <CircuitVisual
                imageUrl={d.circuit.imagePrincipaleUrl}
                landscapeKey={d.circuit.slug}
                className="size-full"
              />
            </div>
            <div className="min-w-0 py-1">
              <p className="text-sm font-semibold text-gt-teal-700">
                {formatDateRange(d.dateDebut, d.dateFin)}
              </p>
              <p className="line-clamp-2 font-medium text-gt-teal-900 group-hover:underline">
                {d.circuit.titre}
              </p>
              <p className="mt-1 text-xs text-gt-teal-900/70">
                {formatDuree(d.circuit.dureeJours)} · {DIFFICULTE_LABELS[d.circuit.difficulte]} ·{" "}
                {d.placesLibres} place{d.placesLibres > 1 ? "s" : ""} libre
                {d.placesLibres > 1 ? "s" : ""}
              </p>
              <p className="mt-1 text-sm font-semibold text-gt-teal-900">
                {formatMoney(d.prix, devise)}{" "}
                <span className="text-xs font-normal text-gt-teal-900/65">/ pers.</span>
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
