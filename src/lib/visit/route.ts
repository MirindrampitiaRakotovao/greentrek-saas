import { haversineKm } from "@/lib/graph/haversine";

/**
 * Visite virtuelle d'un circuit (étape 8a) : géométrie de la balade, en fonctions pures
 * testées. Le randonneur avance le long du VRAI tracé du circuit (tracés des tronçons, étape
 * 6b-2), repéré par la distance parcourue depuis le départ (km).
 */

export type LatLngPoint = [lat: number, lng: number];

export type VisitRoute = {
  points: LatLngPoint[];
  /** Distance cumulée (km) depuis le départ, pour chaque point. */
  cumulKm: number[];
  totalKm: number;
};

const ll = ([lat, lng]: LatLngPoint) => ({ latitude: lat, longitude: lng });

/** Prépare la balade : retire les points doublés, calcule les distances cumulées. */
export function buildRoute(points: readonly LatLngPoint[]): VisitRoute {
  const clean: LatLngPoint[] = [];
  for (const p of points) {
    const last = clean.at(-1);
    if (!last || Math.abs(last[0] - p[0]) > 1e-9 || Math.abs(last[1] - p[1]) > 1e-9) clean.push(p);
  }
  const cumulKm = [0];
  for (let i = 1; i < clean.length; i++) {
    cumulKm.push(cumulKm[i - 1]! + haversineKm(ll(clean[i - 1]!), ll(clean[i]!)));
  }
  return { points: clean, cumulKm, totalKm: cumulKm.at(-1) ?? 0 };
}

/** Cap (degrés, 0 = nord, sens horaire) pour aller de `a` vers `b`. */
export function bearingDeg(a: LatLngPoint, b: LatLngPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [φ1, φ2] = [toRad(a[0]), toRad(b[0])];
  const Δλ = toRad(b[1] - a[1]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Indice du segment [i, i+1] qui contient la distance `km` (recherche dichotomique). */
function segmentAt(route: VisitRoute, km: number): number {
  let lo = 0;
  let hi = route.points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (route.cumulKm[mid]! <= km) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Position et cap du randonneur après `km` kilomètres (bornés au départ et à l'arrivée). */
export function positionAt(route: VisitRoute, km: number): { point: LatLngPoint; bearing: number } {
  const n = route.points.length;
  if (n === 0) return { point: [0, 0], bearing: 0 };
  if (n === 1) return { point: route.points[0]!, bearing: 0 };
  const d = Math.min(Math.max(km, 0), route.totalKm);
  const i = Math.min(segmentAt(route, d), n - 2);
  const a = route.points[i]!;
  const b = route.points[i + 1]!;
  const length = route.cumulKm[i + 1]! - route.cumulKm[i]!;
  const t = length > 0 ? (d - route.cumulKm[i]!) / length : 0;
  return {
    point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    bearing: bearingDeg(a, b),
  };
}

/**
 * Distance (km) de chaque étape du circuit le long de la balade : point du tracé le plus
 * proche de l'étape, en avançant (une étape n'est jamais placée avant la précédente, même si
 * le sentier repasse près d'elle).
 */
export function locateSteps(route: VisitRoute, steps: readonly LatLngPoint[]): number[] {
  const out: number[] = [];
  let from = 0;
  for (const step of steps) {
    let best = from;
    let min = Infinity;
    for (let i = from; i < route.points.length; i++) {
      const d = haversineKm(ll(step), ll(route.points[i]!));
      if (d < min) [min, best] = [d, i];
    }
    out.push(route.cumulKm[best] ?? 0);
    from = best;
  }
  return out;
}

/** Étape la plus proche à moins de `radiusKm` de la position, ou -1. */
export function stepNear(stepKms: readonly number[], km: number, radiusKm: number): number {
  let best = -1;
  let min = radiusKm;
  stepKms.forEach((s, i) => {
    const d = Math.abs(s - km);
    if (d <= min) [min, best] = [d, i];
  });
  return best;
}

/** Rapproche l'angle `from` de `to` par le plus court chemin (caméra fluide). */
export function lerpAngle(from: number, to: number, t: number): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

/**
 * Vitesse de la balade : 1 km de sentier parcouru en 4 secondes (×3 en courant). Une
 * randonnée de 6 km se visite ainsi en une trentaine de secondes.
 */
export const VISIT_KM_PER_SECOND = 0.25;
export const VISIT_SPRINT = 3;

/** Ambiances de lumière (la plus « jeu vidéo » des surprises, sans rien inventer du lieu). */
export type Ambiance = "aube" | "jour" | "crepuscule" | "nuit";

export const AMBIANCES: Record<
  Ambiance,
  {
    label: string;
    sky: { sky: string; horizon: string; fog: string };
    /** Réglages de l'image satellite : luminosité max, saturation, contraste. */
    raster: { brightnessMax: number; saturation: number; contrast: number; hue: number };
  }
> = {
  aube: {
    label: "Aube",
    sky: { sky: "#7d8fc7", horizon: "#f6b9a0", fog: "#f3c7b3" },
    raster: { brightnessMax: 0.82, saturation: -0.1, contrast: 0.05, hue: -8 },
  },
  jour: {
    label: "Jour",
    sky: { sky: "#7fb8dc", horizon: "#e6f1f4", fog: "#e6f1f4" },
    raster: { brightnessMax: 1, saturation: 0.1, contrast: 0.08, hue: 0 },
  },
  crepuscule: {
    label: "Crépuscule",
    sky: { sky: "#3b3f78", horizon: "#ff9a5a", fog: "#f0a36f" },
    raster: { brightnessMax: 0.72, saturation: 0.05, contrast: 0.12, hue: 10 },
  },
  nuit: {
    label: "Nuit",
    sky: { sky: "#050b1a", horizon: "#1b2d4a", fog: "#12203a" },
    raster: { brightnessMax: 0.32, saturation: -0.45, contrast: 0.1, hue: -20 },
  },
};

/** Ambiance qui correspond à l'heure de Madagascar (UTC+3) : surprise à l'ouverture. */
export function ambianceForHour(hour: number): Ambiance {
  if (hour >= 5 && hour < 8) return "aube";
  if (hour >= 8 && hour < 17) return "jour";
  if (hour >= 17 && hour < 19) return "crepuscule";
  return "nuit";
}
