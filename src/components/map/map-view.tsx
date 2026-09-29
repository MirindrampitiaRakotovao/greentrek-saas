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
    <div className="grid h-full min-h-[320px] w-full place-items-center bg-[#aad3df] text-sm text-gt-teal-900/70">
      Chargement de la carte…
    </div>
  ),
});

export type { MapFocus, MapMarker } from "@/components/map/leaflet-map";

export function MapView(props: LeafletMapProps) {
  return <LeafletMap {...props} />;
}
