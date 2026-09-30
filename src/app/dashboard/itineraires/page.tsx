import type { Metadata } from "next";

import { Pagination } from "@/components/dashboard/pagination";
import { Card, EmptyState } from "@/components/dashboard/widgets";
import { ItineraryPlanner } from "@/components/itineraires/itinerary-planner";
import { requireAgencyUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { CRITERIA_LABELS } from "@/lib/graph/weights";
import { parsePage } from "@/lib/pagination";
import { listHistorique } from "@/lib/services/itineraires";

export const metadata: Metadata = { title: "Calcul d'itinéraire — Green Trek" };

/** Calcul d'itinéraire sur le réseau de l'agence (§6.5) et historique des calculs (§6.3). */
export default async function ItinerairesPage({
  searchParams,
}: PageProps<"/dashboard/itineraires">) {
  const { db } = await requireAgencyUser();
  const page = parsePage((await searchParams).page);
  const [etapes, troncons, historique] = await Promise.all([
    db.etape.findMany({
      select: { id: true, nom: true, latitude: true, longitude: true },
      orderBy: { nom: "asc" },
    }),
    db.troncon.findMany({
      select: { id: true, etapeDepartId: true, etapeArriveeId: true, distanceEstimee: true },
    }),
    listHistorique(db, page),
  ]);

  return (
    <div className="space-y-5">
      <ItineraryPlanner
        etapes={etapes}
        troncons={troncons.map((t) => ({
          id: t.id,
          from: t.etapeDepartId,
          to: t.etapeArriveeId,
          estime: t.distanceEstimee,
        }))}
      />

      <Card title={`Historique des calculs (${historique.total})`}>
        {historique.total === 0 ? (
          <EmptyState>Aucun calcul pour l&apos;instant.</EmptyState>
        ) : (
          <div className="relative -mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Derniers itinéraires calculés</caption>
              <thead className="text-xs text-gt-teal-900/75">
                <tr className="border-b border-gt-mist/70">
                  {[
                    "Date",
                    "Itinéraire",
                    "Algorithme",
                    "Critère",
                    "Distance",
                    "Durée",
                    "Nœuds explorés",
                    "Temps",
                  ].map((h) => (
                    <th key={h} scope="col" className="py-2 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gt-mist/60">
                {historique.items.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-gt-teal-900/75">
                      {formatDateTime(h.createdAt)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-gt-teal-900">
                        {h.etapeDepart?.nom ?? "étape supprimée"} →{" "}
                        {h.etapeArrivee?.nom ?? "étape supprimée"}
                      </p>
                      <p className="text-xs text-gt-teal-900/75">
                        {h.circuit ? `Tracé du circuit « ${h.circuit.titre} » · ` : ""}
                        {h.creePar ? `${h.creePar.prenom} ${h.creePar.nom}` : ""}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3">{h.algorithme === "ASTAR" ? "A*" : "Dijkstra"}</td>
                    <td className="py-2.5 pr-3">{CRITERIA_LABELS[h.critere]}</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {h.distanceTotaleKm.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} km
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">{h.dureeTotaleMin} min</td>
                    <td className="py-2.5 pr-3">{h.noeudsExplores}</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {h.tempsCalculMs.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          basePath="/dashboard/itineraires"
          page={historique.page}
          pageCount={historique.pageCount}
        />
      </Card>
    </div>
  );
}
