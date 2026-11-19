import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { ItineraryPlanner } from "@/components/itineraires/itinerary-planner";
import { requireAgencyUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getClientDetail } from "@/lib/services/clients";

export const metadata: Metadata = { title: "Composer un itinéraire — Green Trek" };

/**
 * L'agence compose un itinéraire sur mesure pour un client (après E12) : même calculateur que
 * « Calcul d'itinéraire », en vocabulaire simple, puis envoi au client.
 */
export default async function ComposeItinerairePage({
  params,
}: PageProps<"/dashboard/clients/[id]/itineraire">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  if (!can(user.role, "creer", "reservation")) notFound();
  const { id } = await params;
  const client = await getClientDetail(db, id);
  if (!client || !client.actif) notFound();
  const [etapes, troncons] = await Promise.all([
    db.etape.findMany({
      select: { id: true, nom: true, latitude: true, longitude: true },
      orderBy: { nom: "asc" },
    }),
    db.troncon.findMany({
      select: { id: true, etapeDepartId: true, etapeArriveeId: true, distanceEstimee: true },
    }),
  ]);
  const nom = `${client.prenom} ${client.nom}`;

  return (
    <div className="space-y-5">
      <Link
        href={`/dashboard/clients/${client.id}`}
        className="text-sm font-medium text-gt-teal-700 underline"
      >
        ← Retour à la fiche de {nom}
      </Link>
      <PageHeader
        title={`Itinéraire pour ${nom}`}
        description="Choisissez le départ, l'arrivée et les villages à visiter ; calculez, puis envoyez l'itinéraire au client, qui le verra sur la carte dans son espace et l'application."
      />
      <ItineraryPlanner
        etapes={etapes}
        troncons={troncons.map((t) => ({
          id: t.id,
          from: t.etapeDepartId,
          to: t.etapeArriveeId,
          estime: t.distanceEstimee,
        }))}
        proposeTo={{ clientId: client.id, nom }}
      />
    </div>
  );
}
