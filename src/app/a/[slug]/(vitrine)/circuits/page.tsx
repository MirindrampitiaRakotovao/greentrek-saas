import type { Metadata } from "next";
import Link from "next/link";

import { CircuitCard } from "@/components/vitrine/circuit-card";
import { SearchBar } from "@/components/vitrine/search-bar";
import { formatDate } from "@/lib/format";
import { parseIsoDate } from "@/lib/departs";
import { getVitrineAgency } from "@/lib/public-agency";
import { searchCircuits } from "@/lib/services/vitrine";
import { DIFFICULTE_LABELS } from "@/lib/validators/circuits";
import { parseVitrineSearch } from "@/lib/validators/vitrine";
import { loadVitrine } from "@/lib/vitrine-page";

export async function generateMetadata({
  params,
}: PageProps<"/a/[slug]/circuits">): Promise<Metadata> {
  const agence = await getVitrineAgency((await params).slug);
  return { title: agence ? `Circuits — ${agence.nom}` : "Agence introuvable" };
}

/** Circuits publiés de l'agence et résultats de la recherche (§7.1). */
export default async function CircuitsPage({
  params,
  searchParams,
}: PageProps<"/a/[slug]/circuits">) {
  const { agence, db, today } = await loadVitrine((await params).slug);
  const search = parseVitrineSearch(await searchParams);
  const circuits = await searchCircuits(db, search);

  const criteres = [
    search.date ? `à partir du ${formatDate(parseIsoDate(search.date))}` : null,
    search.voyageurs ? `${search.voyageurs} voyageur${search.voyageurs > 1 ? "s" : ""}` : null,
    search.difficulte ? `difficulté ${DIFFICULTE_LABELS[search.difficulte].toLowerCase()}` : null,
  ].filter(Boolean);

  return (
    <div className="bg-gt-teal-50/60">
      <section className="bg-gt-teal-700 px-4 pt-10 pb-24 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="font-display text-3xl text-gt-cream sm:text-4xl">Nos circuits</p>
          <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
            Randonnées et découvertes avec {agence.nom}
          </h1>
        </div>
      </section>
      <div className="mx-auto -mt-16 max-w-6xl px-4 pb-16 sm:px-6">
        <SearchBar agenceSlug={agence.slug} search={search} today={today} />

        <div
          className="mt-8 flex flex-wrap items-baseline justify-between gap-3"
          aria-live="polite"
        >
          <h2 className="text-lg font-semibold text-gt-teal-900">
            {circuits.length} circuit{circuits.length > 1 ? "s" : ""}
            {criteres.length ? ` · ${criteres.join(", ")}` : ""}
          </h2>
          {criteres.length ? (
            <Link
              href={`/a/${agence.slug}/circuits`}
              className="text-sm font-medium text-gt-teal-700 underline"
            >
              Effacer les critères
            </Link>
          ) : null}
        </div>

        {circuits.length === 0 ? (
          <p className="mt-6 rounded-3xl border border-dashed border-gt-mist bg-white px-6 py-10 text-center text-sm text-gt-teal-900/70">
            Aucun départ ne correspond à ces critères. Essayez une autre date ou un groupe plus
            petit.
          </p>
        ) : (
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {circuits.map((c) => (
              <li key={c.id}>
                <CircuitCard circuit={c} agenceSlug={agence.slug} devise={agence.devise} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
