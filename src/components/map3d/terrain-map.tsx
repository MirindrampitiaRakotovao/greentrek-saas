"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import {
  BEARING_3D,
  MAP3D_ATTRIBUTION,
  MAP3D_LOCALE,
  MAPLIBRE_WORKER_URL,
  PITCH_3D,
  prefersReducedMotion,
} from "@/components/map3d/shared";
import {
  boundsOf,
  MAP3D_COLORS,
  passagePoints,
  routeFeature,
  satelliteStyle,
  TERRAIN_EXAGGERATION,
} from "@/lib/map3d/style";

/**
 * Carte 3D d'un itinéraire (étape 6a) : vue satellite inclinée avec relief, eaux mises en
 * valeur, étapes numérotées avec leur nom, lieux traversés nommés, tracé lumineux, et
 * panneaux en verre sombre aux couleurs Green Trek (d'après la référence de l'étudiant).
 * Chargée sans rendu serveur (WebGL) par `circuit-map-3d.tsx`.
 */

export type Map3DStep = {
  /** Identifiant de l'étape (nœud du graphe), pour reconnaître les lieux de passage. */
  etapeId: string;
  ordre: number;
  nom: string;
  type?: string;
  latitude: number;
  longitude: number;
};
export type Map3DPoint = { id: string; nom: string; latitude: number; longitude: number };

export type TerrainMapProps = {
  title: string;
  steps: readonly Map3DStep[];
  /** Tracé à travers les tronçons (plus court chemin), ou null : lignes droites indicatives. */
  trace: readonly Map3DPoint[] | null;
  /** Ligne à dessiner [latitude, longitude] : tracés réels des tronçons (étape 6b-2). */
  line?: readonly [number, number][] | null;
  /** Affiché à la place si le navigateur ne sait pas dessiner en WebGL (carte 2D). */
  fallback?: ReactNode;
};

/** Étiquette d'une étape : pastille numérotée et nom (HTML, posé sur le relief). */
function stepElement(step: Map3DStep, onClick: () => void): HTMLElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "gt3d-step";
  el.setAttribute("aria-label", `Étape ${step.ordre} : ${step.nom}`);
  const num = document.createElement("span");
  num.className = "gt3d-step__num";
  num.textContent = String(step.ordre);
  const name = document.createElement("span");
  name.className = "gt3d-step__name";
  name.textContent = step.nom;
  el.append(num, name);
  el.addEventListener("click", onClick);
  return el;
}

/** Lieu traversé (pas une étape du circuit) : petit point et nom discret. */
function passageElement(point: Map3DPoint): HTMLElement {
  const el = document.createElement("div");
  el.className = "gt3d-passage";
  el.setAttribute("aria-hidden", "true");
  const dot = document.createElement("span");
  dot.className = "gt3d-passage__dot";
  const name = document.createElement("span");
  name.className = "gt3d-passage__name";
  name.textContent = point.nom;
  el.append(dot, name);
  return el;
}

export default function TerrainMap({ title, steps, trace, line, fallback }: TerrainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [is3d, setIs3d] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const route = useMemo(
    () =>
      line && line.length > 1
        ? line.map(([latitude, longitude]) => ({ latitude, longitude }))
        : trace && trace.length > 1
          ? trace
          : steps,
    [line, trace, steps],
  );
  const passages = useMemo(
    () => (trace ? passagePoints(trace, new Set(steps.map((s) => s.etapeId))) : []),
    [trace, steps],
  );

  /** Vue d'ensemble : tout l'itinéraire, incliné en 3D. */
  const overview = useCallback(
    (animate: boolean) => {
      const map = mapRef.current;
      const bounds = boundsOf(route);
      if (!map || !bounds) return;
      // Marges : panneaux posés sur la carte, et noms des étapes écrits à droite du point.
      const wide = map.getContainer().clientWidth >= 1024;
      const camera = map.cameraForBounds(bounds, {
        padding: {
          top: 150,
          bottom: 120,
          left: wide ? 60 : 40,
          right: wide ? 420 : 150,
        },
        bearing: is3d ? BEARING_3D : 0,
        maxZoom: 15,
      });
      if (!camera) return;
      const target = { ...camera, pitch: is3d ? PITCH_3D : 0 };
      if (animate && !prefersReducedMotion()) map.flyTo({ ...target, duration: 1600 });
      else map.jumpTo(target);
    },
    [route, is3d],
  );

  const goTo = useCallback(
    (index: number) => {
      const map = mapRef.current;
      const step = steps[index];
      if (!map || !step) return;
      setActive(index);
      const target = {
        center: [step.longitude, step.latitude] as [number, number],
        zoom: 15,
        pitch: is3d ? 65 : 0,
        bearing: is3d ? map.getBearing() : 0,
      };
      if (prefersReducedMotion()) map.jumpTo(target);
      else map.flyTo({ ...target, duration: 2000, essential: true });
    },
    [steps, is3d],
  );

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
        center: [steps[0]?.longitude ?? 49.5, steps[0]?.latitude ?? -17.5],
        zoom: 11,
        pitch: PITCH_3D,
        bearing: BEARING_3D,
        maxPitch: 75,
        cooperativeGestures: true,
        // Sources affichées par une ligne discrète du composant (le bandeau de MapLibre
        // masquait les boutons du bas).
        attributionControl: false,
        locale: MAP3D_LOCALE,
      });
    } catch {
      // Navigateur sans WebGL : la page affiche la carte 2D à la place.
      queueMicrotask(() => setFailed(true));
      return;
    }
    mapRef.current = map;
    map.on("load", () => {
      map.setTerrain({ source: "relief", exaggeration: TERRAIN_EXAGGERATION });
      setLoaded(true);
    });
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carte créée une seule fois
  }, []);

  // Tracé, étapes et lieux traversés (à chaque changement de données).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const data = routeFeature(route);
    const source = map.getSource("itineraire") as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(data);
    else {
      map.addSource("itineraire", { type: "geojson", data, lineMetrics: true });
      // Halo large et flou, puis trait lumineux (révélé progressivement au chargement).
      map.addLayer({
        id: "itineraire-halo",
        type: "line",
        source: "itineraire",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": MAP3D_COLORS.route,
          "line-width": 14,
          "line-blur": 10,
          "line-opacity": 0.45,
        },
      });
      map.addLayer({
        id: "itineraire",
        type: "line",
        source: "itineraire",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: trace
          ? { "line-color": MAP3D_COLORS.route, "line-width": 4 }
          : { "line-color": MAP3D_COLORS.route, "line-width": 3, "line-dasharray": [2, 2] },
      });
      if (trace && !prefersReducedMotion()) {
        let frame = 0;
        const start = performance.now();
        const reveal = (now: number) => {
          const p = Math.min(1, (now - start) / 1800);
          if (!map.getLayer("itineraire")) return;
          map.setPaintProperty("itineraire", "line-gradient", [
            "step",
            ["line-progress"],
            MAP3D_COLORS.route,
            Math.max(p, 0.0001),
            "rgba(250, 213, 148, 0)",
          ]);
          if (p < 1) frame = requestAnimationFrame(reveal);
        };
        frame = requestAnimationFrame(reveal);
        map.once("remove", () => cancelAnimationFrame(frame));
      }
    }

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [
      ...passages.map((p) =>
        new maplibregl.Marker({ element: passageElement(p), anchor: "left", offset: [-4, 0] })
          .setLngLat([p.longitude, p.latitude])
          .addTo(map),
      ),
      ...steps.map((s, i) =>
        new maplibregl.Marker({
          element: stepElement(s, () => goTo(i)),
          anchor: "bottom-left",
          offset: [-14, 0],
        })
          .setLngLat([s.longitude, s.latitude])
          .addTo(map),
      ),
    ];
    overview(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recentrer seulement si les données changent
  }, [loaded, route, passages, steps, trace]);

  // Étape active mise en avant.
  useEffect(() => {
    const offset = passages.length;
    markersRef.current.forEach((m, i) =>
      m.getElement().classList.toggle("gt3d-step--active", i - offset === active),
    );
  }, [active, passages.length, loaded]);

  function toggle3d() {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3d;
    setIs3d(next);
    map.setTerrain(next ? { source: "relief", exaggeration: TERRAIN_EXAGGERATION } : null);
    const target = { pitch: next ? PITCH_3D : 0, bearing: next ? BEARING_3D : 0 };
    if (prefersReducedMotion()) map.jumpTo(target);
    else map.easeTo({ ...target, duration: 900 });
  }

  if (failed) return <>{fallback ?? null}</>;
  const current = active === null ? null : steps[active];

  return (
    <div className="gt3d relative h-[520px] overflow-hidden rounded-3xl bg-gt-teal-900 sm:h-[600px]">
      <div className="absolute inset-0">
        <div
          ref={containerRef}
          className="size-full"
          role="region"
          aria-label={`Carte satellite en 3D de l'itinéraire : ${steps.map((s) => s.nom).join(", ")}`}
        />
      </div>
      {!loaded ? (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/80">
          Chargement de la vue satellite…
        </div>
      ) : null}

      {/* Panneau du circuit (haut gauche). */}
      <div className="gt3d-glass pointer-events-auto absolute top-3 left-3 max-w-[calc(100%-1.5rem)] p-3 sm:top-4 sm:left-4 sm:max-w-xs sm:p-4">
        <p className="flex items-center gap-2">
          <span className="rounded-full bg-gt-sand-300 px-2.5 py-0.5 text-[11px] font-semibold text-gt-teal-900">
            Vue satellite {is3d ? "3D" : "2D"}
          </span>
          <span className="text-[11px] text-white/70">{steps.length} étapes</span>
        </p>
        <p className="mt-2 font-display text-lg leading-tight text-white sm:text-xl">{title}</p>
      </div>

      {/* Liste des étapes (droite, grand écran). */}
      <nav
        aria-label="Étapes de l'itinéraire"
        className="gt3d-glass absolute top-4 right-4 hidden max-h-[calc(100%-7rem)] w-64 overflow-y-auto p-3 lg:block"
      >
        <p className="flex items-center justify-between px-1 text-sm font-semibold text-white">
          Itinéraire
          <button
            type="button"
            onClick={() => {
              setActive(null);
              overview(true);
            }}
            className="text-[11px] font-medium text-gt-sand-300 underline"
          >
            Vue d&apos;ensemble
          </button>
        </p>
        <ol className="mt-2 space-y-1">
          {steps.map((s, i) => (
            <li key={`${s.etapeId}-${s.ordre}`}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={active === i ? "step" : undefined}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-sm transition-colors ${
                  active === i
                    ? "bg-gt-sand-300 text-gt-teal-900"
                    : "text-white/85 hover:bg-white/10"
                }`}
              >
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                    active === i ? "bg-gt-teal-900 text-gt-sand-300" : "bg-white/15 text-white"
                  }`}
                >
                  {s.ordre}
                </span>
                <span className="min-w-0 truncate">{s.nom}</span>
              </button>
            </li>
          ))}
        </ol>
        {passages.length > 0 ? (
          <p className="mt-3 border-t border-white/10 px-1 pt-2 text-[11px] leading-relaxed text-white/65">
            Passe aussi par : {passages.map((p) => p.nom).join(", ")}
          </p>
        ) : null}
      </nav>

      {/* Navigateur d'étapes (bas). */}
      <div className="absolute inset-x-0 bottom-6 flex items-end justify-between gap-2 px-3 sm:px-4">
        <div className="gt3d-glass flex items-center gap-1 p-1.5">
          <button
            type="button"
            onClick={() => goTo(active === null ? steps.length - 1 : Math.max(0, active - 1))}
            disabled={active === 0}
            className="gt3d-btn"
            aria-label="Étape précédente"
          >
            <Icon name="navigation" className="size-4 -rotate-[135deg]" />
          </button>
          <div className="min-w-0 px-2 text-center sm:min-w-44" aria-live="polite">
            {current ? (
              <>
                <p className="text-[11px] text-white/65">
                  Étape {current.ordre} / {steps.length}
                </p>
                <p className="max-w-36 truncate text-sm font-semibold text-white sm:max-w-52">
                  {current.nom}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] text-white/65">{steps.length} étapes</p>
                <p className="text-sm font-semibold text-white">Parcourir</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => goTo(active === null ? 0 : Math.min(steps.length - 1, active + 1))}
            disabled={active === steps.length - 1}
            className="gt3d-btn gt3d-btn--accent"
            aria-label="Étape suivante"
          >
            <Icon name="navigation" className="size-4 rotate-45" />
          </button>
        </div>

        <div className="gt3d-glass flex items-center gap-1 p-1.5">
          <button
            type="button"
            onClick={toggle3d}
            className="gt3d-btn w-auto px-3 text-xs font-semibold"
            aria-pressed={is3d}
          >
            {is3d ? "2D" : "3D"}
          </button>
          <button
            type="button"
            onClick={() => {
              setActive(null);
              overview(true);
            }}
            className="gt3d-btn"
            aria-label="Voir tout l'itinéraire"
          >
            <Icon name="crosshair" className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            className="gt3d-btn hidden sm:grid"
            aria-label="Zoomer"
          >
            <Icon name="plus" className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            className="gt3d-btn hidden sm:grid"
            aria-label="Dézoomer"
          >
            <Icon name="minus" className="size-4" />
          </button>
        </div>
      </div>
      <p className="absolute inset-x-0 bottom-0 truncate bg-gt-teal-900/55 px-3 py-0.5 text-center text-[10px] text-white/75">
        {MAP3D_ATTRIBUTION}
      </p>
    </div>
  );
}
