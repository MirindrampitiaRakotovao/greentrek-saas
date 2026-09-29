import Link from "next/link";

import { DepartStatusBadge } from "@/components/departs/depart-status-badge";
import { ProgressBar } from "@/components/dashboard/widgets";
import { formatDateRange, formatMoney, formatMonthYear } from "@/lib/format";
import type { DepartRow } from "@/lib/services/departs";

/** Regroupe des départs (déjà triés) par mois de début : « octobre 2026 », … */
function groupByMonth(departs: readonly DepartRow[]) {
  const groups: { label: string; items: DepartRow[] }[] = [];
  for (const depart of departs) {
    const label = formatMonthYear(depart.dateDebut);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(depart);
    else groups.push({ label, items: [depart] });
  }
  return groups;
}

/** Liste des départs groupée par mois : dates, circuit, guide, remplissage, prix, statut. */
export function DepartList({
  departs,
  devise,
  showCircuit = true,
}: {
  departs: readonly DepartRow[];
  devise: string;
  showCircuit?: boolean;
}) {
  return (
    <div className="space-y-6">
      {groupByMonth(departs).map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-gt-teal-900/60 uppercase">
            {group.label}
          </h3>
          <ul className="divide-y divide-gt-mist/60 overflow-hidden rounded-2xl border border-gt-mist/70 bg-white">
            {group.items.map((d) => {
              const restantes = Math.max(0, d.placesTotal - d.reservees);
              return (
                <li key={d.id}>
                  <Link
                    href={`/dashboard/departs/${d.id}`}
                    className="grid gap-x-4 gap-y-2 px-4 py-3 hover:bg-gt-teal-50 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gt-teal-900">
                        {formatDateRange(d.dateDebut, d.dateFin)}
                      </p>
                      {showCircuit ? (
                        <p className="truncate text-sm text-gt-teal-900/80">{d.circuit.titre}</p>
                      ) : null}
                      <p className="truncate text-xs text-gt-teal-900/65">
                        {d.guide ? `Guide : ${d.guide.prenom} ${d.guide.nom}` : "Sans guide"}
                      </p>
                    </div>
                    <div>
                      <ProgressBar
                        value={d.reservees}
                        max={d.placesTotal}
                        label={`Remplissage : ${d.reservees} sur ${d.placesTotal} places`}
                      />
                      <p className="mt-1 text-xs text-gt-teal-900/70">
                        {d.reservees} / {d.placesTotal} places
                        {d.statut === "OUVERTE" ? ` · ${restantes} libre(s)` : ""}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <span className="text-sm font-medium text-gt-teal-900">
                        {formatMoney(d.prix, devise)}
                      </span>
                      <DepartStatusBadge statut={d.statut} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
