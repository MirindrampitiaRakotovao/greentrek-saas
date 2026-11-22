"use client";

import dynamic from "next/dynamic";

import type { GameTourProps } from "@/components/visit/game/game-tour";

/** Chargement sans rendu serveur (WebGL, Three.js) de la visite « mode jeu » (étape 8b). */
const GameTour = dynamic(() => import("@/components/visit/game/game-tour"), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center bg-[#061b20] text-sm text-white/75">
      Préparation du monde 3D…
    </div>
  ),
});

export function GameTourEntry(props: GameTourProps) {
  return <GameTour {...props} />;
}
