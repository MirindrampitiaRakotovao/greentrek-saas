import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CircuitCard } from "@/components/vitrine/circuit-card";
import { SearchBar } from "@/components/vitrine/search-bar";
import { UpcomingDeparts } from "@/components/vitrine/upcoming-departs";
import { getVitrineAgency } from "@/lib/public-agency";
import { listPublicPartenaires, listUpcomingDeparts, searchCircuits } from "@/lib/services/vitrine";
import { TYPE_PARTENAIRE_LABELS } from "@/lib/validators/backoffice";
import { loadVitrine } from "@/lib/vitrine-page";

export async function generateMetadata({ params }: PageProps<"/a/[slug]">): Promise<Metadata> {
  const agence = await getVitrineAgency((await params).slug);
  return {
    title: agence ? agence.nom : "Agence introuvable",
    description: agence?.description ?? undefined,
  };
}

/**
 * Accueil du site vitrine (§7.1). Version E8a : hero, recherche, circuits, prochains départs,
 * partenaires. Les sections de présentation de la maquette (§8.4) arrivent à l'étape E8b.
 */
export default async function VitrineHomePage({ params }: PageProps<"/a/[slug]">) {
  const { agence, db, today } = await loadVitrine((await params).slug);
  const [circuits, departs, partenaires] = await Promise.all([
    searchCircuits(db, {}),
    listUpcomingDeparts(db),
    listPublicPartenaires(db),
  ]);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-gt-teal-900 text-white">
        {/*
          Photo du hero fournie par l'étudiant (plage bordée de cocotiers au lever du soleil).
          TODO(photos Green Trek) : confirmer la source et la licence de la photo (§8.1 :
          photo propre ou libre de droits, avec attribution si nécessaire). Le texte
          alternatif ne nomme aucun lieu : la photo n'est pas présentée comme Mahambo.
        */}
        <Image
          src="/images/hero-plage.jpg"
          alt="Plage bordée de cocotiers au lever du soleil"
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-[center_60%]"
        />
        {/* Voile teal : garantit la lisibilité du texte blanc sur un ciel très clair. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-r from-gt-teal-900/85 via-gt-teal-900/55 to-gt-teal-900/10"
        />
        <div className="mx-auto max-w-6xl px-4 pt-20 pb-36 sm:px-6 sm:pt-32 sm:pb-44">
          <h1 className="font-script text-5xl text-gt-cream drop-shadow sm:text-7xl">
            {agence.nom}
          </h1>
          {agence.description ? (
            <p className="mt-5 max-w-xl text-base text-white/95 drop-shadow sm:text-lg">
              {agence.description}
            </p>
          ) : null}
          <Link
            href={`/a/${agence.slug}/circuits`}
            className="mt-8 inline-block rounded-full bg-gt-sand-300 px-6 py-3 text-sm font-semibold text-gt-teal-900 hover:bg-gt-sand-200"
          >
            Découvrir nos circuits
          </Link>
        </div>
      </section>

      <div className="relative mx-auto -mt-20 max-w-6xl px-4 sm:px-6">
        <SearchBar agenceSlug={agence.slug} today={today} />
      </div>

      <section aria-labelledby="titre-circuits" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="titre-circuits" className="font-script text-3xl text-gt-teal-700 sm:text-4xl">
            Nos circuits
          </h2>
          <Link
            href={`/a/${agence.slug}/circuits`}
            className="text-sm font-medium text-gt-teal-700 underline"
          >
            Voir tous les circuits
          </Link>
        </div>
        {circuits.length === 0 ? (
          <p className="mt-6 text-sm text-gt-teal-900/70">
            Aucun circuit publié pour l&apos;instant.
          </p>
        ) : (
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {circuits.slice(0, 6).map((c) => (
              <li key={c.id}>
                <CircuitCard circuit={c} agenceSlug={agence.slug} devise={agence.devise} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        id="departs"
        aria-labelledby="titre-departs"
        className="scroll-mt-20 bg-gt-teal-50/70 px-4 py-14 sm:px-6"
      >
        <div className="mx-auto max-w-6xl">
          <h2 id="titre-departs" className="font-script text-3xl text-gt-teal-700 sm:text-4xl">
            Prochains départs
          </h2>
          {departs.length === 0 ? (
            <p className="mt-6 text-sm text-gt-teal-900/70">
              Aucun départ ouvert pour l&apos;instant.
            </p>
          ) : (
            <div className="mt-6">
              <UpcomingDeparts departs={departs} agenceSlug={agence.slug} devise={agence.devise} />
            </div>
          )}
        </div>
      </section>

      {partenaires.length > 0 ? (
        <section
          id="partenaires"
          aria-labelledby="titre-partenaires"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6"
        >
          <h2 id="titre-partenaires" className="font-script text-3xl text-gt-teal-700 sm:text-4xl">
            Nos partenaires locaux
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {partenaires.map((p) => (
              <li key={p.id} className="rounded-3xl border border-gt-mist/70 p-5">
                <p className="text-xs font-semibold tracking-wide text-gt-teal-600 uppercase">
                  {TYPE_PARTENAIRE_LABELS[p.type]}
                </p>
                <p className="mt-1 font-semibold text-gt-teal-900">{p.nom}</p>
                {p.description ? (
                  <p className="mt-2 line-clamp-3 text-sm text-gt-teal-900/70">{p.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
