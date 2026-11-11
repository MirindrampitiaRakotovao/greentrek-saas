/**
 * Page HTML de la carte d'un circuit (fonction pure, testée) : Leaflet 1.9.4 et tuiles
 * OpenStreetMap, comme le site (cahier des charges §9), sans clé d'API. Affichée dans une
 * WebView sur téléphone, une iframe dans l'aperçu web.
 *
 * - étapes numérotées dans l'ordre du circuit ;
 * - tracé RÉEL (plus court chemin A* à travers les tronçons, calculé par le site) en trait
 *   plein ; à défaut, lignes droites en pointillés, signalées comme tracé indicatif ;
 * - données injectées en JSON avec `<` échappé : un nom d'étape ne peut pas fermer la balise
 *   <script> (aucune injection de code) ; les noms sont affichés comme du texte (`textContent`),
 *   jamais comme du HTML ;
 * - refonte : étiquettes des étapes en pastilles, tuiles assombries en mode sombre, et marge
 *   basse quand un panneau est posé sur la carte.
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
  /** Thème sombre : tuiles assombries. */
  dark?: boolean;
  /** Noms des étapes affichés en permanence (pastilles). */
  labels?: boolean;
  /** Marge basse (px) laissée libre au cadrage : panneau posé sur la carte. */
  padBottom?: number;
}): string {
  const data = safeJson({
    steps: input.steps.map((s) => ({ n: s.ordre, nom: s.nom, p: [s.latitude, s.longitude] })),
    trace: input.trace,
    interactive: input.interactive,
    labels: input.labels ?? false,
    padBottom: input.padBottom ?? 0,
  });
  const bg = input.dark ? "#061a1f" : "#eef3f3";
  const darkTiles = input.dark
    ? ".leaflet-tile { filter: invert(1) hue-rotate(185deg) brightness(0.9) contrast(0.85) saturate(0.6); }"
    : "";
  return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css">
<style>
  html, body, #map { margin: 0; height: 100%; background: ${bg}; font-family: -apple-system, Roboto, sans-serif; }
  ${darkTiles}
  .pin { width: 26px; height: 26px; border-radius: 50%; background: #0f414d; color: #fad594;
         border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35);
         display: flex; align-items: center; justify-content: center; font: 600 12px sans-serif; }
  .leaflet-tooltip { font: 500 12px sans-serif; color: #0f414d; }
  .leaflet-tooltip.label { background: rgba(255,255,255,.92); border: 0; border-radius: 999px;
         padding: 3px 9px; box-shadow: 0 2px 8px rgba(0,0,0,.18); font: 600 11px sans-serif; }
  .leaflet-tooltip.label::before { display: none; }
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
    // Nom affiché comme du TEXTE (jamais interprété comme du HTML).
    const label = document.createElement("span");
    label.textContent = s.nom;
    L.marker(s.p, { icon: L.divIcon({ className: "", html: '<div class="pin">' + Number(s.n) + '</div>', iconSize: [26, 26], iconAnchor: [13, 13] }), keyboard: false })
      .bindTooltip(label, d.labels
        ? { permanent: true, direction: "right", offset: [12, 0], className: "label" }
        : { direction: "top", offset: [0, -12] })
      .addTo(map);
  }
  const bounds = L.latLngBounds(line.length ? line : [[-18.9, 47.5]]);
  if (line.length > 1) map.fitBounds(bounds, { paddingTopLeft: [36, 60], paddingBottomRight: [90, 36 + d.padBottom] });
  else map.setView(bounds.getCenter(), 13);
</script>
</body></html>`;
}
