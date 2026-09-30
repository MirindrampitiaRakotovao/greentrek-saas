import Link from "next/link";

import { Card, EmptyState, KpiCard, ProgressBar } from "@/components/dashboard/widgets";
import { Icon } from "@/components/ui/icon";
import type { GuideDashboard } from "@/lib/dashboard/guide";

/** Tableau de bord d'un guide : ses départs à venir et ses participants (matrice §3). */

const longDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
  month: "long",
  timeZone: "UTC", // colonnes SQL DATE
});

export function GuideDashboardView({ data }: { data: GuideDashboard | null }) {
  if (!data) {
    return (
      <EmptyState>
        Votre compte n&apos;est relié à aucune fiche guide. Demandez à l&apos;administrateur de
        l&apos;agence de la relier dans « Guides ».
      </EmptyState>
    );
  }
  const next = data.departs[0];

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="min-w-0 space-y-5 xl:col-span-2">
        <div className="grid gap-5 sm:grid-cols-3">
          <KpiCard
            icon="calendar"
            label="Départs à venir"
            value={String(data.aVenir)}
            detail="affectés à vous"
          />
          <KpiCard
            icon="users"
            label="Participants attendus"
            value={String(data.participantsAttendus)}
            detail="hors annulations"
          />
          <KpiCard
            icon="check"
            label="Départs encadrés"
            value={String(data.encadres)}
            detail="terminés"
          />
        </div>
        <Card title="Mes prochains départs">
          {data.departs.length === 0 ? (
            <EmptyState>Aucun départ ne vous est affecté pour le moment.</EmptyState>
          ) : (
            <ul className="divide-y divide-gt-mist/60">
              {data.departs.map((d) => (
                <li key={d.id} className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[1fr_200px]">
                  <div>
                    <Link
                      href={`/dashboard/departs/${d.id}`}
                      className="font-semibold text-gt-teal-900 underline-offset-2 hover:underline"
                    >
                      {d.circuit}
                    </Link>
                    <p className="text-sm text-gt-teal-900/75">
                      {longDate.format(d.dateDebut)}
                      {d.dateFin.getTime() !== d.dateDebut.getTime()
                        ? ` → ${longDate.format(d.dateFin)}`
                        : ""}
                    </p>
                  </div>
                  <div>
                    <ProgressBar
                      value={d.participants}
                      max={d.places}
                      label={`Participants de ${d.circuit}`}
                    />
                    <p className="mt-1.5 text-xs text-gt-teal-900/75">
                      {d.participants} participant(s) · {d.reservations} réservation(s) · {d.places}{" "}
                      places
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="min-w-0 space-y-5">
        <section className="relative overflow-hidden rounded-3xl bg-gt-teal-900 p-6 text-white">
          <span
            aria-hidden="true"
            className="absolute -top-8 -right-8 size-28 rounded-full bg-gt-teal-card"
          />
          <Icon name="compass" className="relative size-7 text-gt-sand-300" />
          <p className="relative mt-4 text-sm text-white/80">Prochain départ</p>
          {next ? (
            <>
              <p className="relative mt-1 text-xl font-bold">{next.circuit}</p>
              <p className="relative mt-1 text-sm text-white/80">
                {longDate.format(next.dateDebut)}
              </p>
              <p className="relative mt-4 inline-flex rounded-full bg-gt-sand-300 px-3 py-1 text-sm font-semibold text-gt-teal-900">
                {next.participants} participant(s)
              </p>
            </>
          ) : (
            <p className="relative mt-1 text-lg font-semibold">Aucun départ prévu</p>
          )}
        </section>
      </div>
    </div>
  );
}
