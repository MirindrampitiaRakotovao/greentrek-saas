"use client";

import { MapView } from "@/components/map/map-view";
import type { ItineraireStep } from "@/lib/services/itineraires-perso";

/** Carte d'un itinéraire sur mesure : départ, étapes numérotées, arrivée et tracé. */
export function ItineraireMap({ etapes }: { etapes: readonly ItineraireStep[] }) {
  const path = etapes.map((e) => [e.latitude, e.longitude] as [number, number]);
  return (
    <MapView
      markers={etapes.map((e, i) => ({
        id: `${e.id}-${i}`,
        lat: e.latitude,
        lng: e.longitude,
        label: e.nom,
        // Même numérotation que la liste des étapes (départ en rouge, arrivée en orange).
        badge: String(i + 1),
        tone: i === 0 ? "selected" : i === etapes.length - 1 ? "new" : "default",
      }))}
      path={path}
      pathStyle="route"
      fitTo={path}
      fitKey={etapes.map((e) => e.id).join()}
      className="h-full"
    />
  );
}
