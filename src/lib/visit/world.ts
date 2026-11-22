import { locateSteps, type VisitRoute } from "@/lib/visit/route";

/**
 * Monde 3D de la visite (étape 8b, « mode jeu ») : fonctions pures, testées. Le sol est le
 * VRAI relief (Mapzen Terrain Tiles) recouvert de la VRAIE image satellite (Esri), découpés
 * en tuiles « web Mercator » ; la scène utilise un repère local en mètres centré sur le
 * départ du circuit (x vers l'est, z vers le sud, y vers le haut).
 */

/** Niveau des tuiles de relief (≈ 2,4 km de côté) et de l'imagerie qui les recouvre. */
export const DEM_ZOOM = 14;
export const SAT_ZOOM = 16;

/** Position (fractionnaire) dans la grille des tuiles au zoom `z`. */
export function tileXY(lat: number, lng: number, z: number): [number, number] {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return [
    ((lng + 180) / 360) * n,
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
  ];
}

/** Coin nord-ouest de la tuile (x, y) au zoom `z`, en degrés. */
export function tileCorner(x: number, y: number, z: number): { lat: number; lng: number } {
  const n = 2 ** z;
  const lng = (x / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { lat, lng };
}

/** Altitude (m) codée dans un pixel « Terrarium » : (R × 256 + G + B / 256) − 32768. */
export function decodeTerrarium(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/** Repère local (mètres) centré sur (lat0, lng0) : projection équirectangulaire. */
export function localProjection(lat0: number, lng0: number) {
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const kz = 110_540;
  return {
    toLocal: (lat: number, lng: number): [number, number] => [
      (lng - lng0) * kx,
      -(lat - lat0) * kz,
    ],
    toLatLng: (x: number, z: number): [number, number] => [lat0 - z / kz, lng0 + x / kx],
  };
}

/**
 * Pixel de végétation sur l'image satellite : vert dominant et assez sombre (forêt, savoka,
 * cultures). Exclut l'eau (bleu dominant), le sable, les toits et les routes (clairs).
 */
export function isVegetation(r: number, g: number, b: number): boolean {
  return g >= r * 0.98 && g >= b * 1.02 && r + g + b < 430;
}

/**
 * Portions du parcours faites en pirogue : pour chaque étape du chemin, le mode du tronçon
 * qui en part. Renvoie des intervalles [début, fin] en km le long de la balade, fusionnés.
 */
export function pirogueRanges(
  route: VisitRoute,
  waypoints: readonly { latitude: number; longitude: number; modeSuivant: "MARCHE" | "PIROGUE" }[],
): [number, number][] {
  const kms = locateSteps(
    route,
    waypoints.map((w) => [w.latitude, w.longitude]),
  );
  const out: [number, number][] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    if (waypoints[i]!.modeSuivant !== "PIROGUE") continue;
    const range: [number, number] = [kms[i]!, kms[i + 1]!];
    const last = out.at(-1);
    if (last && Math.abs(last[1] - range[0]) < 1e-9) last[1] = range[1];
    else out.push(range);
  }
  return out;
}

export function inRanges(ranges: readonly [number, number][], km: number): boolean {
  return ranges.some(([a, b]) => km >= a && km <= b);
}

/**
 * Le groupe : le guide ouvre la marche (s'il y en a un), les compagnons suivent à quelques
 * mètres. Renvoie l'écart (km) de chaque membre par rapport au voyageur principal.
 */
export function partyOffsets(compagnons: number, guide: boolean): number[] {
  const out: number[] = [];
  if (guide) out.push(0.006);
  for (let i = 1; i <= compagnons; i++) out.push(-0.0035 * i);
  return out;
}
