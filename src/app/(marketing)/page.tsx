import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";
import { BlurBlobs } from "@/components/vitrine/blur-blobs";
import { BrushEdge } from "@/components/vitrine/brush-edge";
import { formatMoney } from "@/lib/format";
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
    text: "Tunnel de réservation, participants, paiement simulé et facture avec QR code ; jamais de surbooking.",
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
      <section className="relative isolate overflow-hidden bg-gt-teal-900 text-white">
        <Image
          src="/images/collines-riviere.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-r from-gt-teal-900/90 via-gt-teal-900/70 to-gt-teal-900/20"
        />
        <div className="mx-auto max-w-6xl px-4 pt-20 pb-32 sm:px-6 sm:pt-28 sm:pb-40">
          <p className="inline-block rounded-full bg-gt-sand-200 px-4 py-1.5 text-sm font-semibold text-gt-teal-900">
            Pour les agences de randonnée et d&apos;écotourisme
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-medium text-gt-cream sm:text-6xl">
            Vos circuits, vos départs, vos réservations,{" "}
            <span className="font-script text-gt-sand-300">en un seul endroit</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/90 sm:text-lg">
            Green Trek donne à chaque agence son site vitrine, la réservation en ligne, le calcul
            d&apos;itinéraires optimisés et un back-office complet.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/inscription-agence"
              className="rounded-full bg-gt-sand-300 px-6 py-3 text-sm font-semibold text-gt-teal-900 hover:bg-gt-sand-200"
            >
              Essai gratuit de {TRIAL_DAYS} jours
            </Link>
            <Link
              href="/a/green-trek-mada"
              className="rounded-full border border-white/70 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Voir le site d&apos;une agence
            </Link>
          </div>
        </div>
        <BrushEdge />
      </section>

      <section
        id="fonctionnalites"
        aria-labelledby="titre-fonctionnalites"
        className="relative isolate mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6"
      >
        <BlurBlobs preset="both" />
        <h2
          id="titre-fonctionnalites"
          className="text-3xl font-medium text-gt-teal-800 sm:text-4xl"
        >
          Tout ce qu&apos;il faut pour vendre vos circuits
        </h2>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-3xl bg-white p-6 shadow-md ring-1 ring-gt-mist/60">
              <span className="grid size-12 place-items-center rounded-2xl bg-gt-teal-50 text-gt-teal-700">
                <Icon name={f.icon} className="size-6" />
              </span>
              <h3 className="mt-4 text-lg font-medium text-gt-teal-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gt-teal-900/70">{f.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titre-etapes" className="bg-gt-teal-50/70 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 id="titre-etapes" className="text-3xl font-medium text-gt-teal-800 sm:text-4xl">
            Comment ça marche
          </h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
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
              <li key={title} className="rounded-3xl bg-white p-6 ring-1 ring-gt-mist/60">
                <span className="font-script text-4xl text-gt-teal-600">{index + 1}</span>
                <h3 className="mt-2 text-lg font-medium text-gt-teal-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gt-teal-900/70">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {agences.length > 0 ? (
        <section
          id="agences"
          aria-labelledby="titre-agences"
          className="relative isolate mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6"
        >
          <BlurBlobs preset="left" />
          <h2 id="titre-agences" className="text-3xl font-medium text-gt-teal-800 sm:text-4xl">
            Elles utilisent Green Trek
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agences.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/a/${a.slug}`}
                  className="group flex h-full flex-col rounded-3xl bg-white p-6 ring-1 ring-gt-mist/60 transition hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <p className="font-display text-lg font-medium text-gt-teal-900 group-hover:underline">
                    {a.nom}
                  </p>
                  {a.ville ? <p className="text-sm text-gt-teal-900/60">{a.ville}</p> : null}
                  {a.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-gt-teal-900/70">{a.description}</p>
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
        <div className="relative isolate mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 overflow-hidden rounded-3xl bg-gt-teal-card p-8 text-white sm:p-10">
          <div>
            <h2 className="text-2xl font-medium text-gt-cream sm:text-3xl">
              Prêt à lancer votre agence en ligne ?
            </h2>
            <p className="mt-2 max-w-xl text-white/85">
              {essai
                ? `Commencez par l'essai gratuit, puis choisissez un plan à partir de ${formatMoney(
                    plans.find((p) => p.prixMensuel > 0)?.prixMensuel ?? 0,
                    "MGA",
                  )} par mois (tarifs fictifs de démonstration).`
                : "Découvrez nos plans (tarifs fictifs de démonstration)."}
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
