"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { Icon } from "@/components/ui/icon";
import { BASE_LAYERS, type BaseLayerId } from "@/lib/map/tiles";

/**
 * Carte Leaflet au style « Google Maps » demandé par l'étudiant : fond clair (Stadia
 * OSM Bright, données OpenStreetMap), épingles en goutte, commandes flottantes (recentrer,
 * zoom) en bas à droite, sélecteur de calques (Plan, Satellite, Relief, OSM) en bas à gauche.
 * Ce module n'est jamais rendu côté serveur (Leaflet a besoin de `window`) : il est chargé
 * par `MapView` avec un import dynamique.
 */

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  badge?: string;
  tone?: "default" | "selected" | "muted" | "new";
  draggable?: boolean;
};

export type MapFocus = { lat: number; lng: number; zoom?: number; key: string };

/** Tronçon (arête du graphe) : trait plein si mesuré, pointillé si estimé. */
export type MapEdge = {
  id: string;
  from: [number, number];
  to: [number, number];
  label: string;
  dashed?: boolean;
  tone?: "default" | "selected" | "muted";
};

const EDGE_COLORS = { default: "#1a73e8", selected: "#d93025", muted: "#7aa7c7" } as const;

/** Point discret (ex. nœud exploré par un algorithme). */
export type MapDot = { id: string; lat: number; lng: number; color: string; label: string };

export type LeafletMapProps = {
  markers: readonly MapMarker[];
  path?: readonly [number, number][];
  edges?: readonly MapEdge[];
  onEdgeClick?: (id: string) => void;
  /** « indicatif » : pointillés (lignes droites) ; « route » : trait plein (chemin calculé). */
  pathStyle?: "indicatif" | "route";
  dots?: readonly MapDot[];
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (id: string) => void;
  onMarkerDragEnd?: (id: string, lat: number, lng: number) => void;
  /** Change quand il faut recadrer la carte sur tous les marqueurs. */
  fitKey?: string;
  /** Points sur lesquels recadrer (par défaut : les marqueurs), ex. un itinéraire calculé. */
  fitTo?: readonly [number, number][];
  /** Centre la carte sur un point (animation), à chaque changement de `key`. */
  focus?: MapFocus;
  /** Marges (px) laissées libres lors d'un recadrage, ex. sous un panneau flottant. */
  fitPadding?: { left?: number; top?: number; right?: number; bottom?: number };
  initialLayer?: BaseLayerId;
  /** Classes de position des commandes de gauche (ex. décalées d'un panneau flottant). */
  leftControlsClassName?: string;
  className?: string;
};

const MAHAMBO: [number, number] = [-17.4896484, 49.4503963];

const PIN_COLORS = {
  default: "#0f6775",
  muted: "#96beca",
  new: "#c98a1b",
  selected: "#d93025",
} as const;

/** Épingle en goutte (SVG), avec le rang de l'étape ou un point blanc. */
function pinIcon(marker: MapMarker): L.DivIcon {
  const tone = marker.tone ?? "default";
  const big = tone === "selected" || tone === "new";
  const [w, h] = big ? [36, 48] : [28, 38];
  const inner = marker.badge
    ? `<text x="15" y="19.5" text-anchor="middle" font-size="12" font-weight="700" fill="${PIN_COLORS[tone]}" font-family="Poppins, sans-serif">${marker.badge}</text>`
    : `<circle cx="15" cy="15" r="4.5" fill="${PIN_COLORS[tone]}"/>`;
  return L.divIcon({
    className: "gt-pin",
    html: `<svg width="${w}" height="${h}" viewBox="0 0 30 40" aria-hidden="true">
      <path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.4 15 39 15 39s14-13.6 14-24.1C29 7.2 22.7 1 15 1z" fill="${PIN_COLORS[tone]}" stroke="#fff" stroke-width="2"/>
      <circle cx="15" cy="15" r="${marker.badge ? 8 : 6.5}" fill="#fff"/>${inner}</svg>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    tooltipAnchor: [w / 2, -h / 2],
  });
}

function stopMapEvents(element: HTMLElement | null) {
  if (!element) return;
  L.DomEvent.disableClickPropagation(element);
  L.DomEvent.disableScrollPropagation(element);
}

function FitBounds({
  points,
  fitKey,
  padding,
}: {
  points: [number, number][];
  fitKey?: string;
  padding: Required<NonNullable<LeafletMapProps["fitPadding"]>>;
}) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0]!, 13);
    else if (points.length > 1) {
      map.fitBounds(points, {
        paddingTopLeft: [padding.left + 40, padding.top + 40],
        paddingBottomRight: [padding.right + 40, padding.bottom + 40],
        maxZoom: 14,
      });
    }
    // Recadrage seulement quand `fitKey` change (pas à chaque déplacement de marqueur).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);
  return null;
}

function FlyTo({ focus }: { focus?: MapFocus }) {
  const map = useMap();
  useEffect(() => {
    if (focus)
      map.flyTo([focus.lat, focus.lng], focus.zoom ?? Math.max(map.getZoom(), 13), {
        duration: 0.6,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focus?.key]);
  return null;
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/** Commandes flottantes : recentrer + zoom (bas droite), calques (bas gauche). */
function Controls({
  layer,
  setLayer,
  points,
  leftClassName,
}: {
  layer: BaseLayerId;
  setLayer: (layer: BaseLayerId) => void;
  points: [number, number][];
  leftClassName: string;
}) {
  const map = useMap();
  const [layersOpen, setLayersOpen] = useState(false);
  const rightRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stopMapEvents(rightRef.current);
    stopMapEvents(leftRef.current);
  }, []);

  const button =
    "grid size-10 place-items-center bg-white text-gt-teal-900 hover:bg-gt-teal-50 focus-visible:outline-2 focus-visible:outline-gt-teal-600";

  return (
    <>
      <div
        ref={rightRef}
        className="absolute right-3 bottom-8 z-[1000] flex flex-col items-end gap-2"
      >
        <button
          type="button"
          onClick={() =>
            points.length > 0 && map.fitBounds(points, { padding: [60, 60], maxZoom: 14 })
          }
          className={`${button} rounded-full shadow-md`}
          aria-label="Recentrer sur tous les lieux"
          title="Recentrer"
        >
          <Icon name="crosshair" className="size-5" />
        </button>
        <div className="overflow-hidden rounded-xl shadow-md">
          <button
            type="button"
            onClick={() => map.zoomIn()}
            className={button}
            aria-label="Zoom avant"
          >
            <Icon name="plus" className="size-5" />
          </button>
          <div className="h-px bg-gt-mist" />
          <button
            type="button"
            onClick={() => map.zoomOut()}
            className={button}
            aria-label="Zoom arrière"
          >
            <Icon name="minus" className="size-5" />
          </button>
        </div>
      </div>

      <div
        ref={leftRef}
        className={`absolute bottom-8 z-[1000] flex items-end gap-2 ${leftClassName}`}
      >
        <button
          type="button"
          onClick={() => setLayersOpen((open) => !open)}
          aria-expanded={layersOpen}
          className="group relative size-[76px] overflow-hidden rounded-xl border-2 border-white shadow-md"
        >
          {/* Vignette : aperçu du calque suivant, comme le bouton « Calques » de la maquette. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BASE_LAYERS[layer === "satellite" ? "plan" : "satellite"].preview}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1 text-[11px] font-semibold text-white">
            <Icon name="layers" className="size-3.5" />
            Calques
          </span>
        </button>
        {layersOpen ? (
          <div className="flex gap-2 rounded-xl bg-white p-2 shadow-md">
            {(Object.keys(BASE_LAYERS) as BaseLayerId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setLayer(id);
                  setLayersOpen(false);
                }}
                aria-pressed={layer === id}
                className="flex w-16 flex-col items-center gap-1 text-[11px] font-medium text-gt-teal-900"
              >
                <span
                  className={`size-14 overflow-hidden rounded-lg border-2 ${layer === id ? "border-gt-teal-600" : "border-transparent"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={BASE_LAYERS[id].preview} alt="" className="size-full object-cover" />
                </span>
                {BASE_LAYERS[id].label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

/** Un tronçon : liseré blanc + trait coloré + zone de clic invisible plus large. */
function EdgeLine({
  positions,
  color,
  dashed,
  weight,
  label,
  onClick,
}: {
  positions: [number, number][];
  color: string;
  dashed: boolean;
  weight: number;
  label: string;
  onClick?: () => void;
}) {
  return (
    <>
      <Polyline
        positions={positions}
        interactive={false}
        pathOptions={{ color: "#fff", weight: weight + 3, opacity: 0.9 }}
      />
      <Polyline
        positions={positions}
        interactive={false}
        pathOptions={{ color, weight, dashArray: dashed ? "7 7" : undefined, opacity: 0.95 }}
      />
      <Polyline
        positions={positions}
        pathOptions={{ color: "#000", weight: 16, opacity: 0 }}
        eventHandlers={onClick ? { click: onClick } : undefined}
      >
        <Tooltip sticky className="gt-edge-tooltip">
          {label}
        </Tooltip>
      </Polyline>
    </>
  );
}

export default function LeafletMap({
  markers,
  path,
  edges,
  onEdgeClick,
  pathStyle = "indicatif",
  dots,
  onMapClick,
  onMarkerClick,
  onMarkerDragEnd,
  fitKey,
  fitTo,
  focus,
  fitPadding,
  initialLayer = "plan",
  leftControlsClassName = "left-3",
  className = "h-[420px]",
}: LeafletMapProps) {
  const [layer, setLayer] = useState<BaseLayerId>(initialLayer);
  const points = useMemo(() => markers.map((m) => [m.lat, m.lng] as [number, number]), [markers]);
  const tiles = BASE_LAYERS[layer];
  const padding = { left: 0, top: 0, right: 0, bottom: 0, ...fitPadding };

  return (
    <MapContainer
      center={points[0] ?? MAHAMBO}
      zoom={12}
      zoomControl={false}
      scrollWheelZoom
      className={`gt-map z-0 w-full ${onMapClick ? "cursor-crosshair" : ""} ${className}`}
    >
      <TileLayer
        key={layer}
        url={tiles.url}
        {...(tiles.subdomains ? { subdomains: tiles.subdomains } : {})}
        attribution={tiles.attribution}
        maxZoom={tiles.maxZoom}
        detectRetina
      />
      <FitBounds
        points={fitTo && fitTo.length > 0 ? [...fitTo] : points}
        fitKey={fitKey}
        padding={padding}
      />
      <FlyTo focus={focus} />
      {onMapClick ? <ClickHandler onMapClick={onMapClick} /> : null}
      {path && path.length > 1 ? (
        <>
          {/* Tracé avec liseré blanc, comme un itinéraire Google Maps (pointillés : tracé indicatif). */}
          <Polyline
            positions={path as [number, number][]}
            pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.9 }}
          />
          <Polyline
            positions={path as [number, number][]}
            pathOptions={{
              color: "#1a73e8",
              weight: pathStyle === "route" ? 6 : 4,
              dashArray: pathStyle === "route" ? undefined : "8 8",
              opacity: 0.95,
            }}
          />
        </>
      ) : null}
      {edges?.map((edge) => {
        const tone = edge.tone ?? "default";
        const positions: [number, number][] = [edge.from, edge.to];
        return (
          <EdgeLine
            key={`${edge.id}-${tone}`}
            positions={positions}
            color={EDGE_COLORS[tone]}
            dashed={edge.dashed ?? false}
            weight={tone === "muted" ? 2.5 : tone === "selected" ? 5 : 4}
            label={edge.label}
            onClick={onEdgeClick ? () => onEdgeClick(edge.id) : undefined}
          />
        );
      })}
      {dots?.map((dot) => (
        <CircleMarker
          key={dot.id}
          center={[dot.lat, dot.lng]}
          radius={9}
          pathOptions={{ color: "#fff", weight: 2, fillColor: dot.color, fillOpacity: 0.9 }}
        >
          <Tooltip direction="top">{dot.label}</Tooltip>
        </CircleMarker>
      ))}
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.lat, marker.lng]}
          icon={pinIcon(marker)}
          draggable={marker.draggable ?? false}
          keyboard
          title={marker.label}
          zIndexOffset={marker.tone === "selected" || marker.tone === "new" ? 1000 : 0}
          eventHandlers={{
            click: () => onMarkerClick?.(marker.id),
            dragend: (event) => {
              const { lat, lng } = (event.target as L.Marker).getLatLng();
              onMarkerDragEnd?.(marker.id, lat, lng);
            },
          }}
        >
          <Tooltip
            // Nom affiché en permanence pour le lieu sélectionné (comme la maquette), au survol sinon.
            key={`${marker.id}-${marker.tone}`}
            permanent={marker.tone === "selected" || marker.tone === "new"}
            direction="right"
            offset={[6, 0]}
            className={
              marker.tone === "selected" ? "gt-pin-label gt-pin-label--selected" : "gt-pin-label"
            }
          >
            {marker.label}
          </Tooltip>
        </Marker>
      ))}
      <Controls
        layer={layer}
        setLayer={setLayer}
        points={points}
        leftClassName={leftControlsClassName}
      />
    </MapContainer>
  );
}
