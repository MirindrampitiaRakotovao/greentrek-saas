import { EARTH_RADIUS_KM, haversineKm } from "@/lib/graph/haversine";
import type { Criteria, Graph } from "@/lib/graph/types";

/**
 * Heuristique d'A* (§6.2), ADMISSIBLE et COHÉRENTE par construction (décision B de l'E6).
 *
 * On ne suppose pas que les distances saisies respectent la ligne droite (une mesure de
 * terrain, ou des coordonnées imprécises, pourraient donner un tronçon plus court que la
 * distance de Haversine entre ses extrémités). On mesure donc sur le graphe lui-même :
 *
 *   ρ = min sur les arcs (u,v) de  distanceKm(u,v) / H(u,v)      (rapport au vol d'oiseau)
 *   v = max sur les arcs (u,v) de  H(u,v) / (dureeMinutes(u,v) / 60)   (vitesse « à vol
 *       d'oiseau » la plus élevée, en km/h)
 *
 *   h(n) = α · ρ · H(n, but) + β · H(n, but) / v          (le terme γ est minoré par 0)
 *
 * Cohérence (donc admissibilité) : pour tout arc (u,v),
 *   w(u,v) ≥ α·ρ·H(u,v) + β·H(u,v)/v        (définition de ρ et v ; γ·pénalité ≥ 0)
 * et, par l'inégalité triangulaire sur la sphère, H(u,but) ≤ H(u,v) + H(v,but), d'où
 *   h(u) ≤ w(u,v) + h(v).
 * Une heuristique cohérente ne surestime jamais le coût restant (h(but) = 0), et A* renvoie
 * alors un chemin optimal en ne traitant chaque nœud qu'une fois.
 */

export type HeuristicParams = {
  /** ρ : plus petit rapport distance du tronçon / distance à vol d'oiseau. */
  ratioMin: number;
  /** v : plus grande vitesse à vol d'oiseau observée (km/h). */
  speedMaxKmh: number;
};

/**
 * Calibrage mémorisé par graphe (prétraitement). Il ne dépend que du graphe, pas du départ
 * ni de l'arrivée : le recalculer à chaque recherche parcourait tous les arcs (un calcul de
 * Haversine par arc) et rendait A* plus lent que Dijkstra malgré moins de nœuds explorés
 * (mesure du benchmark, étape E6). `WeakMap` : l'entrée disparaît avec le graphe.
 */
const paramsCache = new WeakMap<Graph, HeuristicParams>();

export function heuristicParams(graph: Graph): HeuristicParams {
  const cached = paramsCache.get(graph);
  if (cached) return cached;
  const params = computeHeuristicParams(graph);
  paramsCache.set(graph, params);
  return params;
}

function computeHeuristicParams(graph: Graph): HeuristicParams {
  let ratioMin = Infinity;
  let speedMaxKmh = 0;
  for (const arcs of graph.adjacency.values()) {
    for (const arc of arcs) {
      const h = haversineKm(graph.nodes.get(arc.from)!, graph.nodes.get(arc.to)!);
      if (h <= 0) continue; // étapes confondues : l'arc ne contraint pas l'heuristique
      ratioMin = Math.min(ratioMin, arc.distanceKm / h);
      speedMaxKmh = Math.max(speedMaxKmh, h / (arc.dureeMinutes / 60));
    }
  }
  return { ratioMin: Number.isFinite(ratioMin) ? ratioMin : 0, speedMaxKmh };
}

/**
 * Construit h(n) vers le nœud `goalId`. Renvoie 0 partout si le graphe n'a pas d'arc.
 *
 * Optimisation (mesurée à l'étape E6, voir le benchmark) : sans elle, A* explorait bien
 * moins de nœuds que Dijkstra mais restait plus lent, car chaque insertion dans la file
 * recalculait une distance de Haversine (sinus, cosinus, arc tangente, racine). Ici :
 * - les valeurs trigonométriques de l'arrivée sont calculées une seule fois ;
 * - h(n) est mémorisé : chaque nœud n'est évalué qu'une fois, même s'il est inséré
 *   plusieurs fois dans la file.
 * La valeur de h est strictement la même (Haversine), donc toujours admissible.
 */
export function buildHeuristic(
  graph: Graph,
  goalId: string,
  criteria: Criteria,
  params: HeuristicParams = heuristicParams(graph),
): (nodeId: string) => number {
  const goal = graph.nodes.get(goalId);
  if (!goal) return () => 0;
  const { ratioMin, speedMaxKmh } = params;
  // Coefficient appliqué à la distance à vol d'oiseau : α·ρ + β / v.
  const factor = criteria.alpha * ratioMin + (speedMaxKmh > 0 ? criteria.beta / speedMaxKmh : 0);
  if (factor === 0) return () => 0;

  const toRad = Math.PI / 180;
  const goalLat = goal.latitude * toRad;
  const goalLng = goal.longitude * toRad;
  const cosGoalLat = Math.cos(goalLat);
  const memo = new Map<string, number>();

  return (nodeId) => {
    const cached = memo.get(nodeId);
    if (cached !== undefined) return cached;
    const node = graph.nodes.get(nodeId);
    let value = 0;
    if (node) {
      // Formule de Haversine (identique à haversine.ts), arrivée précalculée.
      const lat = node.latitude * toRad;
      const sinDLat = Math.sin((goalLat - lat) / 2);
      const sinDLng = Math.sin((goalLng - node.longitude * toRad) / 2);
      const a = sinDLat * sinDLat + Math.cos(lat) * cosGoalLat * sinDLng * sinDLng;
      value = factor * 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    memo.set(nodeId, value);
    return value;
  };
}
