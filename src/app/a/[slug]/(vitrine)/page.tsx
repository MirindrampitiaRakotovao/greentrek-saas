import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ReviewList } from "@/components/avis/review-list";
import { CircuitCard } from "@/components/vitrine/circuit-card";
import { SearchBar } from "@/components/vitrine/search-bar";
import { BlurBlobs } from "@/components/vitrine/blur-blobs";
import { BrushEdge } from "@/components/vitrine/brush-edge";
import { Carousel } from "@/components/vitrine/carousel";
import { CircuitVisual } from "@/components/vitrine/circuit-visual";
import {
  AdventureSection,
  ExperiencesSection,
  ThemeTiles,
} from "@/components/vitrine/home-sections";
import { UpcomingDepartCard } from "@/components/vitrine/upcoming-departs";
import { getVitrineAgency } from "@/lib/public-agency";
import { listPublicAvis } from "@/lib/services/avis";
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
 * Accueil du site vitrine (§7.1), d'après la structure de la maquette (§8.4) : hero photo à
 * bord « coup de pinceau », recherche flottante, carrousel des circuits, « Vivre Madagascar
 * autrement », « Le meilleur pour votre aventure », tuiles thématiques, carrousel des
 * prochains départs, avis des voyageurs (publiés après modération, étape E12), partenaires,
 * pied de page. Pas de galerie « Suivez-nous » (comptes de réseaux sociaux inconnus) :
 * décision C de l'étape E8.
 */
export default async function VitrineHomePage({ params }: PageProps<"/a/[slug]">) {
  const { agence, db, today } = await loadVitrine((await params).slug);
  const [circuits, departs, partenaires, avis] = await Promise.all([
    searchCircuits(db, {}),
    listUpcomingDeparts(db, 9),
    listPublicPartenaires(db),
    listPublicAvis(db, { take: 6 }),
  ]);
  const titre = "text-3xl font-medium text-gt-teal-800 sm:text-4xl";

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
        <div className="mx-auto max-w-6xl px-4 pt-20 pb-40 sm:px-6 sm:pt-32 sm:pb-48">
          <p className="inline-block rounded-full bg-gt-sand-200 px-4 py-1.5 text-sm font-semibold text-gt-teal-900">
            Écotourisme · Randonnée · Pirogue
          </p>
          <h1 className="mt-4 font-script text-6xl leading-tight font-bold text-gt-cream drop-shadow-lg sm:text-8xl">
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
        <BrushEdge />
      </section>

      <div className="relative mx-auto -mt-24 max-w-6xl px-4 sm:px-6">
        <SearchBar agenceSlug={agence.slug} today={today} />
      </div>

      <section
        aria-labelledby="titre-circuits"
        className="relative isolate mx-auto max-w-6xl px-4 pt-16 sm:px-6"
      >
        <BlurBlobs preset="right" />
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h2 id="titre-circuits" className={titre}>
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
          <p className="text-sm text-gt-teal-900/75">Aucun circuit publié pour l&apos;instant.</p>
        ) : (
          <Carousel label="Nos circuits">
            {circuits.map((c) => (
              <li key={c.id}>
                <CircuitCard circuit={c} agenceSlug={agence.slug} devise={agence.devise} />
              </li>
            ))}
          </Carousel>
        )}
      </section>

      <ExperiencesSection agenceSlug={agence.slug} />

      <AdventureSection />

      <ThemeTiles agenceSlug={agence.slug} />

      <section
        id="departs"
        aria-labelledby="titre-departs"
        className="relative isolate scroll-mt-20 overflow-hidden bg-gt-teal-50/70 py-16"
      >
        <BlurBlobs preset="corners" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 id="titre-departs" className={`${titre} mb-6`}>
            Prochains départs
          </h2>
          {departs.length === 0 ? (
            <p className="text-sm text-gt-teal-900/75">Aucun départ ouvert pour l&apos;instant.</p>
          ) : (
            <Carousel label="Prochains départs">
              {departs.map((d) => (
                <li key={d.id}>
                  <UpcomingDepartCard depart={d} agenceSlug={agence.slug} devise={agence.devise} />
                </li>
              ))}
            </Carousel>
          )}
        </div>
      </section>

      <section
        id="avis"
        aria-labelledby="titre-avis"
        className="relative isolate mx-auto max-w-6xl scroll-mt-20 px-4 pt-16 sm:px-6"
      >
        <h2 id="titre-avis" className={titre}>
          Ils ont randonné avec nous
        </h2>
        <p className="mt-2 mb-6 text-gt-teal-900/75">
          Les avis sont déposés par les voyageurs après leur séjour.
        </p>
        {avis.length === 0 ? (
          <p className="text-sm text-gt-teal-900/75">Aucun avis publié pour l&apos;instant.</p>
        ) : (
          <ReviewList avis={avis} agenceSlug={agence.slug} showCircuit />
        )}
      </section>

      {partenaires.length > 0 ? (
        <section
          id="partenaires"
          aria-labelledby="titre-partenaires"
          className="relative isolate mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6"
        >
          <BlurBlobs preset="left" />
          <h2 id="titre-partenaires" className={titre}>
            Nos partenaires locaux
          </h2>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {partenaires.map((p) => (
              <li
                key={p.id}
                className="group overflow-hidden rounded-3xl bg-white shadow-md shadow-gt-teal-900/10 transition hover:-translate-y-1 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <div className="relative aspect-[4/3] bg-gt-teal-100">
                  {p.imageUrl ? (
                    <PartnerPhoto src={p.imageUrl} alt={`${p.nom}`} />
                  ) : (
                    <CircuitVisual landscapeKey={p.nom} className="size-full" />
                  )}
                  <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gt-teal-800 backdrop-blur">
                    {TYPE_PARTENAIRE_LABELS[p.type]}
                  </span>
                </div>
                <div className="p-5">
                  <p className="font-display text-lg font-medium text-gt-teal-900">{p.nom}</p>
                  {p.description ? (
                    <p className="mt-2 line-clamp-3 text-sm text-gt-teal-900/75">{p.description}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/** Photo d'un partenaire : optimisée si livrée avec l'application, sinon adresse externe. */
function PartnerPhoto({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith("/images/")) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 270px, (min-width: 640px) 50vw, 100vw"
        className="object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
    );
  }
  // Adresse saisie par l'agence : image externe non optimisée par Next.js.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="size-full object-cover" />;
}
