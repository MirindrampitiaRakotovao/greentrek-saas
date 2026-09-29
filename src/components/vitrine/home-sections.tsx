import Image from "next/image";
import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";
import { BlurBlobs } from "@/components/vitrine/blur-blobs";
import { BrushEdge } from "@/components/vitrine/brush-edge";

/*
 * Sections de présentation de l'accueil du site vitrine (§8.4, sections 5 à 7), d'après la
 * structure de la maquette. Textes génériques fondés sur le cahier des charges (circuits
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
      className={`absolute overflow-hidden rounded-full shadow-xl ring-8 ring-white ${className}`}
    >
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} className="object-cover" />
    </div>
  );
}

/** Section 5 : « Vivre Madagascar autrement », trois pictogrammes et collage de photos rondes. */
export function ExperiencesSection({ agenceSlug }: { agenceSlug: string }) {
  const experiences: { icon: IconName; label: string }[] = [
    { icon: "mountain", label: "Randonnée" },
    { icon: "anchor", label: "Pirogue" },
    { icon: "home", label: "Immersion au village" },
  ];
  return (
    <section
      id="experiences"
      aria-labelledby="titre-experiences"
      className="relative isolate mx-auto grid max-w-6xl scroll-mt-20 items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24"
    >
      <BlurBlobs preset="both" />
      <div>
        <p className="text-sm font-semibold tracking-wide text-gt-teal-600 uppercase">
          Écotourisme
        </p>
        <h2
          id="titre-experiences"
          className="mt-2 text-3xl font-medium text-gt-teal-800 sm:text-4xl"
        >
          Vivre Madagascar autrement
        </h2>
        <p className="mt-4 leading-relaxed text-gt-teal-900/75">
          Des circuits à pied qui relient villages, forêts et littoral, préparés avec des
          partenaires locaux : hébergement, repas, activités nautiques et traversées en pirogue. Une
          autre façon de découvrir la côte Est, au rythme de ceux qui y vivent.
        </p>
        <ul className="mt-8 grid grid-cols-3 gap-4">
          {experiences.map((e) => (
            <li key={e.label} className="flex flex-col items-center gap-2 text-center">
              <span className="grid size-16 place-items-center rounded-2xl bg-gt-teal-50 text-gt-teal-700">
                <Icon name={e.icon} className="size-8" />
              </span>
              <span className="text-sm font-medium text-gt-teal-900">{e.label}</span>
            </li>
          ))}
        </ul>
        <Link
          href={`/a/${agenceSlug}/circuits`}
          className="mt-8 inline-block rounded-full bg-gt-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-gt-teal-800"
        >
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
    </section>
  );
}

/** Section 6 : grande photo plein cadre avec carte teal sombre et tuiles-icônes. */
export function AdventureSection() {
  const atouts: { icon: IconName; label: string }[] = [
    { icon: "compass", label: "Guide local" },
    { icon: "building", label: "Hébergement" },
    { icon: "utensils", label: "Repas ruraux" },
    { icon: "anchor", label: "Pirogue" },
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
      <BrushEdge position="top" />
      <div className="mx-auto flex max-w-6xl justify-end px-4 py-20 sm:px-6 sm:py-28">
        <div className="w-full max-w-md rounded-3xl bg-gt-teal-card/95 p-7 text-white shadow-2xl backdrop-blur-sm sm:p-8">
          <p className="text-sm font-semibold tracking-wide text-gt-sand-300 uppercase">
            Pourquoi partir avec nous
          </p>
          <h2 id="titre-aventure" className="mt-2 text-3xl font-medium text-gt-cream">
            Le meilleur pour votre aventure
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/85">
            Chaque circuit est encadré et organisé avec nos partenaires : vous marchez, nous nous
            occupons du reste.
          </p>
          <ul className="mt-6 grid grid-cols-3 gap-3">
            {atouts.map((a) => (
              <li
                key={a.label}
                className="flex flex-col items-center gap-2 rounded-2xl bg-white/10 px-2 py-4 text-center ring-1 ring-white/15"
              >
                <Icon name={a.icon} className="size-7 text-gt-sand-300" />
                <span className="text-xs font-medium">{a.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <BrushEdge position="bottom" />
    </section>
  );
}

/** Section 7 : rangée de tuiles photo thématiques, avec bouton. */
export function ThemeTiles({ agenceSlug }: { agenceSlug: string }) {
  const tiles = [
    { label: "Sentiers", photo: PHOTOS.sentier },
    { label: "Rivière et pirogue", photo: PHOTOS.collines },
    { label: "Plages", photo: PHOTOS.couchant },
    { label: "Actions écologiques", photo: PHOTOS.foret },
  ];
  return (
    <section aria-label="Thèmes de nos circuits" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
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
