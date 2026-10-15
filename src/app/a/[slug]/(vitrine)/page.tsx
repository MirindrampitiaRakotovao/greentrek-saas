import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ReviewList } from "@/components/avis/review-list";
import { type HeroSlide, HeroSlider } from "@/components/design/hero-slider";
import { SectionHeading } from "@/components/design/section-heading";
import { formatDuree } from "@/components/vitrine/circuit-card";
import { CircuitCard } from "@/components/vitrine/circuit-card";
import { SearchBar } from "@/components/vitrine/search-bar";
import { BlurBlobs } from "@/components/vitrine/blur-blobs";
import { Carousel } from "@/components/vitrine/carousel";
import { CircuitVisual } from "@/components/vitrine/circuit-visual";
import {
  AdventureSection,
  ExperiencesSection,
  ThemeTiles,
} from "@/components/vitrine/home-sections";
import { UpcomingDepartCard } from "@/components/vitrine/upcoming-departs";
import { formatMoney } from "@/lib/format";
import { creditFor } from "@/lib/photo-credits";
import { getVitrineAgency, type VitrineAgency } from "@/lib/public-agency";
import { listPublicAvis } from "@/lib/services/avis";
import {
  listPublicPartenaires,
  listUpcomingDeparts,
  type PublicCircuitCard,
  searchCircuits,
} from "@/lib/services/vitrine";
import { TYPE_PARTENAIRE_LABELS } from "@/lib/validators/backoffice";
import { loadVitrine } from "@/lib/vitrine-page";

export async function generateMetadata({ params }: PageProps<"/a/[slug]">): Promise<Metadata> {
  const agence = await getVitrineAgency((await params).slug);
  return {
    title: agence ? agence.nom : "Agence introuvable",
    description: agence?.description ?? undefined,
  };
}

/** Mots manuscrits du hero, un par diapositive. */
const ACCENTS = ["bienvenue", "explorez", "vivez", "partez", "respirez"];

/**
 * Diapositives du hero : l'agence d'abord (photo d'accueil, nom, présentation), puis jusqu'à
 * quatre circuits publiés illustrés par une photo livrée avec l'application (créditée).
 */
function heroSlides(agence: VitrineAgency, circuits: readonly PublicCircuitCard[]): HeroSlide[] {
  const base = `/a/${agence.slug}`;
  const accueil: HeroSlide = {
    // TODO(photos Green Trek) : confirmer la source et la licence de la photo d'accueil (§8.1).
    image: "/images/hero-plage.jpg",
    alt: "Plage bordée de cocotiers au lever du soleil",
    credit: null,
    accent: ACCENTS[0]!,
    title: agence.nom,
    text: agence.description,
    cta: { label: "Découvrir nos circuits", href: `${base}/circuits` },
  };
  const circuitSlides = circuits
    .filter((c) => c.imagePrincipaleUrl?.startsWith("/images/"))
    .slice(0, 4)
    .map((c, i): HeroSlide => {
      const credit = creditFor(c.imagePrincipaleUrl);
      return {
        image: c.imagePrincipaleUrl!,
        alt: credit?.sujet ?? c.titre,
        credit: credit ? `Photo : ${credit.sujet} · ${credit.auteur}, ${credit.licence}` : null,
        accent: ACCENTS[(i + 1) % ACCENTS.length]!,
        title: c.titre,
        text: c.resume,
        cta: { label: "Voir le circuit", href: `${base}/circuits/${c.slug}` },
        meta: `${formatDuree(c.dureeJours)} · à partir de ${formatMoney(c.prixMin, agence.devise)} / pers.`,
      };
    });
  return [accueil, ...circuitSlides];
}

/**
 * Accueil du site vitrine (§7.1). Hero plein écran à diapositives (l'agence, puis ses
 * circuits) d'après la maquette choisie par l'étudiant après E12, à la place du hero de la
 * maquette du §8.4 ; puis la recherche flottante, le carrousel des circuits, « Vivre Madagascar
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
  const slides = heroSlides(agence, circuits);

  return (
    <>
      <HeroSlider slides={slides} label={`Bienvenue chez ${agence.nom}`} />

      <div className="relative mx-auto -mt-12 max-w-6xl px-4 sm:px-6">
        <SearchBar agenceSlug={agence.slug} today={today} />
      </div>

      <section
        aria-labelledby="titre-circuits"
        className="relative isolate mx-auto max-w-6xl px-4 pt-16 sm:px-6"
      >
        <BlurBlobs preset="right" />
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <SectionHeading id="titre-circuits" accent="explorez" title="Nos circuits" />
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
        className="relative isolate scroll-mt-20 overflow-hidden bg-gt-teal-900 py-20"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8">
            <SectionHeading
              id="titre-departs"
              accent="prochainement"
              title="Prochains départs"
              tone="dark"
            />
          </div>
          {departs.length === 0 ? (
            <p className="text-sm text-white/85">Aucun départ ouvert pour l&apos;instant.</p>
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
        <div className="mb-8">
          <SectionHeading id="titre-avis" accent="ils racontent" title="Ils ont randonné avec nous">
            Les avis sont déposés par les voyageurs après leur séjour.
          </SectionHeading>
        </div>
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
          <SectionHeading id="titre-partenaires" accent="ensemble" title="Nos partenaires locaux" />
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
