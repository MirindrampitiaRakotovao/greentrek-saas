import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import type { StatutReservation } from "@/generated/prisma/client";
import { dayKey } from "@/lib/dates";
import { formatDateTime } from "@/lib/format";

/* Briques visuelles des tableaux de bord (d'après la maquette validée, couleurs §8.2). */

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-gt-mist/70 bg-white p-5 ${className}`}>
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gt-teal-900">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Badge d'évolution : flèche + pourcentage (le sens n'est jamais porté par la couleur seule). */
export function TrendBadge({ change }: { change: number | null }) {
  if (change === null) {
    return (
      <span className="rounded-full bg-gt-mist/50 px-2 py-0.5 text-[11px] font-semibold text-gt-teal-900/70">
        nouveau
      </span>
    );
  }
  const up = change >= 0;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
        up ? "bg-gt-teal-100 text-gt-teal-800" : "bg-red-100 text-red-800"
      }`}
    >
      <Icon name={up ? "arrowUp" : "arrowDown"} className="size-3" />
      {Math.abs(change).toLocaleString("fr-FR")} %
      <span className="sr-only">{up ? "de hausse" : "de baisse"}</span>
    </span>
  );
}

export function KpiCard({
  icon,
  label,
  value,
  change,
  detail,
}: {
  icon: IconName;
  label: string;
  value: string;
  change?: number | null;
  detail: string;
}) {
  return (
    <section className="rounded-3xl border border-gt-mist/70 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-gt-teal-900/80">
          <span className="grid size-7 place-items-center rounded-full border border-gt-mist text-gt-teal-700">
            <Icon name={icon} className="size-4" />
          </span>
          {label}
        </p>
        {change !== undefined ? <TrendBadge change={change} /> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <p className="text-2xl font-bold tracking-tight text-gt-teal-900">{value}</p>
        <p className="text-xs text-gt-teal-900/60">{detail}</p>
      </div>
    </section>
  );
}

const STATUT_STYLES: Record<StatutReservation, { label: string; className: string }> = {
  CONFIRMEE: { label: "Confirmée", className: "bg-gt-teal-100 text-gt-teal-800" },
  EN_ATTENTE: { label: "En attente", className: "bg-gt-sand-200 text-gt-teal-900" },
  TERMINEE: { label: "Terminée", className: "bg-gt-teal-900 text-white" },
  ANNULEE: { label: "Annulée", className: "bg-red-100 text-red-800" },
};

export const STATUT_LABELS: Record<StatutReservation, string> = {
  CONFIRMEE: "Confirmée",
  EN_ATTENTE: "En attente",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
};

export function StatusPill({ statut }: { statut: StatutReservation }) {
  const style = STATUT_STYLES[statut];
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  );
}

/** Barre de progression bicolore (partie remplie foncée, reste en teal clair). */
export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full"
    >
      <div className="h-full rounded-full bg-gt-teal-900" style={{ width: `${percent}%` }} />
      <div className="h-full flex-1 rounded-full bg-gt-teal-200" />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-gt-mist bg-gt-teal-50 px-4 py-6 text-center text-sm text-gt-teal-900/60">
      {children}
    </p>
  );
}

export type TimelineEvent = {
  id: string;
  icon: IconName;
  titre: string;
  detail: string;
  at: Date;
};

const timeFormat = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Indian/Antananarivo",
});

/** Chronologie groupée par jour (« Aujourd'hui », « Hier », puis la date). */
export function Timeline({ events, now }: { events: readonly TimelineEvent[]; now: Date }) {
  if (events.length === 0) return <EmptyState>Aucune activité récente.</EmptyState>;
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  const groups = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const key = dayKey(event.at);
    const label =
      key === today
        ? "Aujourd'hui"
        : key === yesterday
          ? "Hier"
          : formatDateTime(event.at).split(" ")[0]!;
    groups.set(label, [...(groups.get(label) ?? []), event]);
  }
  return (
    <div className="space-y-4">
      {[...groups.entries()].map(([label, items]) => (
        <div key={label}>
          <p className="mb-2 text-sm font-semibold text-gt-teal-900">{label}</p>
          <ul className="space-y-3">
            {items.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gt-teal-100 text-gt-teal-800">
                  <Icon name={event.icon} className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] text-gt-teal-900/50">{timeFormat.format(event.at)}</p>
                  <p className="text-sm font-medium break-words text-gt-teal-900">{event.titre}</p>
                  <p className="truncate text-xs text-gt-teal-900/60">{event.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
