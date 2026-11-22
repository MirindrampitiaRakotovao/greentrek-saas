"use client";

import dynamic from "next/dynamic";

import type { VirtualTourProps } from "@/components/visit/virtual-tour";

/** Chargement sans rendu serveur (WebGL) de la visite virtuelle (étape 8a). */
const VirtualTour = dynamic(() => import("@/components/visit/virtual-tour"), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center bg-[#061b20] text-sm text-white/75">
      Préparation de la visite virtuelle…
    </div>
  ),
});

export function VirtualTourEntry(props: VirtualTourProps) {
  return <VirtualTour {...props} />;
}
