import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { ItineraryPlanner } from "@/components/itineraires/itinerary-planner";
import { requireClient } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Créer mon itinéraire" };

/**
 * Le voyageur compose son itinéraire sur le réseau de SON agence (étape 4b) : départ,
 * arrivée, villages à visiter, critère ; le meilleur itinéraire s'affiche, puis il l'envoie
 * à l'agence.
 */
export default async function NouvelItinerairePage({
  params,
}: PageProps<"/a/[slug]/mon-compte/itineraires/nouveau">) {
  const { slug } = await params;
  const { db } = await requireClient(slug, `/a/${slug}/mon-compte/itineraires/nouveau`);
  const [etapes, troncons] = await Promise.all([
    db.etape.findMany({
      select: { id: true, nom: true, latitude: true, longitude: true },
      orderBy: { nom: "asc" },
    }),
    db.troncon.findMany({
      select: { id: true, etapeDepartId: true, etapeArriveeId: true, distanceEstimee: true },
    }),
  ]);
  return (
    <div className="space-y-5">
      <Link
        href={`/a/${slug}/mon-compte/itineraires`}
        className="text-sm font-medium text-gt-teal-700 underline"
      >
        ← Mes itinéraires
      </Link>
      <PageHeader
        title="Créer mon itinéraire"
        description="Choisissez votre départ, votre arrivée et les villages à visiter : le meilleur itinéraire le long des sentiers s'affiche. Envoyez-le ensuite à l'agence pour organiser votre randonnée."
      />
      <ItineraryPlanner
        etapes={etapes}
        troncons={troncons.map((t) => ({
          id: t.id,
          from: t.etapeDepartId,
          to: t.etapeArriveeId,
          estime: t.distanceEstimee,
        }))}
        voyageur={{ agenceSlug: slug }}
      />
    </div>
  );
}
