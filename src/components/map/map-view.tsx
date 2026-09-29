"use client";

import dynamic from "next/dynamic";

import type { LeafletMapProps } from "@/components/map/leaflet-map";

/**
 * Point d'entrée de la carte : import dynamique SANS rendu serveur (Leaflet utilise
 * `window`). Pendant le chargement, un bloc de même taille évite que la page ne saute.
 * Rappel (§12) : les tuiles OpenStreetMap exigent une connexion Internet.
 */
const LeafletMap = dynamic(() => import("@/components/map/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[420px] w-full place-items-center rounded-2xl bg-gt-teal-100 text-sm text-gt-teal-900/60">
      Chargement de la carte…
    </div>
  ),
});

export type { MapMarker } from "@/components/map/leaflet-map";

export function MapView(props: LeafletMapProps) {
  return <LeafletMap {...props} />;
}
