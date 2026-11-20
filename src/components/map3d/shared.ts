/** Réglages communs aux cartes 3D (MapLibre). */

export const PITCH_3D = 58;
export const BEARING_3D = -18;

/** Textes de MapLibre en français. */
export const MAP3D_LOCALE = {
  "CooperativeGesturesHandler.WindowsHelpText": "Ctrl + molette pour zoomer la carte",
  "CooperativeGesturesHandler.MacHelpText": "⌘ + molette pour zoomer la carte",
  "CooperativeGesturesHandler.MobileHelpText": "Deux doigts pour déplacer la carte",
  "AttributionControl.ToggleAttribution": "Sources de la carte",
};

/** Script « worker » de MapLibre, servi par `src/app/vendor/maplibre-worker/route.ts`. */
export const MAPLIBRE_WORKER_URL = "/vendor/maplibre-worker";

export const MAP3D_ATTRIBUTION =
  "Imagerie © Esri, Maxar, Earthstar Geographics · relief Mapzen (AWS) · © OpenFreeMap © OpenMapTiles © contributeurs OpenStreetMap";

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
