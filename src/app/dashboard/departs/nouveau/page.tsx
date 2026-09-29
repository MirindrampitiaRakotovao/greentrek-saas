import type { Metadata } from "next";
import Link from "next/link";

import { DepartForm } from "@/components/departs/depart-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, EmptyState } from "@/components/dashboard/widgets";
import { requireAgencyUser } from "@/lib/auth/session";
import { calendarDate } from "@/lib/dates";
import { toIsoDate } from "@/lib/departs";
import { getAgencySettings } from "@/lib/services/agency-settings";

export const metadata: Metadata = { title: "Programmer un départ — Green Trek" };

/** Programmation d'un départ : ADMIN_AGENCE et STAFF (matrice §3). */
export default async function NouveauDepartPage({
  searchParams,
}: PageProps<"/dashboard/departs/nouveau">) {
  const { user, db } = await requireAgencyUser(["ADMIN_AGENCE", "STAFF"]);
  const circuitParam = (await searchParams).circuit;
  const [circuits, guides, { devise }] = await Promise.all([
    // Décision A : circuits publiés ou brouillons, pas les archivés.
    db.circuit.findMany({
      where: { statut: { not: "ARCHIVE" } },
      orderBy: { titre: "asc" },
      select: { id: true, titre: true, dureeJours: true, capaciteMax: true, prixParPersonne: true },
    }),
    db.guide.findMany({
      where: { actif: true },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      select: { id: true, prenom: true, nom: true },
    }),
    getAgencySettings(db, user.agenceId),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dashboard/departs" className="text-sm font-medium text-gt-teal-700 underline">
        ← Retour aux départs
      </Link>
      <PageHeader
        title="Programmer un départ"
        description="Un départ ouvre les réservations d'un circuit à des dates données."
      />
      <Card>
        {circuits.length === 0 ? (
          <EmptyState>Créez d&apos;abord un circuit.</EmptyState>
        ) : (
          <DepartForm
            circuits={circuits}
            guides={guides.map((g) => ({ id: g.id, label: `${g.prenom} ${g.nom}` }))}
            devise={devise}
            // Date du jour calculée sur le serveur, dans le fuseau de Madagascar.
            today={toIsoDate(calendarDate(new Date()))}
            defaultCircuitId={typeof circuitParam === "string" ? circuitParam : undefined}
          />
        )}
      </Card>
    </div>
  );
}
