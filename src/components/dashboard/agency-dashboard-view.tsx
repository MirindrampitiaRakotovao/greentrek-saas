import { AmountsChart } from "@/components/dashboard/amounts-chart";
import { RingsChart } from "@/components/dashboard/rings-chart";
import {
  Card,
  EmptyState,
  KpiCard,
  ProgressBar,
  STATUT_LABELS,
  StatusPill,
  Timeline,
  type TimelineEvent,
} from "@/components/dashboard/widgets";
import { Icon } from "@/components/ui/icon";
import type { AgencyDashboard } from "@/lib/dashboard/agency";
import { formatDate, formatMoney } from "@/lib/format";

/**
 * Tableau de bord de l'agence, disposé comme la maquette validée :
 * colonne large (indicateurs, courbe, tableau) | colonne centrale (répartition, départs) |
 * colonne droite (abonnement, circuits phares, activité).
 */

const RING_COLORS = {
  CONFIRMEE: "#00899e",
  EN_ATTENTE: "#c98a1b",
  TERMINEE: "#0f414d",
  ANNULEE: "#b9c4c6",
} as const;

const ACTIVITY_ICONS = { reservation: "ticket", paiement: "coins", annulation: "xCircle" } as const;

const SUBSCRIPTION_STATUS: Record<string, string> = {
  ACTIF: "Actif",
  ESSAI: "Essai",
  EXPIRE: "Expiré",
  ANNULE: "Annulé",
};

function signedMoney(value: number, devise: string): string {
  return `${value >= 0 ? "+" : "−"}${formatMoney(Math.abs(value), devise)}`;
}

const shortDate = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC", // dates de départ : colonnes SQL DATE (minuit UTC)
});

export function AgencyDashboardView({
  data,
  showSubscription,
  now,
}: {
  data: AgencyDashboard;
  showSubscription: boolean;
  now: Date;
}) {
  const { kpis, devise } = data;
  const totalStatuts = data.statuts.reduce((n, s) => n + s.count, 0);
  const activity: TimelineEvent[] = data.activite.map((event) => ({
    id: event.id,
    icon: ACTIVITY_ICONS[event.kind],
    titre: event.titre,
    detail: event.detail,
    at: event.at,
  }));

  return (
    <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
      {/* ── Colonne large ── */}
      <div className="min-w-0 space-y-5 lg:col-span-2">
        <div className="grid gap-5 sm:grid-cols-2">
          <KpiCard
            icon="ticket"
            label="Réservations du mois"
            value={kpis.reservations.value.toLocaleString("fr-FR")}
            change={kpis.reservations.change}
            detail={`${kpis.reservations.value - kpis.reservations.previous >= 0 ? "+" : ""}${
              kpis.reservations.value - kpis.reservations.previous
            } vs mois dernier`}
          />
          <KpiCard
            icon="wallet"
            label="Montant réservé"
            value={formatMoney(kpis.montantReserve.value, devise)}
            change={kpis.montantReserve.change}
            detail={`${signedMoney(kpis.montantReserve.value - kpis.montantReserve.previous, devise)} vs mois dernier`}
          />
          <KpiCard
            icon="coins"
            label="Paiements encaissés"
            value={formatMoney(kpis.encaisse.value, devise)}
            change={kpis.encaisse.change}
            detail={`${signedMoney(kpis.encaisse.value - kpis.encaisse.previous, devise)} vs mois dernier`}
          />
          <KpiCard
            icon="gauge"
            label="Taux de remplissage"
            value={kpis.remplissage.taux === null ? "—" : `${kpis.remplissage.taux} %`}
            detail={`${kpis.remplissage.reservees}/${kpis.remplissage.places} places · ${kpis.remplissage.departs} départs`}
          />
        </div>

        <Card title="Montants réservés et encaissés">
          <AmountsChart
            data={data.chart}
            devise={devise}
            defaultRange="12m"
            series={[
              { key: "reserve", label: "Montant réservé", color: "#00899e" },
              { key: "encaisse", label: "Paiements encaissés", color: "#c98a1b", area: false },
            ]}
          />
        </Card>

        <Card title="Dernières réservations">
          {data.dernieresReservations.length === 0 ? (
            <EmptyState>Aucune réservation pour l&apos;instant.</EmptyState>
          ) : (
            <div className="relative -mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[520px] text-left text-sm">
                <caption className="sr-only">Six dernières réservations</caption>
                <thead className="text-xs text-gt-teal-900/75">
                  <tr className="border-b border-gt-mist/70">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Réservation
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Circuit
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Départ
                    </th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">
                      Montant
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gt-mist/60">
                  {data.dernieresReservations.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-gt-teal-900">{r.reference}</p>
                        <p className="text-xs text-gt-teal-900/75">{r.client}</p>
                      </td>
                      <td className="max-w-[140px] truncate py-3 pr-3 text-gt-teal-900/80">
                        {r.circuit}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-gt-teal-900/80">
                        {shortDate.format(r.dateDepart)}
                      </td>
                      <td className="py-3 pr-3 text-right font-semibold whitespace-nowrap text-gt-teal-900">
                        {formatMoney(r.montant, devise)}
                      </td>
                      <td className="py-3">
                        <StatusPill statut={r.statut} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Colonne centrale ── */}
      <div className="min-w-0 space-y-5">
        <Card title="Répartition des réservations">
          <RingsChart
            items={data.statuts.map((s) => ({
              label: STATUT_LABELS[s.statut],
              value: s.count,
              color: RING_COLORS[s.statut],
            }))}
            totalLabel="Réservations sur 12 mois"
            totalValue={totalStatuts.toLocaleString("fr-FR")}
          />
        </Card>

        <Card title="Prochains départs">
          <p className="text-xs text-gt-teal-900/75">Places réservées</p>
          <p className="text-2xl font-bold tracking-tight text-gt-teal-900">
            {kpis.remplissage.reservees}
            <span className="text-base font-medium text-gt-teal-900/75">
              {" "}
              / {kpis.remplissage.places}
            </span>
          </p>
          {data.prochainsDeparts.length === 0 ? (
            <div className="mt-4">
              <EmptyState>Aucun départ programmé.</EmptyState>
            </div>
          ) : (
            <ul className="mt-4 space-y-5">
              {data.prochainsDeparts.map((d) => (
                <li key={d.id}>
                  <p className="truncate text-sm font-semibold text-gt-teal-900">{d.circuit}</p>
                  <p className="mb-2 text-xs text-gt-teal-900/75">
                    {shortDate.format(d.dateDebut)}
                    {d.dateFin.getTime() !== d.dateDebut.getTime()
                      ? ` → ${shortDate.format(d.dateFin)}`
                      : ""}
                    {d.guide ? ` · ${d.guide}` : " · guide à affecter"}
                  </p>
                  <ProgressBar
                    value={d.reservees}
                    max={d.places}
                    label={`Remplissage du départ ${d.circuit}`}
                  />
                  <p className="mt-1.5 flex justify-between text-xs text-gt-teal-900/75">
                    <span>
                      {d.reservees} / {d.places} places
                    </span>
                    <span className="font-semibold text-gt-teal-900">
                      {d.statut === "COMPLETE"
                        ? "Complet"
                        : `${Math.round((d.reservees / d.places) * 100)} %`}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Colonne droite ── */}
      <div className="min-w-0 space-y-5">
        {showSubscription && data.abonnement ? (
          <Card title="Abonnement">
            <p className="text-xs text-gt-teal-900/75">Plan actuel</p>
            <div className="flex items-end justify-between gap-2">
              <p className="text-2xl font-bold tracking-tight text-gt-teal-900">
                {data.abonnement.plan}
              </p>
              <p className="text-right text-sm font-semibold text-gt-teal-800">
                {SUBSCRIPTION_STATUS[data.abonnement.statut] ?? data.abonnement.statut}
                <span className="block text-xs font-normal text-gt-teal-900/75">
                  {data.abonnement.dateFin
                    ? `jusqu'au ${formatDate(data.abonnement.dateFin)}`
                    : "sans échéance"}
                </span>
              </p>
            </div>
            <ul className="mt-4 space-y-3">
              {data.abonnement.usage.map((u) => (
                <li key={u.label}>
                  <p className="mb-1.5 flex justify-between text-xs text-gt-teal-900/75">
                    <span>{u.label}</span>
                    <span className="font-semibold text-gt-teal-900">
                      {u.used} / {u.max}
                    </span>
                  </p>
                  <ProgressBar value={u.used} max={u.max} label={`${u.label} utilisés`} />
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card title="Circuits">
          <p className="text-xs text-gt-teal-900/75">Circuits publiés</p>
          <p className="text-2xl font-bold tracking-tight text-gt-teal-900">
            {data.circuitsPublies}
          </p>
          {data.topCircuits.length === 0 ? (
            <div className="mt-4">
              <EmptyState>Aucune réservation sur 12 mois.</EmptyState>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.topCircuits.map((c, index) => (
                <li
                  key={c.id}
                  className={`flex gap-3 rounded-2xl p-3 ${
                    index === 0 ? "bg-gt-teal-900 text-white" : "bg-gt-teal-100 text-gt-teal-900"
                  }`}
                >
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                      index === 0 ? "bg-gt-sand-300 text-gt-teal-900" : "bg-gt-teal-900 text-white"
                    }`}
                  >
                    <Icon name="mountain" className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs opacity-80">{c.titre}</p>
                    <p className="text-lg font-bold">{formatMoney(c.montant, devise)}</p>
                    <p className="text-xs opacity-70">
                      {c.reservations} réservation{c.reservations > 1 ? "s" : ""} · 12 mois
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Activité récente">
          <Timeline events={activity} now={now} />
        </Card>
      </div>
    </div>
  );
}
