import type { Metadata } from "next";

import { AmountsChart } from "@/components/dashboard/amounts-chart";
import { RingsChart } from "@/components/dashboard/rings-chart";
import { Card, KpiCard } from "@/components/dashboard/widgets";
import { Badge } from "@/components/ui/badge";
import { getAdminDb } from "@/lib/admin-db";
import { requireUser } from "@/lib/auth/session";
import { getPlatformDashboard } from "@/lib/dashboard/platform";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Vue plateforme — Green Trek" };

const PLAN_COLORS = ["#00899e", "#c98a1b", "#0f414d", "#b9c4c6"];

/** Vue plateforme du super admin : comptages globaux, montants par agence (devises distinctes). */
export default async function AdminPage() {
  await requireUser({ roles: ["SUPER_ADMIN"] });
  const data = await getPlatformDashboard(getAdminDb());
  const totalAgences = data.agences.actives + data.agences.suspendues;

  return (
    <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
      <div className="min-w-0 space-y-5 lg:col-span-2 xl:col-span-3">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon="building"
            label="Agences actives"
            value={String(data.agences.actives)}
            detail={`${data.agences.suspendues} suspendue(s)`}
          />
          <KpiCard
            icon="ticket"
            label="Réservations du mois"
            value={String(data.reservationsMois.value)}
            change={data.reservationsMois.change}
            detail={`${data.reservationsMois.previous} le mois dernier`}
          />
          <KpiCard
            icon="calendar"
            label="Départs à venir"
            value={String(data.departsAVenir)}
            detail="toutes agences"
          />
          <KpiCard
            icon="users"
            label="Agences inscrites"
            value={String(totalAgences)}
            detail="sur la plateforme"
          />
        </div>

        <Card title="Réservations sur la plateforme">
          <AmountsChart
            data={{ "12m": data.chart }}
            ranges={["12m"]}
            defaultRange="12m"
            unit="count"
            devise="MGA"
            series={[{ key: "reservations", label: "Réservations", color: "#00899e" }]}
          />
        </Card>

        <Card title="Agences">
          <div className="relative -mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Agences de la plateforme</caption>
              <thead className="text-xs text-gt-teal-900/55">
                <tr className="border-b border-gt-mist/70">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Agence
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Plan
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Circuits
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Équipe
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Réservations (mois)
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Montant (mois)
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gt-mist/60">
                {data.tableau.map((a) => (
                  <tr key={a.id}>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-gt-teal-900">{a.nom}</p>
                      <p className="text-xs text-gt-teal-900/60">/a/{a.slug}</p>
                    </td>
                    <td className="py-3 pr-3 text-gt-teal-900/80">
                      {a.plan ?? "—"}
                      {a.abonnementStatut === "ESSAI" ? (
                        <span className="ml-1 text-xs text-gt-teal-900/60">(essai)</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-right">{a.circuits}</td>
                    <td className="py-3 pr-3 text-right">{a.utilisateurs}</td>
                    <td className="py-3 pr-3 text-right">{a.reservationsMois}</td>
                    <td className="py-3 pr-3 text-right font-semibold whitespace-nowrap text-gt-teal-900">
                      {formatMoney(a.montantMois, a.devise)}
                    </td>
                    <td className="py-3">
                      <Badge tone={a.statut === "ACTIVE" ? "success" : "danger"}>
                        {a.statut === "ACTIVE" ? "Active" : "Suspendue"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="min-w-0 space-y-5">
        <Card title="Agences par plan">
          <RingsChart
            items={data.abonnements.map((a, index) => ({
              label: a.plan,
              value: a.count,
              color: PLAN_COLORS[index % PLAN_COLORS.length]!,
            }))}
            totalLabel="Agences"
            totalValue={String(totalAgences)}
          />
        </Card>
      </div>
    </div>
  );
}
