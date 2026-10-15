import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { type HeroSlide, HeroSlider } from "@/components/design/hero-slider";
import { SectionHeading } from "@/components/design/section-heading";
import { Icon, type IconName } from "@/components/ui/icon";
import { BlurBlobs } from "@/components/vitrine/blur-blobs";
import { formatMoney } from "@/lib/format";
import { creditFor } from "@/lib/photo-credits";
import { listPublicAgencies } from "@/lib/public-agency";
import { TRIAL_DAYS } from "@/lib/services/onboarding";
import { listActivePlans } from "@/lib/services/plateforme";

// Agences et plans lus en base à chaque visite (agence suspendue retirée aussitôt, RG 19).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Green Trek — Plateforme de circuits de randonnée pour agences de voyage",
  description:
    "Site vitrine, réservation en ligne sans surbooking, itinéraires optimisés et back-office pour les agences de randonnée.",
};

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "building",
    title: "Un site vitrine par agence",
    text: "Circuits, prochains départs, partenaires et recherche par date, difficulté et nombre de voyageurs.",
  },
  {
    icon: "ticket",
    title: "Réservation en ligne",
    text: "Tunnel de réservation, participants, paiement en ligne et facture avec QR code ; jamais de surbooking.",
  },
  {
    icon: "navigation",
    title: "Itinéraires optimisés",
    text: "Plus court, plus rapide ou plus facile : calcul par Dijkstra et A* sur le réseau de sentiers de l'agence.",
  },
  {
    icon: "gauge",
    title: "Back-office complet",
    text: "Circuits, départs, réservations, paiements, clients, guides, partenaires et tableau de bord.",
  },
  {
    icon: "shield",
    title: "Données isolées",
    text: "Chaque agence travaille dans son propre espace : aucune agence ne voit les données d'une autre.",
  },
  {
    icon: "users",
    title: "Toute l'équipe",
    text: "Administrateurs, personnel et guides, chacun avec ses droits ; les guides voient leurs participants.",
  },
];

/** Diapositives du hero : une photo créditée par message clé de la plateforme. */
function heroSlides(): HeroSlide[] {
  const photo = (src: string) => {
    const credit = creditFor(src);
    return {
      image: src,
      alt: credit?.sujet ?? "",
      credit: credit ? `Photo : ${credit.sujet} · ${credit.auteur}, ${credit.licence}` : null,
    };
  };
  return [
    {
      ...photo("/images/circuits/sentier-mahambo-doany-ambodiforaha.jpg"),
      accent: "bienvenue sur",
      title: "Green Trek",
      text: "La plateforme des agences de randonnée : site vitrine, réservation en ligne, itinéraires optimisés et back-office.",
      cta: { label: `Essai gratuit de ${TRIAL_DAYS} jours`, href: "/inscription-agence" },
    },
    {
      ...photo("/images/circuits/grande-traversee-isalo.jpg"),
      accent: "vendez",
      title: "Vos circuits en ligne",
      text: "Un site vitrine par agence : circuits, prochains départs et réservation sans surbooking.",
      cta: { label: "Voir le site d'une agence", href: "/a/green-trek-mada" },
    },
    {
      ...photo("/images/circuits/randonnee-cotiere-pirogue.jpg"),
      accent: "optimisez",
      title: "Vos itinéraires",
      text: "Plus court, plus rapide ou plus facile : Dijkstra et A* sur le réseau de sentiers de l'agence.",
      cta: { label: "Voir les fonctionnalités", href: "/#fonctionnalites" },
    },
    {
      ...photo("/images/circuits/forets-et-rizieres.jpg"),
      accent: "pilotez",
      title: "Votre agence",
      text: "Réservations, paiements, guides, partenaires et messagerie : toute l'équipe au même endroit.",
      cta: { label: "Voir les tarifs", href: "/tarifs" },
    },
  ];
}

/**
 * Landing SaaS de la plateforme (§7.5, P1) : présentation, atouts, fonctionnement, agences
 * clientes, aperçu des tarifs et appel à l'inscription. Textes fondés sur ce que la plateforme
 * fait réellement ; aucun chiffre d'audience ni témoignage inventé.
 */
export default async function HomePage() {
  const [agences, plans] = await Promise.all([listPublicAgencies(), listActivePlans()]);
  const essai = plans.find((p) => p.prixMensuel === 0);

  return (
    <>
      <HeroSlider slides={heroSlides()} label="Présentation de Green Trek" />

      <section
        id="fonctionnalites"
        aria-labelledby="titre-fonctionnalites"
        className="relative isolate mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6"
      >
        <BlurBlobs preset="both" />
        <SectionHeading
          id="titre-fonctionnalites"
          accent="tout-en-un"
          title="Tout ce qu'il faut pour vendre vos circuits"
        />
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-gt-mist/60">
              <span className="grid size-12 place-items-center rounded-2xl bg-gt-teal-50 text-gt-teal-700">
                <Icon name={f.icon} className="size-6" />
              </span>
              <h3 className="mt-4 text-lg font-medium text-gt-teal-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gt-teal-900/75">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titre-etapes" className="bg-gt-teal-900 py-20 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            id="titre-etapes"
            accent="en trois étapes"
            title="Comment ça marche"
            tone="dark"
          />
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              [
                "Inscrivez votre agence",
                `Votre espace et votre site vitrine sont créés aussitôt, avec un essai gratuit de ${TRIAL_DAYS} jours.`,
              ],
              [
                "Créez vos circuits",
                "Placez vos étapes sur la carte, reliez-les par des sentiers et programmez vos départs.",
              ],
              [
                "Recevez des réservations",
                "Vos voyageurs réservent et paient en ligne ; vous suivez tout depuis le tableau de bord.",
              ],
            ].map(([title, text], index) => (
              <li key={title} className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/15">
                <span className="font-display text-5xl font-bold text-gt-sand-300">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-lg font-medium text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/80">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {agences.length > 0 ? (
        <section
          id="agences"
          aria-labelledby="titre-agences"
          className="relative isolate mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6"
        >
          <BlurBlobs preset="left" />
          <SectionHeading id="titre-agences" accent="sur la plateforme" title="Les agences" />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agences.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/a/${a.slug}`}
                  className="group flex h-full flex-col rounded-3xl bg-white p-6 ring-1 ring-gt-mist/60 transition hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <p className="font-display text-lg font-medium text-gt-teal-900 group-hover:underline">
                    {a.nom}
                  </p>
                  {a.ville ? <p className="text-sm text-gt-teal-900/75">{a.ville}</p> : null}
                  {a.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-gt-teal-900/75">{a.description}</p>
                  ) : null}
                  <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-gt-teal-700">
                    Voir le site <Icon name="arrowRight" className="size-4" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="px-4 pb-16 sm:px-6">
        <div className="relative isolate mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 overflow-hidden rounded-[2rem] p-8 text-white sm:p-12">
          <Image
            src="/images/circuits/grande-traversee-isalo.jpg"
            alt=""
            fill
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="-z-10 object-cover"
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/55" />
          <div>
            <SectionHeading
              accent="à vous de jouer"
              title="Prêt à lancer votre agence en ligne ?"
              tone="dark"
            />
            <p className="mt-3 max-w-xl text-white/85">
              {essai
                ? `Commencez par l'essai gratuit, puis choisissez un plan à partir de ${formatMoney(
                    plans.find((p) => p.prixMensuel > 0)?.prixMensuel ?? 0,
                    "MGA",
                  )} par mois.`
                : "Découvrez nos plans."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/inscription-agence"
              className="rounded-full bg-gt-sand-300 px-6 py-3 text-sm font-semibold text-gt-teal-900 hover:bg-gt-sand-200"
            >
              Inscrire mon agence
            </Link>
            <Link
              href="/tarifs"
              className="rounded-full border border-white/70 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Voir les tarifs
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
