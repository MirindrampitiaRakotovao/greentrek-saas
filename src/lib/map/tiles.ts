/**
 * Fonds de carte gratuits, sans carte bancaire (§9), au rendu proche de la maquette de carte
 * demandée par l'étudiant (style Google Maps). Écart documenté avec le §9, qui citait les
 * tuiles OpenStreetMap standard : les DONNÉES restent celles d'OpenStreetMap, seul le style
 * change. Les tuiles Google Maps ne sont pas utilisables (licence réservée à l'API Google,
 * avec clé et facturation) ; CARTO exige désormais une clé (vérifié le 2026-09-29).
 *
 * - Plan : Stadia Maps « OSM Bright ». Sans clé en développement local (localhost ou
 *   adresse du réseau local) ; un compte gratuit, sans carte bancaire, serait requis en ligne.
 * - Satellite : Esri World Imagery (attribution obligatoire ; conditions Esri à respecter
 *   pour un usage en production).
 * - Relief : OpenTopoMap (CC-BY-SA), utile pour la randonnée.
 * - OpenStreetMap : tuiles standard, fond de secours.
 */
const PREVIEW = { z: 10, x: 652, y: 562 }; // tuile contenant Mahambo (voir `tileFor`)

export const BASE_LAYERS = {
  plan: {
    label: "Plan",
    url: "https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png",
    subdomains: "",
    maxZoom: 20,
    attribution:
      '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>',
    preview: `https://tiles.stadiamaps.com/tiles/osm_bright/${PREVIEW.z}/${PREVIEW.x}/${PREVIEW.y}.png`,
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    subdomains: "",
    maxZoom: 19,
    attribution:
      "Imagerie &copy; Esri, Maxar, Earthstar Geographics et la communauté des utilisateurs SIG",
    preview: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${PREVIEW.z}/${PREVIEW.y}/${PREVIEW.x}`,
  },
  relief: {
    label: "Relief",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    subdomains: "abc",
    maxZoom: 17,
    attribution:
      'Données &copy; <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>, SRTM | Style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    preview: `https://a.tile.opentopomap.org/${PREVIEW.z}/${PREVIEW.x}/${PREVIEW.y}.png`,
  },
  osm: {
    label: "OSM",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: "",
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>',
    preview: `https://tile.openstreetmap.org/${PREVIEW.z}/${PREVIEW.x}/${PREVIEW.y}.png`,
  },
} as const;

export type BaseLayerId = keyof typeof BASE_LAYERS;

/**
 * Coordonnées de la tuile (schéma « slippy map » Web Mercator) contenant un point :
 *   x = ⌊(λ + 180) / 360 · 2^z⌋
 *   y = ⌊(1 − ln(tan φ + sec φ) / π) / 2 · 2^z⌋
 */
export function tileFor(latitude: number, longitude: number, zoom: number) {
  const n = 2 ** zoom;
  const latRad = (latitude * Math.PI) / 180;
  const x = Math.floor(((longitude + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
}

/**
 * Vue satellite réelle (Esri World Imagery) autour d'un point, pour la fiche d'un lieu : une
 * vraie image du terrain à la place d'une photo (aucune image inventée).
 */
export function satellitePreviewUrl(latitude: number, longitude: number, zoom = 15): string {
  const { x, y, z } = tileFor(latitude, longitude, zoom);
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}
