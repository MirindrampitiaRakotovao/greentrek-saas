"use client";

import dynamic from "next/dynamic";

import type { LeafletMapProps } from "@/components/map/leaflet-map";

/**
 * Point d'entrée de la carte : import dynamique SANS rendu serveur (Leaflet et MapLibre
 * utilisent `window`). Pendant le chargement, un bloc de même taille évite que la page ne
 * saute. Rappel (§12) : les fonds de carte exigent une connexion Internet.
 *
 * `variant="satellite3d"` (étape 6b-1) : même interface, rendue par la carte satellite 3D
 * (MapLibre) ; si le navigateur ne sait pas dessiner en WebGL, la carte Leaflet la remplace.
 */
const LeafletMap = dynamic(() => import("@/components/map/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[320px] w-full place-items-center bg-[#aad3df] text-sm text-gt-teal-900/75">
      Chargement de la carte…
    </div>
  ),
});

const SatelliteMap = dynamic(() => import("@/components/map3d/satellite-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[320px] w-full place-items-center bg-gt-teal-900 text-sm text-white/80">
      Chargement de la vue satellite…
    </div>
  ),
});

export type { MapDot, MapEdge, MapFocus, MapMarker } from "@/components/map/leaflet-map";

export function MapView({
  variant = "plan",
  ...props
}: LeafletMapProps & { variant?: "plan" | "satellite3d" }) {
  if (variant === "satellite3d") {
    return <SatelliteMap {...props} fallback={<LeafletMap {...props} />} />;
  }
  return <LeafletMap {...props} />;
}
