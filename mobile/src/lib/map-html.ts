/**
 * Page HTML de la carte d'un circuit (fonction pure, testée) : Leaflet 1.9.4 et tuiles
 * OpenStreetMap, comme le site (cahier des charges §9), sans clé d'API. Affichée dans une
 * WebView sur téléphone, une iframe dans l'aperçu web.
 *
 * - étapes numérotées dans l'ordre du circuit ;
 * - tracé RÉEL (plus court chemin A* à travers les tronçons, calculé par le site) en trait
 *   plein ; à défaut, lignes droites en pointillés, signalées comme tracé indicatif ;
 * - données injectées en JSON avec `<` échappé : un nom d'étape ne peut pas fermer la balise
 *   <script> (aucune injection de code).
 */

export type MapStep = { ordre: number; nom: string; latitude: number; longitude: number };

const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist";

/** JSON sûr dans un <script> : `<`, `>` et `&` échappés. */
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function buildMapHtml(input: {
  steps: readonly MapStep[];
  trace: readonly (readonly [number, number])[] | null;
  /** Carte figée (aperçu dans la fiche) ou déplaçable (plein écran). */
  interactive: boolean;
}): string {
  const data = safeJson({
    steps: input.steps.map((s) => ({ n: s.ordre, nom: s.nom, p: [s.latitude, s.longitude] })),
    trace: input.trace,
    interactive: input.interactive,
  });
  return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css">
<style>
  html, body, #map { margin: 0; height: 100%; background: #eef3f3; font-family: -apple-system, Roboto, sans-serif; }
  .pin { width: 26px; height: 26px; border-radius: 50%; background: #0f6775; color: #fff;
         border: 2px solid #fff; box-shadow: 0 2px 6px rgba(15,65,77,.4);
         display: flex; align-items: center; justify-content: center; font: 600 12px sans-serif; }
  .leaflet-tooltip { font: 500 12px sans-serif; color: #0f414d; }
</style>
</head><body>
<div id="map" role="img" aria-label="Carte de l'itinéraire du circuit"></div>
<script src="${LEAFLET}/leaflet.js"></script>
<script>
  const d = ${data};
  const map = L.map("map", {
    zoomControl: d.interactive, dragging: d.interactive, scrollWheelZoom: d.interactive,
    doubleClickZoom: d.interactive, touchZoom: d.interactive, boxZoom: false, keyboard: d.interactive,
    attributionControl: true,
  });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>',
  }).addTo(map);
  map.attributionControl.setPrefix("Leaflet");
  const line = d.trace && d.trace.length > 1 ? d.trace : d.steps.map((s) => s.p);
  if (line.length > 1) {
    L.polyline(line, d.trace ? { color: "#0d8495", weight: 5, opacity: 0.9 }
                             : { color: "#0d8495", weight: 3, dashArray: "6 8" }).addTo(map);
  }
  for (const s of d.steps) {
    L.marker(s.p, { icon: L.divIcon({ className: "", html: '<div class="pin">' + s.n + '</div>', iconSize: [26, 26], iconAnchor: [13, 13] }), keyboard: false })
      .bindTooltip(s.nom, { direction: "top", offset: [0, -12] })
      .addTo(map);
  }
  const bounds = L.latLngBounds(line.length ? line : [[-18.9, 47.5]]);
  if (line.length > 1) map.fitBounds(bounds, { padding: [28, 28] });
  else map.setView(bounds.getCenter(), 13);
</script>
</body></html>`;
}
