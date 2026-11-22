import type { StyleSpecification } from "maplibre-gl";

/**
 * Fond de la carte 3D (étape 6a, demande de l'étudiant) : vue satellite inclinée avec relief,
 * eaux et sentiers mis en valeur. Uniquement des sources gratuites, sans clé ni carte
 * bancaire (comme OpenStreetMap jusqu'ici), citées dans l'attribution :
 * - imagerie satellite Esri World Imagery (utilisation non commerciale avec attribution) ;
 * - relief : modèle numérique de terrain « Terrain Tiles » (Mapzen, AWS Open Data), format
 *   Terrarium ;
 * - eaux, sentiers et noms de lieux : tuiles vectorielles OpenFreeMap (schéma OpenMapTiles,
 *   données © contributeurs OpenStreetMap).
 * Rappel (§12) : comme les tuiles OSM, ces fonds exigent une connexion Internet.
 */

export const SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const TERRAIN_TILES =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
export const VECTOR_TILEJSON = "https://tiles.openfreemap.org/planet";
export const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

/** Exagération du relief : 1,4 rend les collines lisibles sans déformer le paysage. */
export const TERRAIN_EXAGGERATION = 1.4;

/** Couleurs : palette Green Trek (§8.2), eaux en bleu clair bien visible sur le satellite. */
export const MAP3D_COLORS = {
  water: "#3FB6D8",
  waterLine: "#9BE3F5",
  waterLabel: "#D8F6FF",
  path: "#F3E3BF",
  route: "#FAD594",
  halo: "#0F414D",
} as const;

const FONT = ["Noto Sans Regular"];
const FONT_ITALIC = ["Noto Sans Italic"];

/** Nom affiché : français s'il existe dans OpenStreetMap, sinon le nom local. */
const NAME = ["coalesce", ["get", "name:fr"], ["get", "name"]] as const;

export function satelliteStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      satellite: {
        type: "raster",
        tiles: [SATELLITE_TILES],
        tileSize: 256,
        // Au-delà du zoom 17, Esri n'a pas d'image dans les zones rurales de Madagascar (tuile
        // grise « Map data not yet available ») : MapLibre agrandit les tuiles du zoom 17.
        maxzoom: 17,
        attribution: "Imagerie © Esri, Maxar, Earthstar Geographics",
      },
      relief: {
        type: "raster-dem",
        tiles: [TERRAIN_TILES],
        tileSize: 256,
        maxzoom: 15,
        encoding: "terrarium",
        attribution: "Relief : Mapzen Terrain Tiles (AWS)",
      },
      osm: {
        type: "vector",
        url: VECTOR_TILEJSON,
        attribution: "© OpenFreeMap © OpenMapTiles © contributeurs OpenStreetMap",
      },
    },
    layers: [
      {
        id: "satellite",
        type: "raster",
        source: "satellite",
        paint: { "raster-saturation": 0.1, "raster-contrast": 0.08 },
      },
      // Mer, lacs, rivières larges : voile bleu translucide + contour lumineux.
      {
        id: "eau",
        type: "fill",
        source: "osm",
        "source-layer": "water",
        paint: { "fill-color": MAP3D_COLORS.water, "fill-opacity": 0.42 },
      },
      {
        id: "eau-contour",
        type: "line",
        source: "osm",
        "source-layer": "water",
        paint: { "line-color": MAP3D_COLORS.waterLine, "line-width": 1.2, "line-opacity": 0.8 },
      },
      {
        id: "cours-d-eau",
        type: "line",
        source: "osm",
        "source-layer": "waterway",
        paint: {
          "line-color": MAP3D_COLORS.waterLine,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 14, 2.4],
          "line-opacity": 0.85,
        },
      },
      // Sentiers et pistes RÉELS d'OpenStreetMap (aucun tracé inventé).
      {
        id: "sentiers-osm",
        type: "line",
        source: "osm",
        "source-layer": "transportation",
        minzoom: 11,
        filter: ["in", ["get", "class"], ["literal", ["path", "track"]]],
        paint: {
          "line-color": MAP3D_COLORS.path,
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 16, 1.6],
          "line-opacity": 0.55,
          "line-dasharray": [2, 1.5],
        },
      },
      {
        id: "noms-eaux",
        type: "symbol",
        source: "osm",
        "source-layer": "water_name",
        layout: {
          "text-field": NAME as never,
          "text-font": FONT_ITALIC,
          "text-size": ["interpolate", ["linear"], ["zoom"], 6, 11, 12, 14],
          "text-letter-spacing": 0.08,
          "symbol-placement": "point",
        },
        paint: {
          "text-color": MAP3D_COLORS.waterLabel,
          "text-halo-color": MAP3D_COLORS.halo,
          "text-halo-width": 1.4,
        },
      },
      {
        id: "noms-lieux",
        type: "symbol",
        source: "osm",
        "source-layer": "place",
        filter: ["in", ["get", "class"], ["literal", ["city", "town", "village", "hamlet"]]],
        layout: {
          "text-field": NAME as never,
          "text-font": FONT,
          "text-size": ["match", ["get", "class"], ["city", "town"], 13, 11],
        },
        paint: {
          "text-color": "#FFFFFF",
          "text-halo-color": MAP3D_COLORS.halo,
          "text-halo-width": 1.3,
          "text-opacity": 0.85,
        },
      },
    ],
    sky: {
      "sky-color": "#9CC7D6",
      "horizon-color": "#E8F1F2",
      "fog-color": "#E8F1F2",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.25,
    },
  };
}

/** Tracé de l'itinéraire en GeoJSON (ordre longitude, latitude). */
export function routeFeature(points: readonly { latitude: number; longitude: number }[]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: points.map((p) => [p.longitude, p.latitude]),
    },
  };
}

/** Emprise [[ouest, sud], [est, nord]] des points, ou null s'il n'y en a pas. */
export function boundsOf(
  points: readonly { latitude: number; longitude: number }[],
): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of points) {
    w = Math.min(w, p.longitude);
    e = Math.max(e, p.longitude);
    s = Math.min(s, p.latitude);
    n = Math.max(n, p.latitude);
  }
  return [
    [w, s],
    [e, n],
  ];
}

/**
 * Lieux de passage : points du tracé qui ne sont pas des étapes du circuit (villages
 * traversés par le plus court chemin), sans doublon. Leur nom est affiché sur la carte.
 */
export function passagePoints<T extends { id: string }>(
  trace: readonly T[],
  stepIds: ReadonlySet<string>,
): T[] {
  const seen = new Set<string>();
  return trace.filter((p) => {
    if (stepIds.has(p.id) || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}
