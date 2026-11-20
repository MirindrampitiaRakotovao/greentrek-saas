import { haversineKm, type LatLng } from "@/lib/graph/haversine";

/**
 * Tracés réels des tronçons (étape 6b-2) : fonctions pures, sans base de données ni réseau,
 * testées unitairement. Un tracé est une liste de points [longitude, latitude] (ordre GeoJSON)
 * allant de l'étape de départ du tronçon à son étape d'arrivée.
 *
 * Le tracé ne sert qu'à l'affichage et, si l'agence le choisit, à mesurer la distance du
 * tronçon : les algorithmes (Dijkstra, A*) n'utilisent toujours que `distanceKm`.
 */

export type TracePoint = [lng: number, lat: number];

/** Nombre maximal de points enregistrés (une randonnée de 20 km en compte ~400 chez OSM). */
export const TRACE_MAX_POINTS = 5000;

const at = (p: TracePoint): LatLng => ({ latitude: p[1], longitude: p[0] });

/** Longueur d'un tracé (km) : somme des distances de Haversine entre points successifs. */
export function traceLengthKm(trace: readonly TracePoint[]): number {
  let km = 0;
  for (let i = 1; i < trace.length; i++) km += haversineKm(at(trace[i - 1]!), at(trace[i]!));
  return km;
}

/** Longueur arrondie à 10 m, comme les distances des tronçons ; jamais nulle (RG 6). */
export function roundedLengthKm(trace: readonly TracePoint[]): number {
  return Math.max(0.01, Math.round(traceLengthKm(trace) * 100) / 100);
}

function samePoint(a: TracePoint, b: TracePoint): boolean {
  return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
}

/**
 * Raccorde un chemin aux deux étapes : le calcul de trajet d'OSM part du point de chemin
 * le plus proche de l'étape (quelques mètres, parfois plus) ; on ajoute donc les
 * coordonnées exactes des étapes au début et à la fin, sans doublon.
 */
export function attachEndpoints(
  path: readonly TracePoint[],
  from: TracePoint,
  to: TracePoint,
): TracePoint[] {
  const out: TracePoint[] = [from];
  for (const p of path) if (!samePoint(out.at(-1)!, p)) out.push(p);
  if (!samePoint(out.at(-1)!, to)) out.push(to);
  return out;
}

export type OsmRoute = {
  coordinates: TracePoint[];
  distanceKm: number;
  /** Distance (m) entre chaque étape et le chemin le plus proche trouvé par OSM. */
  accrocheM: [number, number];
};

/**
 * Lit la réponse du service de trajets OSRM (profil à pied) ; null si aucun chemin.
 * Format : { code: "Ok", routes: [{ distance, geometry: { coordinates } }], waypoints: [{ distance }] }.
 */
export function parseOsrmRoute(json: unknown): OsmRoute | null {
  if (!json || typeof json !== "object") return null;
  const data = json as {
    code?: unknown;
    routes?: { distance?: unknown; geometry?: { coordinates?: unknown } }[];
    waypoints?: { distance?: unknown }[];
  };
  if (data.code !== "Ok" || !Array.isArray(data.routes) || data.routes.length === 0) return null;
  const route = data.routes[0]!;
  const coordinates = route.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const points = coordinates.filter(
    (c): c is TracePoint =>
      Array.isArray(c) &&
      c.length >= 2 &&
      Number.isFinite(c[0]) &&
      Number.isFinite(c[1]) &&
      Math.abs(c[0]) <= 180 &&
      Math.abs(c[1]) <= 90,
  );
  if (points.length < 2) return null;
  const metres = (w?: { distance?: unknown }) =>
    typeof w?.distance === "number" ? Math.round(w.distance) : 0;
  return {
    coordinates: points.map((p) => [p[0], p[1]]),
    distanceKm: typeof route.distance === "number" ? route.distance / 1000 : traceLengthKm(points),
    accrocheM: [metres(data.waypoints?.[0]), metres(data.waypoints?.[1])],
  };
}

/* ─── Simplification (édition à la main) ─────────────────────────────────────────── */

/** Distance (m) d'un point à un segment, en projection locale (suffisant à cette échelle). */
function distanceToSegmentM(p: TracePoint, a: TracePoint, b: TracePoint): number {
  const k = Math.cos((a[1] * Math.PI) / 180) * 111_320;
  const [px, py] = [(p[0] - a[0]) * k, (p[1] - a[1]) * 110_540];
  const [bx, by] = [(b[0] - a[0]) * k, (b[1] - a[1]) * 110_540];
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  return Math.hypot(px - t * bx, py - t * by);
}

/**
 * Simplification de Douglas-Peucker : garde les points qui s'écartent de plus de
 * `toleranceM` mètres de la ligne simplifiée. Sert à éditer un long tracé OSM à la main
 * (quelques dizaines de points déplaçables au lieu de centaines). Garde toujours les extrémités.
 */
export function simplifyTrace(trace: readonly TracePoint[], toleranceM: number): TracePoint[] {
  if (trace.length <= 2) return [...trace];
  const keep = new Array<boolean>(trace.length).fill(false);
  keep[0] = keep[trace.length - 1] = true;
  const stack: [number, number][] = [[0, trace.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let max = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = distanceToSegmentM(trace[i]!, trace[start]!, trace[end]!);
      if (d > max) [max, index] = [d, i];
    }
    if (index !== -1 && max > toleranceM) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return trace.filter((_, i) => keep[i]);
}

/** Insère un point dans le segment le plus proche (édition : clic sur la carte). */
export function insertPoint(trace: readonly TracePoint[], point: TracePoint): TracePoint[] {
  if (trace.length < 2) return [...trace, point];
  let best = 1;
  let min = Infinity;
  for (let i = 1; i < trace.length; i++) {
    const d = distanceToSegmentM(point, trace[i - 1]!, trace[i]!);
    if (d < min) [min, best] = [d, i];
  }
  return [...trace.slice(0, best), point, ...trace.slice(best)];
}

/* ─── Enchaînement le long d'un itinéraire ──────────────────────────────────────── */

/** Tracé enregistré d'un tronçon, dans le sens départ → arrivée du tronçon. */
export type StoredTrace = { from: string; to: string; trace: readonly TracePoint[] };

const key = (a: string, b: string) => `${a}|${b}`;

/** Index des tracés par couple d'étapes, utilisable dans les deux sens. */
export function traceIndex(traces: readonly StoredTrace[]): Map<string, readonly TracePoint[]> {
  const index = new Map<string, readonly TracePoint[]>();
  for (const t of traces) index.set(key(t.from, t.to), t.trace);
  // Sens inverse (tronçon parcouru à l'envers) : seulement si aucun tracé n'existe déjà dans
  // ce sens (deux tronçons à sens unique A→B et B→A gardent chacun le leur).
  for (const t of traces) {
    if (!index.has(key(t.to, t.from))) index.set(key(t.to, t.from), [...t.trace].reverse());
  }
  return index;
}

export type PathGeometry = {
  /** Points [latitude, longitude] de l'itinéraire complet (ordre Leaflet). */
  line: [number, number][];
  /** Nombre de tronçons du chemin qui ont un tracé réel, sur le total. */
  traces: number;
  legs: number;
};

/**
 * Géométrie d'un itinéraire : pour chaque tronçon du chemin, son tracé réel (orienté dans le
 * sens du parcours), sinon une ligne droite entre les deux étapes.
 */
export function chainPathGeometry(
  path: readonly ({ id: string } & LatLng)[],
  index: ReadonlyMap<string, readonly TracePoint[]>,
): PathGeometry {
  const line: [number, number][] = [];
  let traces = 0;
  const push = (lat: number, lng: number) => {
    const last = line.at(-1);
    if (!last || Math.abs(last[0] - lat) > 1e-7 || Math.abs(last[1] - lng) > 1e-7) {
      line.push([lat, lng]);
    }
  };
  if (path[0]) push(path[0].latitude, path[0].longitude);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const trace = index.get(key(a.id, b.id));
    if (trace && trace.length >= 2) {
      traces++;
      for (const [lng, lat] of trace) push(lat, lng);
    }
    push(b.latitude, b.longitude);
  }
  return { line, traces, legs: Math.max(0, path.length - 1) };
}
