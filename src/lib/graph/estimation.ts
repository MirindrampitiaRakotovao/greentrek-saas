import {
  COEFFICIENT_SINUOSITE,
  MONTEE_METRES_PAR_HEURE,
  VITESSE_MARCHE_KMH,
} from "@/lib/graph/config";
import { haversineKm, type LatLng } from "@/lib/graph/haversine";

/**
 * Estimations proposées pour un nouveau tronçon (§6.1), sans mesure de terrain.
 * Fonctions pures, testées unitairement.
 */

/** Distance estimée (km) = distance à vol d'oiseau × coefficient de sinuosité, arrondie à 10 m. */
export function estimateDistanceKm(
  from: LatLng,
  to: LatLng,
  sinuosite: number = COEFFICIENT_SINUOSITE,
): number {
  const km = haversineKm(from, to) * sinuosite;
  // Jamais nulle : la base exige une distance strictement positive (RG 6).
  return Math.max(0.01, Math.round(km * 100) / 100);
}

/**
 * Durée estimée (minutes), règle de Naismith adaptée : temps de marche sur la distance,
 * plus le temps de montée (seul le dénivelé POSITIF ralentit ; la descente est ignorée).
 * Arrondie à la minute supérieure, au moins 1 minute.
 */
export function estimateDurationMinutes(
  distanceKm: number,
  deniveleM: number | null = null,
  vitesseKmh: number = VITESSE_MARCHE_KMH,
  monteeMetresParHeure: number = MONTEE_METRES_PAR_HEURE,
): number {
  const marche = (distanceKm / vitesseKmh) * 60;
  const montee = (Math.max(0, deniveleM ?? 0) / monteeMetresParHeure) * 60;
  return Math.max(1, Math.ceil(marche + montee));
}
