import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";
import { Stars } from "@/components/ui/stars";
import { CircuitVisual } from "@/components/vitrine/circuit-visual";
import { formatDateRange, formatMoney } from "@/lib/format";
import type { PublicCircuitCard } from "@/lib/services/vitrine";
import { DIFFICULTE_LABELS } from "@/lib/validators/circuits";

export function formatDuree(jours: number): string {
  return `${jours} jour${jours > 1 ? "s" : ""}`;
}

export function formatKm(km: number | null): string | null {
  return km === null ? null : `${km.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
}

/**
 * Carte de circuit (§8.4, section 4) : visuel, ruban « Réserver », titre, « à partir de
 * X Ar / pers. », durée, distance, difficulté, prochain départ et places libres, et note
 * moyenne des avis publiés (étape E12 ; rien n'est affiché tant qu'aucun avis n'est publié).
 */
export function CircuitCard({
  circuit,
  agenceSlug,
  devise,
}: {
  circuit: PublicCircuitCard;
  agenceSlug: string;
  devise: string;
}) {
  const next = circuit.departs[0];
  const facts: { icon: IconName; label: string }[] = [
    { icon: "calendar", label: formatDuree(circuit.dureeJours) },
    ...(circuit.distanceKm !== null
      ? [{ icon: "route" as const, label: formatKm(circuit.distanceKm) ?? "" }]
      : []),
    { icon: "mountain", label: DIFFICULTE_LABELS[circuit.difficulte] },
  ];

  return (
    <Link
      href={`/a/${agenceSlug}/circuits/${circuit.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-md shadow-gt-teal-900/10 transition hover:-translate-y-1 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <CircuitVisual
          imageUrl={circuit.imagePrincipaleUrl}
          landscapeKey={circuit.slug}
          className="size-full"
        />
        {next ? (
          <span className="absolute top-4 right-0 rounded-l-full bg-gt-teal-700 py-1 pr-3 pl-4 text-xs font-semibold text-white shadow">
            Réserver
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-semibold text-gt-teal-900 group-hover:underline">{circuit.titre}</h3>
        {circuit.note ? (
          <div className="mt-1">
            <Stars note={circuit.note.moyenne} nombre={circuit.note.nombre} />
          </div>
        ) : null}
        {circuit.resume ? (
          <p className="mt-1 line-clamp-2 text-sm text-gt-teal-900/75">{circuit.resume}</p>
        ) : null}
        <ul className="mt-3 mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gt-teal-900/80">
          {facts.map((f) => (
            <li key={f.label} className="flex items-center gap-1.5">
              <Icon name={f.icon} className="size-4 text-gt-teal-600" />
              {f.label}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-gt-mist/60 pt-4">
          <p className="text-xs text-gt-teal-900/75">
            à partir de
            <span className="block text-lg font-bold text-gt-teal-900">
              {formatMoney(circuit.prixMin, devise)}
            </span>
            / pers.
          </p>
          <p className="text-right text-xs text-gt-teal-900/75">
            {next ? (
              <>
                Prochain départ
                <span className="block font-semibold text-gt-teal-900">
                  {formatDateRange(next.dateDebut, next.dateFin)}
                </span>
                {next.placesLibres} place{next.placesLibres > 1 ? "s" : ""} libre
                {next.placesLibres > 1 ? "s" : ""}
              </>
            ) : (
              "Prochains départs à venir"
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}
