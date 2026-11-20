"use client";

import dynamic from "next/dynamic";

import type { TerrainMapProps } from "@/components/map3d/terrain-map";

/**
 * Point d'entrée de la carte 3D : import dynamique SANS rendu serveur (WebGL, `window`).
 * Pendant le chargement, un bloc de même taille évite que la page ne saute.
 */
const TerrainMap = dynamic(() => import("@/components/map3d/terrain-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[520px] place-items-center rounded-3xl bg-gt-teal-900 text-sm text-white/80 sm:h-[600px]">
      Chargement de la vue satellite…
    </div>
  ),
});

export type { Map3DPoint, Map3DStep } from "@/components/map3d/terrain-map";

export function CircuitMap3D(props: TerrainMapProps) {
  return <TerrainMap {...props} />;
}
