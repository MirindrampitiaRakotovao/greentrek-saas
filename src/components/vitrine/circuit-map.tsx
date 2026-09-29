"use client";

import { MapView } from "@/components/map/map-view";

/**
 * Carte publique d'un circuit : étapes numérotées et tracé. Tracé réel à travers les
 * tronçons s'il a été calculé (étape E6), sinon lignes droites indicatives en pointillés.
 */
export function CircuitMap({
  steps,
  trace,
}: {
  steps: readonly { id: string; ordre: number; nom: string; latitude: number; longitude: number }[];
  trace: readonly [number, number][] | null;
}) {
  return (
    <MapView
      markers={steps.map((s) => ({
        id: s.id,
        lat: s.latitude,
        lng: s.longitude,
        label: `${s.ordre}. ${s.nom}`,
        badge: String(s.ordre),
      }))}
      path={trace ?? steps.map((s) => [s.latitude, s.longitude] as [number, number])}
      pathStyle={trace ? "route" : "indicatif"}
      fitKey={steps.map((s) => s.id).join()}
      className="h-[320px] sm:h-[420px]"
    />
  );
}
