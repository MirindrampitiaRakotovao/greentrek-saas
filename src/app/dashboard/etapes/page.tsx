import type { Metadata } from "next";

import { MapExplorer } from "@/components/circuits/map-explorer";
import { requireAgencyUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listEtapes } from "@/lib/services/etapes";

export const metadata: Metadata = { title: "Étapes et carte — Green Trek" };

/** Étapes de l'agence sur carte : les nœuds du graphe (§6.1). */
export default async function EtapesPage() {
  const { user, db } = await requireAgencyUser();
  const etapes = await listEtapes(db);

  return (
    <MapExplorer
      etapes={etapes.map((e) => ({
        id: e.id,
        nom: e.nom,
        type: e.type,
        description: e.description,
        latitude: e.latitude,
        longitude: e.longitude,
        altitudeM: e.altitudeM,
        usages:
          e._count.tronconsDepart +
          e._count.tronconsArrivee +
          e._count.circuits +
          e._count.circuitPartenaires,
        circuits: [...new Map(e.circuits.map((c) => [c.circuit.id, c.circuit])).values()],
      }))}
      canEdit={can(user.role, "modifier", "etape")}
      canDelete={can(user.role, "supprimer", "etape")}
    />
  );
}
