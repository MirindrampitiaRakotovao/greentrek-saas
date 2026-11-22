"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import * as maplibregl from "maplibre-gl";
import type { ExpressionSpecification, Map as MapLibreMap, Marker } from "maplibre-gl";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  MAP3D_ATTRIBUTION,
  MAP3D_LOCALE,
  MAPLIBRE_WORKER_URL,
  prefersReducedMotion,
} from "@/components/map3d/shared";
import { Icon } from "@/components/ui/icon";
import { MAP3D_COLORS, satelliteStyle, TERRAIN_EXAGGERATION } from "@/lib/map3d/style";
import {
  type Ambiance,
  AMBIANCES,
  ambianceForHour,
  buildRoute,
  lerpAngle,
  type LatLngPoint,
  locateSteps,
  positionAt,
  stepNear,
  VISIT_KM_PER_SECOND,
  VISIT_SPRINT,
} from "@/lib/visit/route";

/**
 * Visite virtuelle d'un circuit (étape 8a, demande de l'étudiant : « comme dans un jeu
 * vidéo ») : un randonneur, vu de dos, marche sur le VRAI tracé du circuit, posé sur le
 * relief et l'imagerie satellite ; caméra à la troisième personne. Tout ce qui est montré
 * est réel : imagerie, relief, eaux, sentiers, étapes et leurs descriptions. Les seuls
 * effets sont la lumière (ambiances) et le personnage.
 *
 * Commandes : ↑ / Z avancer, ↓ / S reculer, Maj courir, ← → / Q D tourner la caméra,
 * glisser pour tourner et incliner, Espace : visite automatique. Sur téléphone : boutons.
 */

export type TourStep = {
  ordre: number;
  nom: string;
  type: string;
  description: string | null;
  latitude: number;
  longitude: number;
  jour: number | null;
};

export type VirtualTourProps = {
  agenceNom: string;
  titre: string;
  steps: readonly TourStep[];
  /** Ligne du parcours [latitude, longitude] : tracés réels enchaînés, sinon étapes. */
  line: readonly LatLngPoint[];
  /** Nombre de tronçons au tracé relevé, sur le total (honnêteté de l'affichage). */
  traces: { relevés: number; total: number };
  back: { href: string; label: string };
  fallback?: ReactNode;
};

const ZOOM = 16.3;
const PITCH = 68;
/** Arrêt de la visite automatique à chaque étape (secondes). */
const PAUSE_ETAPE_S = 3.5;
/** Dégradé vide (MapLibre exige une expression fondée sur la progression le long de la ligne). */
const TRANSPARENT_GRADIENT = [
  "interpolate",
  ["linear"],
  ["line-progress"],
  0,
  "rgba(0, 0, 0, 0)",
  1,
  "rgba(0, 0, 0, 0)",
] as ExpressionSpecification;

/** Randonneur vu de dos (sac à dos, bâton), en SVG : il « marche » par une animation CSS. */
const HIKER_SVG = `<svg viewBox="0 0 64 80" width="54" height="68" aria-hidden="true">
  <ellipse class="gt-hiker__shadow" cx="32" cy="74" rx="15" ry="4.5" />
  <g class="gt-hiker__body">
    <line class="gt-hiker__pole" x1="48" y1="38" x2="54" y2="72" />
    <path class="gt-hiker__leg gt-hiker__leg--l" d="M27 50 l-3 20" />
    <path class="gt-hiker__leg gt-hiker__leg--r" d="M37 50 l3 20" />
    <rect class="gt-hiker__pack" x="19" y="22" width="26" height="30" rx="8" />
    <rect class="gt-hiker__packlid" x="21" y="18" width="22" height="9" rx="4" />
    <path class="gt-hiker__strap" d="M24 30 h16 M24 40 h16" />
    <circle class="gt-hiker__head" cx="32" cy="12" r="8" />
    <path class="gt-hiker__hat" d="M22 11 q10 -10 20 0 z" />
  </g>
</svg>`;

function hikerElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "gt-hiker";
  el.innerHTML = `<span class="gt-hiker__glow"></span>${HIKER_SVG}`;
  return el;
}

function stepMarkerElement(step: TourStep): HTMLElement {
  const el = document.createElement("div");
  el.className = "gt3d-step gt-tour-step";
  el.setAttribute("aria-hidden", "true");
  const num = document.createElement("span");
  num.className = "gt3d-step__num";
  num.textContent = String(step.ordre);
  const name = document.createElement("span");
  name.className = "gt3d-step__name";
  name.textContent = step.nom;
  el.append(num, name);
  return el;
}

const fmtKm = (km: number) => `${km.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;

export default function VirtualTour({
  agenceNom,
  titre,
  steps,
  line,
  traces,
  back,
  fallback,
}: VirtualTourProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hikerRef = useRef<Marker | null>(null);
  const route = useMemo(() => buildRoute(line), [line]);
  const stepKms = useMemo(
    () =>
      locateSteps(
        route,
        steps.map((s) => [s.latitude, s.longitude] as LatLngPoint),
      ),
    [route, steps],
  );

  // État de la simulation (références : modifié 60 fois par seconde sans re-rendu).
  const sim = useRef({
    km: 0,
    keys: new Set<string>(),
    hold: 0 as -1 | 0 | 1,
    orbit: 0,
    orbitInput: 0,
    pitch: PITCH,
    bearing: 0,
    auto: false,
    pauseUntil: 0,
    lastStep: -1,
    minElev: Infinity,
    gain: 0,
    lastElev: null as number | null,
  });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hud, setHud] = useState({ km: 0, bearing: 0, elev: null as number | null, gain: 0 });
  const [auto, setAuto] = useState(false);
  const [card, setCard] = useState<number>(-1);
  const [ambiance, setAmbiance] = useState<Ambiance>("jour");
  const [arrived, setArrived] = useState(false);
  const [help, setHelp] = useState(true);
  const reduced = useRef(false);

  const applyAmbiance = useCallback((map: MapLibreMap, value: Ambiance) => {
    const a = AMBIANCES[value];
    map.setSky({
      "sky-color": a.sky.sky,
      "horizon-color": a.sky.horizon,
      "fog-color": a.sky.fog,
      "sky-horizon-blend": 0.55,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.35,
    });
    map.setPaintProperty("satellite", "raster-brightness-max", a.raster.brightnessMax);
    map.setPaintProperty("satellite", "raster-saturation", a.raster.saturation);
    map.setPaintProperty("satellite", "raster-contrast", a.raster.contrast);
    map.setPaintProperty("satellite", "raster-hue-rotate", a.raster.hue);
  }, []);

  /** Saut direct vers une étape (mode « mouvement réduit », liste des étapes). */
  const jumpToStep = useCallback(
    (index: number) => {
      const km = stepKms[index];
      if (km === undefined) return;
      sim.current.km = km;
      sim.current.pauseUntil = performance.now() + PAUSE_ETAPE_S * 1000;
      sim.current.lastStep = index;
      setCard(index);
    },
    [stepKms],
  );

  // Carte, randonneur, étapes et boucle d'animation.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || route.points.length < 2) return;
    reduced.current = prefersReducedMotion();
    maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);
    const start = positionAt(route, 0);
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container,
        style: satelliteStyle(),
        center: [start.point[1], start.point[0]],
        zoom: ZOOM,
        pitch: PITCH,
        bearing: start.bearing,
        maxPitch: 82,
        interactive: false,
        attributionControl: false,
        locale: MAP3D_LOCALE,
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    mapRef.current = map;
    sim.current.bearing = start.bearing;
    let frame = 0;
    let last = performance.now();
    let lastHud = 0;
    let lastGradient = -1;

    map.on("load", () => {
      map.setTerrain({ source: "relief", exaggeration: TERRAIN_EXAGGERATION });
      const coordinates = route.points.map(([lat, lng]) => [lng, lat]);
      map.addSource("parcours", {
        type: "geojson",
        lineMetrics: true,
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } },
      });
      // Chemin restant : pointillés clairs ; chemin parcouru : sable lumineux.
      map.addLayer({
        id: "parcours-reste",
        type: "line",
        source: "parcours",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 3,
          "line-opacity": 0.7,
          "line-dasharray": [1.5, 1.5],
        },
      });
      map.addLayer({
        id: "parcours-halo",
        type: "line",
        source: "parcours",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-width": 16, "line-blur": 10, "line-gradient": TRANSPARENT_GRADIENT },
      });
      map.addLayer({
        id: "parcours-fait",
        type: "line",
        source: "parcours",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-width": 5, "line-gradient": TRANSPARENT_GRADIENT },
      });
      steps.forEach((step) => {
        new maplibregl.Marker({
          element: stepMarkerElement(step),
          anchor: "bottom-left",
          offset: [-14, -6],
        })
          .setLngLat([step.longitude, step.latitude])
          .addTo(map);
      });
      hikerRef.current = new maplibregl.Marker({ element: hikerElement(), anchor: "bottom" })
        .setLngLat([start.point[1], start.point[0]])
        .addTo(map);
      // Ambiance selon l'heure de Madagascar (UTC+3) : la surprise de l'ouverture.
      const hour = (new Date().getUTCHours() + 3) % 24;
      const initial = ambianceForHour(hour);
      applyAmbiance(map, initial);
      setAmbiance(initial);
      setLoaded(true);
      frame = requestAnimationFrame(tick);
    });

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = sim.current;
      const k = s.keys;
      let dir = s.hold;
      if (k.has("ArrowUp") || k.has("z") || k.has("w")) dir = 1;
      if (k.has("ArrowDown") || k.has("s")) dir = -1;
      const sprint = k.has("Shift") ? VISIT_SPRINT : 1;
      const before = s.km;
      // Mouvement réduit (préférence du système) : la visite automatique saute d'étape en
      // étape au lieu de défiler.
      if (s.auto && reduced.current && s.hold === 0 && now >= s.pauseUntil) {
        const nextStep = stepKms.findIndex((km) => km > s.km + 0.01);
        s.km = nextStep === -1 ? route.totalKm : stepKms[nextStep]!;
        s.pauseUntil = now + PAUSE_ETAPE_S * 1000;
      }
      if (s.auto && !reduced.current && dir === 0) dir = now < s.pauseUntil ? 0 : 1;
      if (dir !== 0 && !s.auto) s.pauseUntil = 0;
      if (dir !== 0 && now >= s.pauseUntil) {
        s.km = Math.min(route.totalKm, Math.max(0, s.km + dir * VISIT_KM_PER_SECOND * sprint * dt));
      }
      const moving = s.km !== before;

      // Arrivée à une étape : fiche, et pause en visite automatique.
      const near = stepNear(stepKms, s.km, 0.08);
      if (near !== -1 && near !== s.lastStep) {
        s.lastStep = near;
        setCard(near);
        if (s.auto) s.pauseUntil = now + PAUSE_ETAPE_S * 1000;
      }
      if (s.km >= route.totalKm - 1e-6 && before < route.totalKm) {
        s.auto = false;
        setAuto(false);
        setArrived(true);
      }

      // Caméra à la troisième personne : derrière le randonneur, dans le sens de la marche.
      const pos = positionAt(route, s.km);
      if (k.has("ArrowLeft") || k.has("q") || k.has("a")) s.orbit -= 70 * dt;
      if (k.has("ArrowRight") || k.has("d")) s.orbit += 70 * dt;
      s.orbit += s.orbitInput * 70 * dt;
      const target = (pos.bearing + s.orbit + 360) % 360;
      s.bearing = lerpAngle(s.bearing, target, 1 - Math.exp(-dt * 3));
      const lngLat: [number, number] = [pos.point[1], pos.point[0]];
      map.jumpTo({ center: lngLat, bearing: s.bearing, pitch: s.pitch, zoom: ZOOM });
      hikerRef.current?.setLngLat(lngLat);
      hikerRef.current?.getElement().classList.toggle("is-walking", moving);

      // Chemin parcouru (dégradé recalculé au plus 10 fois par seconde).
      const progress = route.totalKm > 0 ? s.km / route.totalKm : 0;
      if (Math.abs(progress - lastGradient) > 0.002 && now - lastHud > 90) {
        lastGradient = progress;
        const p = Math.max(progress, 0.0001);
        for (const [layer, color] of [
          ["parcours-fait", MAP3D_COLORS.route],
          ["parcours-halo", "rgba(250, 213, 148, 0.55)"],
        ] as const) {
          map.setPaintProperty(layer, "line-gradient", [
            "step",
            ["line-progress"],
            color,
            p,
            "rgba(0, 0, 0, 0)",
          ]);
        }
      }
      // Tableau de bord : altitude du modèle de terrain et dénivelé positif cumulé.
      if (now - lastHud > 120) {
        lastHud = now;
        const raw = map.queryTerrainElevation(lngLat);
        const elev = raw === null ? null : raw / TERRAIN_EXAGGERATION;
        if (elev !== null) {
          if (moving && s.lastElev !== null && elev > s.lastElev && s.km > before) {
            s.gain += elev - s.lastElev;
          }
          s.lastElev = elev;
        }
        setHud({ km: s.km, bearing: s.bearing, elev, gain: s.gain });
      }
      frame = requestAnimationFrame(tick);
    };

    return () => {
      cancelAnimationFrame(frame);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carte créée une seule fois
  }, [route]);

  // Clavier : déplacement (touches maintenues), Espace : visite automatique.
  useEffect(() => {
    const keys = sim.current.keys;
    const normalize = (e: KeyboardEvent) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const MOVE = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "z",
      "q",
      "s",
      "d",
      "w",
      "a",
      "Shift",
    ];
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      const key = normalize(e);
      if (key === " ") {
        e.preventDefault();
        toggleAuto();
        return;
      }
      if (MOVE.includes(key)) {
        if (key.startsWith("Arrow")) e.preventDefault();
        keys.add(key);
        setHelp(false);
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(normalize(e));
    const blur = () => keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleAuto() {
    const s = sim.current;
    if (s.km >= route.totalKm - 1e-6) {
      s.km = 0;
      s.lastStep = -1;
      s.gain = 0;
      s.lastElev = null;
      setArrived(false);
    }
    s.auto = !s.auto;
    s.pauseUntil = 0;
    setAuto(s.auto);
    setHelp(false);
  }

  function chooseAmbiance(value: Ambiance) {
    setAmbiance(value);
    if (mapRef.current) applyAmbiance(mapRef.current, value);
  }

  /** Glisser sur la scène : tourner (horizontal) et incliner (vertical) la caméra. */
  const drag = useRef<{ x: number; y: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const s = sim.current;
    s.orbit += (e.clientX - drag.current.x) * 0.3;
    s.pitch = Math.min(80, Math.max(35, s.pitch - (e.clientY - drag.current.y) * 0.15));
    drag.current = { x: e.clientX, y: e.clientY };
    setHelp(false);
  }
  const hold = (value: -1 | 0 | 1) => () => {
    sim.current.hold = value;
    if (value !== 0) setHelp(false);
  };
  const orbit = (value: -1 | 0 | 1) => () => {
    sim.current.orbitInput = value;
  };

  if (failed || route.points.length < 2) {
    return (
      <>
        {fallback ?? (
          <p className="p-6 text-white">
            La visite virtuelle demande un navigateur compatible WebGL.
          </p>
        )}
      </>
    );
  }

  const progress = route.totalKm > 0 ? hud.km / route.totalKm : 0;
  const current = card >= 0 ? steps[card] : undefined;
  const nextIndex = stepKms.findIndex((km) => km > hud.km + 0.08);
  const next = nextIndex >= 0 ? steps[nextIndex] : undefined;

  return (
    <div
      className="gt-tour relative h-dvh w-full overflow-hidden bg-[#061b20] text-white select-none"
      data-ambiance={ambiance}
    >
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <div
          ref={containerRef}
          className="size-full"
          role="img"
          aria-label={`Visite virtuelle en 3D du circuit ${titre} : ${steps.map((s) => s.nom).join(", ")}`}
        />
      </div>
      {/* Vignette sombre sur les bords (effet cinéma). */}
      <div aria-hidden="true" className="gt-tour-vignette pointer-events-none absolute inset-0" />

      {!loaded ? (
        <div className="absolute inset-0 grid place-items-center bg-[#061b20]">
          <div className="text-center">
            <p className="font-display text-3xl">{titre}</p>
            <p className="mt-2 text-sm text-white/70">
              Chargement du relief et de l&apos;imagerie satellite…
            </p>
          </div>
        </div>
      ) : null}

      {/* En-tête : retour, titre, ambiance. */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-5">
        <div className="gt3d-glass pointer-events-auto flex max-w-[70%] items-center gap-3 p-2 pr-4 sm:max-w-md">
          <Link
            href={back.href}
            className="gt3d-btn shrink-0"
            aria-label={back.label}
            title={back.label}
          >
            <Icon name="navigation" className="size-4 -rotate-[135deg]" />
          </Link>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] text-white/70">
              <span className="rounded-full bg-gt-sand-300 px-2 py-px font-semibold whitespace-nowrap text-gt-teal-900">
                Visite virtuelle
              </span>
              <span className="truncate">{agenceNom}</span>
            </p>
            <h1 className="truncate font-display text-lg leading-tight sm:text-xl">{titre}</h1>
          </div>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          {/* Téléphone : un seul bouton qui passe d'une ambiance à la suivante. */}
          <button
            type="button"
            onClick={() => {
              const order = Object.keys(AMBIANCES) as Ambiance[];
              chooseAmbiance(order[(order.indexOf(ambiance) + 1) % order.length]!);
            }}
            className="gt3d-glass flex items-center gap-2 px-3 py-2 text-xs font-semibold sm:hidden"
            aria-label={`Ambiance : ${AMBIANCES[ambiance].label} (changer)`}
          >
            <Icon
              name={ambiance === "nuit" || ambiance === "crepuscule" ? "moon" : "sun"}
              className="size-4 text-gt-sand-300"
            />
            {AMBIANCES[ambiance].label}
          </button>
          <div
            role="group"
            aria-label="Ambiance de lumière"
            className="gt3d-glass hidden gap-1 p-1 sm:flex"
          >
            {(Object.keys(AMBIANCES) as Ambiance[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => chooseAmbiance(a)}
                aria-pressed={ambiance === a}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  ambiance === a
                    ? "bg-gt-sand-300 text-gt-teal-900"
                    : "text-white/80 hover:bg-white/10"
                }`}
              >
                {AMBIANCES[a].label}
              </button>
            ))}
          </div>
          <MiniMap
            route={route.points}
            stepKms={stepKms}
            km={hud.km}
            bearing={hud.bearing}
            positionOf={(km) => positionAt(route, km).point}
          />
        </div>
      </header>

      {/* Fiche de l'étape atteinte. */}
      {current ? (
        <aside
          aria-live="polite"
          className="gt3d-glass gt-tour-card absolute top-20 left-3 w-[min(22rem,calc(100%-1.5rem))] p-3 sm:top-28 sm:left-5 sm:p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-gt-sand-300 font-bold text-gt-teal-900">
                {current.ordre}
              </span>
              <span className="text-xs text-white/70">
                Étape {card + 1} / {steps.length}
                {current.jour ? ` · jour ${current.jour}` : ""} · {current.type}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setCard(-1)}
              className="gt3d-btn size-7"
              aria-label="Fermer la fiche"
            >
              <Icon name="close" className="size-3.5" />
            </button>
          </div>
          <h2 className="mt-2 font-display text-xl leading-tight sm:text-2xl">{current.nom}</h2>
          {current.description ? (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/85 sm:mt-2 sm:line-clamp-5">
              {current.description}
            </p>
          ) : null}
        </aside>
      ) : null}

      {arrived ? (
        <div className="absolute inset-0 grid place-items-center bg-black/30">
          <div className="gt3d-glass max-w-sm p-6 text-center">
            <p className="text-sm text-gt-sand-300">Arrivée</p>
            <p className="mt-1 font-display text-3xl">{steps.at(-1)?.nom}</p>
            <p className="mt-2 text-sm text-white/80">
              {fmtKm(route.totalKm)} parcourus en {steps.length} étapes
              {hud.gain > 1 ? ` · ≈ ${Math.round(hud.gain)} m de dénivelé positif` : ""}.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={toggleAuto}
                className="rounded-full bg-gt-sand-300 px-4 py-2 text-sm font-semibold text-gt-teal-900"
              >
                Recommencer
              </button>
              <Link
                href={back.href}
                className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium"
              >
                {back.label}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Aide des commandes (disparaît au premier mouvement). */}
      {help && loaded ? (
        <div className="gt3d-glass pointer-events-none absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 p-5 text-center text-sm sm:block">
          <p className="font-display text-xl">Prêt pour la balade ?</p>
          <p className="mt-2 text-white/80">
            <kbd className="gt-kbd">↑</kbd> ou <kbd className="gt-kbd">Z</kbd> avancer ·{" "}
            <kbd className="gt-kbd">Maj</kbd> courir · <kbd className="gt-kbd">← →</kbd> tourner
          </p>
          <p className="mt-1 text-white/80">
            Glisser pour regarder autour · <kbd className="gt-kbd">Espace</kbd> visite automatique
          </p>
        </div>
      ) : null}

      {/* Bas d'écran : progression, commandes, mesures. */}
      <footer className="absolute inset-x-0 bottom-0 p-3 sm:p-5">
        <div className="gt3d-glass mx-auto max-w-4xl p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-white/80">
            <span>
              <strong className="text-sm text-white">{fmtKm(hud.km)}</strong> /{" "}
              {fmtKm(route.totalKm)}
            </span>
            <span>{next ? `Prochaine étape : ${next.nom}` : "Dernière étape atteinte"}</span>
            <span title="Altitude du modèle de terrain (Mapzen), à quelques mètres près">
              Altitude ≈ {hud.elev === null ? "—" : `${Math.round(hud.elev)} m`} · D+ ≈{" "}
              {Math.round(hud.gain)} m
            </span>
          </div>
          {/* Barre de progression avec les étapes. */}
          <div className="relative mt-3 h-2 rounded-full bg-white/15">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gt-sand-300"
              style={{ width: `${progress * 100}%` }}
            />
            {stepKms.map((km, i) => (
              <button
                key={`${steps[i]!.ordre}-${i}`}
                type="button"
                onClick={() => jumpToStep(i)}
                className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#061b20] ${
                  km <= hud.km + 0.01 ? "bg-gt-sand-300" : "bg-white/60"
                }`}
                style={{ left: `${route.totalKm > 0 ? (km / route.totalKm) * 100 : 0}%` }}
                aria-label={`Aller à l'étape ${i + 1} : ${steps[i]!.nom}`}
                title={steps[i]!.nom}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="gt3d-btn"
                aria-label="Tourner la caméra à gauche"
                onPointerDown={orbit(-1)}
                onPointerUp={orbit(0)}
                onPointerLeave={orbit(0)}
              >
                <Icon name="swap" className="size-4 -scale-x-100" />
              </button>
              <button
                type="button"
                className="gt3d-btn"
                aria-label="Reculer (maintenir)"
                onPointerDown={hold(-1)}
                onPointerUp={hold(0)}
                onPointerLeave={hold(0)}
              >
                <Icon name="minus" className="size-4" />
              </button>
              <button
                type="button"
                className="gt3d-btn gt3d-btn--accent size-11"
                aria-label="Avancer (maintenir)"
                onPointerDown={hold(1)}
                onPointerUp={hold(0)}
                onPointerLeave={hold(0)}
              >
                <Icon name="navigation" className="size-5 rotate-45" />
              </button>
              <button
                type="button"
                className="gt3d-btn"
                aria-label="Tourner la caméra à droite"
                onPointerDown={orbit(1)}
                onPointerUp={orbit(0)}
                onPointerLeave={orbit(0)}
              >
                <Icon name="swap" className="size-4" />
              </button>
            </div>
            <p className="hidden text-center text-[11px] text-white/60 md:block">
              {traces.relevés > 0
                ? `Sentier réel : ${traces.relevés} tronçon${traces.relevés > 1 ? "s" : ""} sur ${traces.total} au tracé relevé`
                : "Tracé indicatif entre les étapes"}
            </p>
            <button
              type="button"
              onClick={toggleAuto}
              aria-pressed={auto}
              className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ${
                auto
                  ? "bg-gt-sand-300 text-gt-teal-900"
                  : "bg-white/12 text-white hover:bg-white/20"
              }`}
            >
              <Icon name={auto ? "minus" : "play"} className="size-4" />
              {auto ? (
                "Pause"
              ) : (
                <>
                  <span className="sm:hidden">Auto</span>
                  <span className="hidden sm:inline">Visite automatique</span>
                </>
              )}
            </button>
          </div>
        </div>
        <p className="mt-1 truncate text-center text-[10px] text-white/55">{MAP3D_ATTRIBUTION}</p>
      </footer>
    </div>
  );
}

/** Mini-carte (SVG) : tracé, étapes, position et boussole. */
function MiniMap({
  route,
  stepKms,
  km,
  bearing,
  positionOf,
}: {
  route: readonly LatLngPoint[];
  stepKms: readonly number[];
  km: number;
  bearing: number;
  positionOf: (km: number) => LatLngPoint;
}) {
  const box = useMemo(() => {
    const lats = route.map((p) => p[0]);
    const lngs = route.map((p) => p[1]);
    const [s, n, w, e] = [
      Math.min(...lats),
      Math.max(...lats),
      Math.min(...lngs),
      Math.max(...lngs),
    ];
    const k = Math.cos(((s + n) / 2) * (Math.PI / 180));
    const span = Math.max((e - w) * k, n - s) || 1e-4;
    return { s, n, w, e, k, span };
  }, [route]);
  const SIZE = 120;
  const PAD = 10;
  const xy = ([lat, lng]: LatLngPoint): [number, number] => {
    const scale = (SIZE - 2 * PAD) / box.span;
    const cx = ((box.w + box.e) / 2) * box.k;
    const cy = (box.s + box.n) / 2;
    return [SIZE / 2 + (lng * box.k - cx) * scale, SIZE / 2 - (lat - cy) * scale];
  };
  const d = route
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${xy(p)
          .map((v) => v.toFixed(1))
          .join(" ")}`,
    )
    .join(" ");
  const [hx, hy] = xy(positionOf(km));
  return (
    <div className="gt3d-glass relative hidden p-1.5 sm:block" aria-hidden="true">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <path
          d={d}
          fill="none"
          stroke="rgb(255 255 255 / 0.45)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {stepKms.map((s, i) => {
          const [x, y] = xy(positionOf(s));
          return (
            <circle key={i} cx={x} cy={y} r="3.2" fill={s <= km + 0.01 ? "#FAD594" : "#fff"} />
          );
        })}
        <g transform={`translate(${hx} ${hy}) rotate(${bearing})`}>
          <circle r="7" fill="rgb(250 213 148 / 0.25)" />
          <path d="M0 -6 L4 4 L0 2 L-4 4 Z" fill="#FAD594" />
        </g>
      </svg>
      {/* Boussole : le nord tourne avec la caméra. */}
      <span
        className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-black/40 text-[10px] font-bold text-gt-sand-300"
        style={{ transform: `rotate(${-bearing}deg)` }}
      >
        N
      </span>
    </div>
  );
}
