/**
 * Distance orthodromique (« à vol d'oiseau ») entre deux points GPS, par la formule de
 * Haversine (cahier des charges §6.1). Fonction pure, sans dépendance.
 *
 *   a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2)
 *   d = 2R · atan2(√a, √(1 − a))
 *
 * avec φ la latitude, λ la longitude (en radians) et R le rayon moyen de la Terre.
 * Elle sert aussi d'heuristique admissible pour A* (étape E6) : aucun chemin réel ne peut
 * être plus court que la ligne droite sur la sphère.
 */
export const EARTH_RADIUS_KM = 6371;

export type LatLng = { latitude: number; longitude: number };

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function haversineKm(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
