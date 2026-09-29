import type { Metadata } from "next";

import { MapExplorer } from "@/components/circuits/map-explorer";
import { requireAgencyUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listEtapes } from "@/lib/services/etapes";
import { listTroncons } from "@/lib/services/troncons";

export const metadata: Metadata = { title: "Carte du réseau — Green Trek" };

/** Graphe de l'agence sur carte : étapes (nœuds) et tronçons (arêtes), §6.1 et §6.5. */
export default async function EtapesPage() {
  const { user, db } = await requireAgencyUser();
  const [etapes, troncons] = await Promise.all([listEtapes(db), listTroncons(db)]);

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
      troncons={troncons}
      canEdit={can(user.role, "modifier", "etape")}
      canDelete={can(user.role, "supprimer", "etape")}
      canEditTroncons={can(user.role, "modifier", "troncon")}
      canDeleteTroncons={can(user.role, "supprimer", "troncon")}
    />
  );
}
