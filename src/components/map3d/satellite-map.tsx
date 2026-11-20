"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, Marker, Popup } from "maplibre-gl";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { LeafletMapProps, MapDraftLine, MapMarker } from "@/components/map/leaflet-map";
import {
  MAP3D_ATTRIBUTION,
  MAP3D_LOCALE,
  MAPLIBRE_WORKER_URL,
  prefersReducedMotion,
} from "@/components/map3d/shared";
import { Icon } from "@/components/ui/icon";
import { insertPoint, type TracePoint } from "@/lib/graph/trace";
import { boundsOf, MAP3D_COLORS, satelliteStyle, TERRAIN_EXAGGERATION } from "@/lib/map3d/style";

/**
 * Carte satellite 3D du back-office (étape 6b-1, demande de l'étudiant : « le même design »
 * que la fiche circuit) pour la carte du réseau et le calcul d'itinéraire. Elle accepte
 * EXACTEMENT les mêmes propriétés que la carte Leaflet (`LeafletMapProps`) : ajout d'une étape
 * par clic (y compris sur le relief), étapes déplaçables, tronçons cliquables avec infobulle,
 * tracé calculé, nœuds explorés, recadrage et survol d'un point. Pour éditer, la carte est
 * inclinée doucement ; le bouton « 2D » la met à plat, vue du dessus.
 */

/** Inclinaison d'édition : relief lisible sans gêner le placement d'un point. */
const PITCH_EDIT = 40;
/** Couleur des variantes (étape 6b-3) : corail, distinct du sable, du réseau et de l'eau. */
export const VARIANT_COLOR = "#FF7A6B";
const MAHAMBO: [number, number] = [49.4503963, -17.4896484];

const EDGE_STYLE = {
  default: { color: "#F4EFE3", width: 2.6 },
  selected: { color: MAP3D_COLORS.route, width: 5 },
  muted: { color: "#96BECA", width: 2 },
} as const;

/** Épingle : pastille (rang ou point) et nom, affiché en permanence si zoom suffisant. */
function pinElement(marker: MapMarker): HTMLElement {
  const el = document.createElement("div");
  el.className = `gt3d-pin gt3d-pin--${marker.tone ?? "default"}`;
  el.setAttribute("role", "button");
  el.tabIndex = 0;
  el.setAttribute("aria-label", marker.label);
  const dot = document.createElement("span");
  dot.className = "gt3d-pin__dot";
  dot.textContent = marker.badge ?? "";
  const name = document.createElement("span");
  name.className = "gt3d-pin__name";
  name.textContent = marker.label;
  el.append(dot, name);
  return el;
}

type Handlers = Pick<
  LeafletMapProps,
  "onMapClick" | "onMarkerClick" | "onMarkerDragEnd" | "onEdgeClick"
> & { draftLine?: MapDraftLine; onAltPathClick?: (id: string) => void };

/** [latitude, longitude] → [longitude, latitude] et inversement. */
const toLngLat = ([lat, lng]: readonly [number, number]): TracePoint => [lng, lat];
const toLatLng = ([lng, lat]: TracePoint): [number, number] => [lat, lng];

/** Point du tracé en cours : rond déplaçable (extrémités fixes, sur les étapes). */
function vertexElement(fixed: boolean): HTMLElement {
  const el = document.createElement("div");
  el.className = fixed ? "gt3d-vertex gt3d-vertex--fixed" : "gt3d-vertex";
  el.title = fixed
    ? "Extrémité du tronçon (sur l'étape)"
    : "Glisser pour déplacer · double-clic pour supprimer";
  return el;
}

export default function SatelliteMap({
  markers,
  path,
  edges,
  onEdgeClick,
  pathStyle = "indicatif",
  dots,
  draftLine,
  altPaths,
  onAltPathClick,
  onMapClick,
  onMarkerClick,
  onMarkerDragEnd,
  fitKey,
  fitTo,
  focus,
  fitPadding,
  leftControlsClassName = "left-3",
  className = "h-[420px]",
  fallback,
}: LeafletMapProps & { fallback?: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const verticesRef = useRef<Marker[]>([]);
  const popupRef = useRef<Popup | null>(null);
  // Fonctions de la page relues à chaque événement (elles changent à chaque rendu).
  const handlers = useRef<Handlers>({});
  useEffect(() => {
    handlers.current = {
      onMapClick,
      onMarkerClick,
      onMarkerDragEnd,
      onEdgeClick,
      draftLine,
      onAltPathClick,
    };
  });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [is3d, setIs3d] = useState(true);
  const padding = { left: 0, top: 0, right: 0, bottom: 0, ...fitPadding };

  function frame(points: readonly [number, number][], animate: boolean) {
    const map = mapRef.current;
    const bounds = boundsOf(points.map(([latitude, longitude]) => ({ latitude, longitude })));
    if (!map || !bounds) return;
    const camera =
      points.length === 1
        ? { center: [points[0]![1], points[0]![0]] as [number, number], zoom: 13 }
        : map.cameraForBounds(bounds, {
            padding: {
              left: padding.left + 50,
              top: padding.top + 70,
              right: padding.right + 90,
              bottom: padding.bottom + 70,
            },
            maxZoom: 14,
            bearing: map.getBearing(),
          });
    if (!camera) return;
    const target = { ...camera, pitch: is3d ? PITCH_EDIT : 0 };
    if (animate && !prefersReducedMotion()) map.easeTo({ ...target, duration: 800 });
    else map.jumpTo(target);
  }

  // Création de la carte (une fois).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container,
        style: satelliteStyle(),
        center: markers[0] ? [markers[0].lng, markers[0].lat] : MAHAMBO,
        zoom: 11,
        pitch: PITCH_EDIT,
        bearing: 0,
        maxPitch: 75,
        attributionControl: false,
        locale: MAP3D_LOCALE,
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    mapRef.current = map;
    const syncZoomClass = () => container.classList.toggle("gt3d-far", map.getZoom() < 11.5);
    map.on("zoom", syncZoomClass);
    syncZoomClass();

    map.on("load", () => {
      map.setTerrain({ source: "relief", exaggeration: TERRAIN_EXAGGERATION });
      const empty = { type: "FeatureCollection" as const, features: [] };
      map.addSource("troncons", { type: "geojson", data: empty });
      map.addSource("trace", { type: "geojson", data: empty });
      map.addSource("explores", { type: "geojson", data: empty });
      map.addSource("brouillon", { type: "geojson", data: empty });
      map.addSource("variantes", { type: "geojson", data: empty });
      // Tronçons : liseré sombre, trait (plein si mesuré, pointillé si estimé), zone de clic.
      map.addLayer({
        id: "troncons-liseret",
        type: "line",
        source: "troncons",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": MAP3D_COLORS.halo,
          "line-width": ["+", ["get", "width"], 3],
          "line-opacity": 0.7,
        },
      });
      for (const dashed of [false, true]) {
        map.addLayer({
          id: dashed ? "troncons-estimes" : "troncons-mesures",
          type: "line",
          source: "troncons",
          filter: ["==", ["get", "dashed"], dashed],
          layout: { "line-join": "round", "line-cap": dashed ? "butt" : "round" },
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["get", "width"],
            ...(dashed ? { "line-dasharray": [2.2, 1.6] } : {}),
          },
        });
      }
      map.addLayer({
        id: "troncons-clic",
        type: "line",
        source: "troncons",
        paint: { "line-color": "#000", "line-width": 18, "line-opacity": 0 },
      });
      // Variantes (étape 6b-3), en corail : les autres en pointillés sous l'itinéraire.
      map.addLayer({
        id: "variantes",
        type: "line",
        source: "variantes",
        filter: ["==", ["get", "selected"], false],
        paint: {
          "line-color": VARIANT_COLOR,
          "line-width": 3.5,
          "line-opacity": 0.9,
          "line-dasharray": [1.6, 1.4],
        },
      });
      // Itinéraire calculé : halo lumineux et trait sable (pointillés si indicatif).
      map.addLayer({
        id: "trace-halo",
        type: "line",
        source: "trace",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": MAP3D_COLORS.route,
          "line-width": 14,
          "line-blur": 9,
          "line-opacity": 0.45,
        },
      });
      for (const dashed of [false, true]) {
        map.addLayer({
          id: dashed ? "trace-indicatif" : "trace",
          type: "line",
          source: "trace",
          filter: ["==", ["get", "dashed"], dashed],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": MAP3D_COLORS.route,
            "line-width": dashed ? 3.5 : 5,
            ...(dashed ? { "line-dasharray": [2, 2] } : {}),
          },
        });
      }
      // Tracé en cours (proposition OSM ou dessin) : orange vif, bien distinct du réseau.
      map.addLayer({
        id: "brouillon-halo",
        type: "line",
        source: "brouillon",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#FFB547", "line-width": 12, "line-blur": 6, "line-opacity": 0.5 },
      });
      map.addLayer({
        id: "brouillon",
        type: "line",
        source: "brouillon",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#FFB547", "line-width": 4 },
      });
      // Variante choisie : au-dessus de l'itinéraire principal, liseré sombre.
      map.addLayer({
        id: "variantes-choisie-liseret",
        type: "line",
        source: "variantes",
        filter: ["==", ["get", "selected"], true],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": MAP3D_COLORS.halo, "line-width": 8, "line-opacity": 0.6 },
      });
      map.addLayer({
        id: "variantes-choisie",
        type: "line",
        source: "variantes",
        filter: ["==", ["get", "selected"], true],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": VARIANT_COLOR, "line-width": 5 },
      });
      map.addLayer({
        id: "variantes-clic",
        type: "line",
        source: "variantes",
        paint: { "line-color": "#000", "line-width": 16, "line-opacity": 0 },
      });
      map.addLayer({
        id: "explores",
        type: "circle",
        source: "explores",
        paint: {
          "circle-radius": 8,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.9,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      });

      // Infobulle des tronçons et des nœuds explorés, au survol.
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "gt3d-popup",
        offset: 10,
      });
      popupRef.current = popup;
      for (const layer of ["troncons-clic", "explores", "variantes-clic"]) {
        map.on("mousemove", layer, (event) => {
          const label = event.features?.[0]?.properties?.label as string | undefined;
          if (!label) return;
          map.getCanvas().style.cursor = layer === "explores" ? "" : "pointer";
          popup.setLngLat(event.lngLat).setText(label).addTo(map);
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = handlers.current.onMapClick ? "crosshair" : "";
          popup.remove();
        });
      }
      map.on("click", (event) => {
        // Un clic sur une épingle ou un point du tracé n'ajoute rien (ils ont leur propre clic).
        const target = event.originalEvent.target as HTMLElement | null;
        if (target?.closest(".gt3d-pin, .gt3d-vertex")) return;
        // Édition d'un tracé : le clic ajoute un point dans le segment le plus proche.
        const draft = handlers.current.draftLine;
        if (draft?.editable && draft.onChange) {
          const point: TracePoint = [event.lngLat.lng, event.lngLat.lat];
          draft.onChange(insertPoint(draft.points.map(toLngLat), point).map(toLatLng));
          return;
        }
        const variante = map.queryRenderedFeatures(event.point, { layers: ["variantes-clic"] })[0];
        const varianteId = variante?.properties?.id as string | undefined;
        if (varianteId && handlers.current.onAltPathClick) {
          handlers.current.onAltPathClick(varianteId);
          return;
        }
        const hit = map.queryRenderedFeatures(event.point, { layers: ["troncons-clic"] })[0];
        const id = hit?.properties?.id as string | undefined;
        if (id && handlers.current.onEdgeClick) handlers.current.onEdgeClick(id);
        else handlers.current.onMapClick?.(event.lngLat.lat, event.lngLat.lng);
      });
      setLoaded(true);
    });
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      verticesRef.current.forEach((m) => m.remove());
      verticesRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carte créée une seule fois
  }, []);

  // Curseur « viseur » quand un clic ajoute une étape ou un point du tracé ; pas de zoom au
  // double-clic pendant l'édition d'un tracé (il supprime un point).
  const editing = draftLine?.editable ?? false;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = onMapClick || editing ? "crosshair" : "";
    if (editing) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [onMapClick, editing, loaded]);

  // Tronçons.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    (map.getSource("troncons") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: (edges ?? []).map((edge) => {
        const tone = edge.tone ?? "default";
        return {
          type: "Feature",
          properties: {
            id: edge.id,
            label: edge.label,
            dashed: edge.dashed ?? false,
            color: EDGE_STYLE[tone].color,
            width: EDGE_STYLE[tone].width,
          },
          geometry: {
            type: "LineString",
            coordinates:
              edge.line && edge.line.length > 1
                ? edge.line.map(toLngLat)
                : [
                    [edge.from[1], edge.from[0]],
                    [edge.to[1], edge.to[0]],
                  ],
          },
        };
      }),
    });
  }, [edges, loaded]);

  // Itinéraire calculé et nœuds explorés.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    (map.getSource("trace") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features:
        path && path.length > 1
          ? [
              {
                type: "Feature",
                properties: { dashed: pathStyle !== "route" },
                geometry: { type: "LineString", coordinates: path.map(([lat, lng]) => [lng, lat]) },
              },
            ]
          : [],
    });
    (map.getSource("explores") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: (dots ?? []).map((dot) => ({
        type: "Feature",
        properties: { label: dot.label, color: dot.color },
        geometry: { type: "Point", coordinates: [dot.lng, dot.lat] },
      })),
    });
  }, [path, pathStyle, dots, loaded]);

  // Variantes de l'itinéraire.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    (map.getSource("variantes") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: (altPaths ?? [])
        .filter((alt) => alt.points.length > 1)
        .map((alt) => ({
          type: "Feature",
          properties: { id: alt.id, label: alt.label, selected: alt.selected },
          geometry: { type: "LineString", coordinates: alt.points.map(toLngLat) },
        })),
    });
  }, [altPaths, loaded]);

  // Tracé en cours : ligne et, en édition, points déplaçables.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const points = draftLine?.points ?? [];
    (map.getSource("brouillon") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features:
        points.length > 1
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: points.map(toLngLat) },
              },
            ]
          : [],
    });
    verticesRef.current.forEach((m) => m.remove());
    verticesRef.current = [];
    if (!draftLine?.editable) return;
    verticesRef.current = points.map((point, index) => {
      const fixed = index === 0 || index === points.length - 1;
      const element = vertexElement(fixed);
      const vertex = new maplibregl.Marker({ element, draggable: !fixed })
        .setLngLat(toLngLat(point))
        .addTo(map);
      vertex.on("dragend", () => {
        const draft = handlers.current.draftLine;
        if (!draft?.onChange) return;
        const { lat, lng } = vertex.getLngLat();
        draft.onChange(draft.points.map((p, i) => (i === index ? [lat, lng] : [p[0], p[1]])));
      });
      if (!fixed) {
        element.addEventListener("dblclick", (event) => {
          event.stopPropagation();
          const draft = handlers.current.draftLine;
          draft?.onChange?.(draft.points.filter((_, i) => i !== index).map((p) => [p[0], p[1]]));
        });
      }
      return vertex;
    });
  }, [draftLine, loaded]);

  // Épingles (recréées quand la liste change).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = markers.map((marker) => {
      const element = pinElement(marker);
      const open = (event: Event) => {
        event.stopPropagation();
        handlers.current.onMarkerClick?.(marker.id);
      };
      element.addEventListener("click", open);
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(event);
        }
      });
      const instance = new maplibregl.Marker({
        element,
        anchor: "left",
        offset: [-11, 0],
        draggable: marker.draggable ?? false,
      })
        .setLngLat([marker.lng, marker.lat])
        .addTo(map);
      instance.on("dragend", () => {
        const { lat, lng } = instance.getLngLat();
        handlers.current.onMarkerDragEnd?.(marker.id, lat, lng);
      });
      return instance;
    });
  }, [markers, loaded]);

  // Recadrage quand `fitKey` change (pas à chaque déplacement d'épingle).
  useEffect(() => {
    if (!loaded) return;
    const points =
      fitTo && fitTo.length > 0 ? fitTo : markers.map((m) => [m.lat, m.lng] as [number, number]);
    frame(points, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, loaded]);

  // Survol d'un point demandé par la page.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !focus) return;
    const target = {
      center: [focus.lng, focus.lat] as [number, number],
      zoom: focus.zoom ?? Math.max(map.getZoom(), 13),
    };
    if (prefersReducedMotion()) map.jumpTo(target);
    else map.flyTo({ ...target, duration: 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key, loaded]);

  function toggle3d() {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3d;
    setIs3d(next);
    map.setTerrain(next ? { source: "relief", exaggeration: TERRAIN_EXAGGERATION } : null);
    const target = { pitch: next ? PITCH_EDIT : 0, bearing: next ? map.getBearing() : 0 };
    if (prefersReducedMotion()) map.jumpTo(target);
    else map.easeTo({ ...target, duration: 800 });
  }

  if (failed) return <>{fallback ?? null}</>;

  return (
    <div className={`gt3d relative w-full overflow-hidden bg-gt-teal-900 ${className}`}>
      <div className="absolute inset-0">
        <div
          ref={containerRef}
          className="size-full"
          role="region"
          aria-label="Carte satellite du réseau"
        />
      </div>
      {!loaded ? (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/80">
          Chargement de la vue satellite…
        </div>
      ) : null}

      <div className={`absolute bottom-7 z-[1000] ${leftControlsClassName}`}>
        <button
          type="button"
          onClick={toggle3d}
          aria-pressed={is3d}
          className="gt3d-glass flex h-11 items-center gap-2 px-4 text-sm font-semibold text-white"
        >
          <Icon name="layers" className="size-4" />
          {is3d ? "Vue 2D" : "Vue 3D"}
        </button>
      </div>
      <div className="gt3d-glass absolute right-3 bottom-7 z-[1000] flex flex-col gap-1 p-1.5">
        <button
          type="button"
          onClick={() =>
            frame(
              markers.map((m) => [m.lat, m.lng] as [number, number]),
              true,
            )
          }
          className="gt3d-btn"
          aria-label="Recentrer sur tous les lieux"
          title="Recentrer"
        >
          <Icon name="crosshair" className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          className="gt3d-btn"
          aria-label="Zoom avant"
        >
          <Icon name="plus" className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          className="gt3d-btn"
          aria-label="Zoom arrière"
        >
          <Icon name="minus" className="size-4" />
        </button>
      </div>
      <p className="absolute inset-x-0 bottom-0 truncate bg-gt-teal-900/55 px-3 py-0.5 text-center text-[10px] text-white/75">
        {MAP3D_ATTRIBUTION}
      </p>
    </div>
  );
}
