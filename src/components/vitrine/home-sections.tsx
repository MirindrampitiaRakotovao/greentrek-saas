import Image from "next/image";
import Link from "next/link";

import { SectionHeading } from "@/components/design/section-heading";
import { Icon, type IconName } from "@/components/ui/icon";

/*
 * Sections de présentation de l'accueil du site vitrine (§8.4, sections 5 à 7), harmonisées
 * après E12 avec le hero plein écran (sections sombres, titres géants, photos pleine largeur).
 * Communes à toutes les agences : aucun élément propre à une région (pas de « côte Est », de
 * pirogue ni de plage dans les textes). Textes génériques fondés sur le cahier des charges (circuits
 * reliant des villages, partenaires locaux : hébergement, restauration, piroguiers) : aucun
 * chiffre ni fait inventé.
 *
 * Photos fournies par l'étudiant (`public/images/`). TODO(photos Green Trek) : confirmer la
 * source et la licence de chaque photo (§8.1) et les remplacer, à terme, par des photos de
 * la région de Mahambo. Les textes alternatifs décrivent l'image sans nommer de lieu : aucune
 * photo n'est présentée comme prise à Madagascar.
 */

const PHOTOS = {
  sentier: { src: "/images/sentier-foret.jpg", alt: "Sentier dans une forêt tropicale" },
  couchant: { src: "/images/plage-couchant.jpg", alt: "Plage et cocotiers au coucher du soleil" },
  paillote: { src: "/images/plage-paillote.jpg", alt: "Paillote sur une plage de sable blanc" },
  collines: {
    src: "/images/collines-riviere.jpg",
    alt: "Collines boisées et rivière au lever du soleil",
  },
  foret: { src: "/images/foret.jpg", alt: "Forêt ensoleillée" },
} as const;

/** Photo ronde du collage, cerclée de blanc. */
function RoundPhoto({
  photo,
  className,
  sizes,
}: {
  photo: (typeof PHOTOS)[keyof typeof PHOTOS];
  className: string;
  sizes: string;
}) {
  return (
    <div
      className={`absolute overflow-hidden rounded-full shadow-2xl ring-8 ring-gt-teal-900 ${className}`}
    >
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} className="object-cover" />
    </div>
  );
}

/** Section 5 : « Vivre Madagascar autrement » (fond sombre), pictogrammes et collage de photos. */
export function ExperiencesSection({ agenceSlug }: { agenceSlug: string }) {
  const experiences: { icon: IconName; label: string }[] = [
    { icon: "mountain", label: "Randonnée" },
    { icon: "leaf", label: "Grands espaces" },
    { icon: "home", label: "Immersion au village" },
  ];
  return (
    <section
      id="experiences"
      aria-labelledby="titre-experiences"
      className="scroll-mt-20 bg-gt-teal-900 text-white"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
        <div>
          <SectionHeading
            id="titre-experiences"
            accent="écotourisme"
            title="Vivre Madagascar autrement"
            tone="dark"
          >
            Des circuits à pied qui relient villages, forêts et grands paysages, préparés avec des
            partenaires locaux : hébergement, repas et activités. Une autre façon de découvrir
            Madagascar, au rythme de ceux qui y vivent.
          </SectionHeading>
          <ul className="mt-10 grid grid-cols-3 gap-4">
            {experiences.map((e) => (
              <li key={e.label} className="flex flex-col items-center gap-2 text-center">
                <span className="grid size-16 place-items-center rounded-2xl bg-white/10 text-gt-sand-300 ring-1 ring-white/15">
                  <Icon name={e.icon} className="size-8" />
                </span>
                <span className="text-sm font-medium text-white">{e.label}</span>
              </li>
            ))}
          </ul>
          <Link
            href={`/a/${agenceSlug}/circuits`}
            className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/85 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-gt-teal-900"
          >
            <Icon name="play" className="size-3.5 text-gt-sand-300" />
            Découvrir nos circuits
          </Link>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[460px]">
          <RoundPhoto
            photo={PHOTOS.sentier}
            sizes="(min-width: 1024px) 320px, 70vw"
            className="top-0 right-0 size-[70%]"
          />
          <RoundPhoto
            photo={PHOTOS.couchant}
            sizes="(min-width: 1024px) 200px, 45vw"
            className="bottom-[4%] left-0 size-[44%]"
          />
          <RoundPhoto
            photo={PHOTOS.paillote}
            sizes="(min-width: 1024px) 150px, 32vw"
            className="right-[8%] bottom-0 size-[32%]"
          />
          <span
            aria-hidden="true"
            className="absolute top-[8%] left-[6%] size-16 rounded-full bg-gt-sand-300/80"
          />
        </div>
      </div>
    </section>
  );
}

/** Section 6 : grande photo pleine largeur, titre géant et tuiles-icônes sur fond sombre. */
export function AdventureSection() {
  const atouts: { icon: IconName; label: string }[] = [
    { icon: "compass", label: "Guide local" },
    { icon: "building", label: "Hébergement" },
    { icon: "utensils", label: "Repas ruraux" },
    { icon: "handshake", label: "Partenaires locaux" },
    { icon: "shield", label: "Sécurité" },
    { icon: "users", label: "Petits groupes" },
  ];
  return (
    <section aria-labelledby="titre-aventure" className="relative isolate overflow-hidden">
      <Image
        src={PHOTOS.collines.src}
        alt={PHOTOS.collines.alt}
        fill
        sizes="100vw"
        className="-z-10 object-cover"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/45" />
      <div className="mx-auto grid max-w-6xl items-end gap-10 px-4 py-24 sm:px-6 sm:py-32 lg:grid-cols-2">
        <SectionHeading
          id="titre-aventure"
          accent="pourquoi nous"
          title="Le meilleur pour votre aventure"
          tone="dark"
        >
          Chaque circuit est encadré et organisé avec nos partenaires : vous marchez, nous nous
          occupons du reste.
        </SectionHeading>
        <ul className="grid grid-cols-3 gap-3">
          {atouts.map((a) => (
            <li
              key={a.label}
              className="flex flex-col items-center gap-2 rounded-2xl bg-black/30 px-2 py-5 text-center text-white ring-1 ring-white/20 backdrop-blur-sm"
            >
              <Icon name={a.icon} className="size-7 text-gt-sand-300" />
              <span className="text-xs font-medium">{a.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Section 7 : rangée de tuiles photo thématiques, avec bouton. */
export function ThemeTiles({ agenceSlug }: { agenceSlug: string }) {
  const tiles = [
    { label: "Sentiers", photo: PHOTOS.sentier },
    { label: "Rivières", photo: PHOTOS.collines },
    { label: "Couchers de soleil", photo: PHOTOS.couchant },
    { label: "Forêts", photo: PHOTOS.foret },
  ];
  return (
    <section aria-labelledby="titre-themes" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mb-8">
        <SectionHeading id="titre-themes" accent="inspirez-vous" title="Au fil des sentiers" />
      </div>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link
              href={`/a/${agenceSlug}/circuits`}
              className="group relative flex aspect-[3/4] items-end overflow-hidden rounded-3xl"
            >
              <Image
                src={t.photo.src}
                alt=""
                fill
                sizes="(min-width: 1024px) 270px, 50vw"
                className="object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-gt-teal-900/85 via-gt-teal-900/20 to-transparent"
              />
              <span className="relative flex w-full flex-col items-center gap-3 p-5 text-center">
                <span className="font-display text-xl font-medium text-white sm:text-2xl">
                  {t.label}
                </span>
                <span className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-gt-teal-800 group-hover:bg-gt-sand-300">
                  Découvrir
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
