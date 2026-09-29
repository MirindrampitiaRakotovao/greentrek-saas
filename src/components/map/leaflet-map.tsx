"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

/**
 * Carte Leaflet + tuiles OpenStreetMap (§9 : gratuites, sans carte bancaire). Ce module
 * n'est jamais rendu côté serveur (Leaflet a besoin de `window`) : il est chargé par
 * `MapView` avec un import dynamique.
 * Marqueurs en `divIcon` (HTML stylé) : les images de marqueur par défaut de Leaflet se
 * chargent mal avec les bundlers, et on veut afficher le rang de l'étape.
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

export type LeafletMapProps = {
  markers: readonly MapMarker[];
  path?: readonly [number, number][];
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (id: string) => void;
  onMarkerDragEnd?: (id: string, lat: number, lng: number) => void;
  /** Change quand il faut recadrer la carte sur les marqueurs. */
  fitKey?: string;
  /** Centre par défaut quand il n'y a aucun marqueur (Mahambo, source OpenStreetMap). */
  defaultCenter?: [number, number];
  className?: string;
};

const MAHAMBO: [number, number] = [-17.4896484, 49.4503963];

function markerIcon(marker: MapMarker): L.DivIcon {
  const tone = marker.tone ?? "default";
  return L.divIcon({
    className: "gt-marker-wrapper",
    html: `<span class="gt-marker gt-marker--${tone}">${marker.badge ?? ""}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function FitBounds({ points, fitKey }: { points: [number, number][]; fitKey?: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0]!, 13);
    else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
    // Recadrage seulement quand `fitKey` change (pas à chaque déplacement de marqueur).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);
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

export default function LeafletMap({
  markers,
  path,
  onMapClick,
  onMarkerClick,
  onMarkerDragEnd,
  fitKey,
  defaultCenter = MAHAMBO,
  className = "h-[420px]",
}: LeafletMapProps) {
  const points = useMemo(() => markers.map((m) => [m.lat, m.lng] as [number, number]), [markers]);

  return (
    <MapContainer
      center={points[0] ?? defaultCenter}
      zoom={12}
      scrollWheelZoom
      className={`z-0 w-full rounded-2xl ${onMapClick ? "cursor-crosshair" : ""} ${className}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitBounds points={points} fitKey={fitKey} />
      {onMapClick ? <ClickHandler onMapClick={onMapClick} /> : null}
      {path && path.length > 1 ? (
        <Polyline
          positions={path as [number, number][]}
          pathOptions={{ color: "#0f414d", weight: 3, dashArray: "6 6", opacity: 0.8 }}
        />
      ) : null}
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.lat, marker.lng]}
          icon={markerIcon(marker)}
          draggable={marker.draggable ?? false}
          keyboard
          title={marker.label}
          eventHandlers={{
            click: () => onMarkerClick?.(marker.id),
            dragend: (event) => {
              const { lat, lng } = (event.target as L.Marker).getLatLng();
              onMarkerDragEnd?.(marker.id, lat, lng);
            },
          }}
        >
          <Tooltip direction="top" offset={[0, -14]}>
            {marker.label}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
