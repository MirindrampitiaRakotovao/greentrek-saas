import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, EmptyState, KpiCard, ProgressBar, StatusPill } from "@/components/dashboard/widgets";
import { Icon } from "@/components/ui/icon";
import { requireUser } from "@/lib/auth/session";
import { getClientDashboard } from "@/lib/dashboard/client";
import { formatMoney } from "@/lib/format";
import { getTenantDb } from "@/lib/tenant";

export const metadata: Metadata = { title: "Mon espace" };

const longDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC", // colonnes SQL DATE
});
const shortDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "UTC" });

/** Tableau de bord du voyageur : uniquement SES réservations (§7.2). La gestion arrive en E9. */
export default async function MonComptePage({ params }: PageProps<"/a/[slug]/mon-compte">) {
  const { slug } = await params;
  const user = await requireUser({ roles: ["CLIENT"], agenceSlug: slug });
  if (!user.agenceId) notFound();
  const data = await getClientDashboard(getTenantDb(user.agenceId), user.agenceId, user.id);
  const next = data.prochain;

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="min-w-0 space-y-5 xl:col-span-2">
        <div className="grid gap-5 sm:grid-cols-2">
          <KpiCard
            icon="calendar"
            label="Voyages à venir"
            value={String(data.aVenir)}
            detail="réservations actives"
          />
          <KpiCard
            icon="check"
            label="Voyages terminés"
            value={String(data.termines)}
            detail="depuis votre inscription"
          />
          <KpiCard
            icon="coins"
            label="Total payé"
            value={formatMoney(data.totalPaye, data.devise)}
            detail="paiements validés"
          />
          <KpiCard
            icon="wallet"
            label="Reste à payer"
            value={formatMoney(data.resteAPayer, data.devise)}
            detail="hors annulations"
          />
        </div>

        <Card title="Mes réservations">
          {data.reservations.length === 0 ? (
            <EmptyState>Vous n&apos;avez encore aucune réservation.</EmptyState>
          ) : (
            <div className="relative -mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[620px] text-left text-sm">
                <caption className="sr-only">Mes réservations</caption>
                <thead className="text-xs text-gt-teal-900/55">
                  <tr className="border-b border-gt-mist/70">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Réservation
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Départ
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Paiement
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gt-mist/60">
                  {data.reservations.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-gt-teal-900">{r.circuit}</p>
                        <p className="text-xs text-gt-teal-900/60">
                          {r.reference} · {r.nombrePersonnes} pers.
                        </p>
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap text-gt-teal-900/80">
                        {shortDate.format(r.dateDebut)}
                      </td>
                      <td className="w-48 py-3 pr-3">
                        <ProgressBar
                          value={r.paye}
                          max={r.montant}
                          label={`Paiement de ${r.reference}`}
                        />
                        <p className="mt-1 text-xs text-gt-teal-900/70">
                          {formatMoney(r.paye, data.devise)} / {formatMoney(r.montant, data.devise)}
                        </p>
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

      <div className="min-w-0 space-y-5">
        <section className="relative overflow-hidden rounded-3xl bg-gt-teal-900 p-6 text-white">
          <span
            aria-hidden="true"
            className="absolute -top-8 -right-8 size-28 rounded-full bg-gt-teal-card"
          />
          <span
            aria-hidden="true"
            className="absolute top-10 -right-12 size-20 rounded-full bg-gt-teal-700/70"
          />
          <Icon name="mountain" className="relative size-7 text-gt-sand-300" />
          <p className="relative mt-4 text-sm text-white/70">Mon prochain voyage</p>
          {next ? (
            <>
              <p className="relative mt-1 text-xl font-bold">{next.circuit}</p>
              <p className="relative mt-1 text-sm text-white/80 first-letter:uppercase">
                {longDate.format(next.dateDebut)}
              </p>
              <div className="relative mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-gt-sand-300 px-3 py-1 text-sm font-semibold text-gt-teal-900">
                  {next.nombrePersonnes} voyageur(s)
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm">{next.reference}</span>
              </div>
            </>
          ) : (
            <p className="relative mt-1 text-lg font-semibold">Aucun voyage prévu</p>
          )}
        </section>

        <Card title="Bon à savoir">
          <ul className="space-y-3 text-sm text-gt-teal-900/80">
            <li className="flex gap-3">
              <Icon name="xCircle" className="mt-0.5 size-4 text-gt-teal-700" />
              Une réservation est annulable tant que le départ n&apos;a pas commencé.
            </li>
            <li className="flex gap-3">
              <Icon name="coins" className="mt-0.5 size-4 text-gt-teal-700" />
              Le montant est fixé au moment de la réservation et ne change plus.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
