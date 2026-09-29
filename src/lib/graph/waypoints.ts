import { shortestPath, summarize } from "@/lib/graph/search";
import {
  type Algorithm,
  type Arc,
  type Criteria,
  type Graph,
  GraphError,
  type PathResult,
} from "@/lib/graph/types";

/**
 * Itinéraire passant par des étapes imposées (§6.2, point 3).
 *
 * - Ordre fixé : enchaînement des plus courts chemins départ → w1 → w2 → … → arrivée.
 * - Ordre libre (au plus 8 étapes imposées) : c'est une variante du problème du voyageur de
 *   commerce (chemin hamiltonien à extrémités fixées sur le graphe « complété » des plus
 *   courts chemins). On calcule d'abord les plus courts chemins entre toutes les étapes
 *   utiles, puis le meilleur ordre par l'algorithme de Held-Karp (programmation dynamique) :
 *
 *     C(S, j) = coût minimal pour partir du départ, visiter exactement l'ensemble S des
 *               étapes imposées et finir en j ∈ S
 *     C({j}, j)   = d(départ, j)
 *     C(S, j)     = min sur i ∈ S \ {j} de  C(S \ {j}, i) + d(i, j)
 *     optimum     = min sur j de  C(tout, j) + d(j, arrivée)
 *
 *   Complexité O(k² · 2^k) au lieu de O(k!) pour l'essai de toutes les permutations
 *   (8! = 40 320 ordres ; Held-Karp : 8² × 2⁸ ≈ 16 000 opérations).
 */

export const MAX_FREE_WAYPOINTS = 8;

export type WaypointResult = PathResult & {
  /** Ordre de visite retenu pour les étapes imposées. */
  order: string[];
  /** Tronçon (départ → arrivée) sans chemin, si l'itinéraire est impossible. */
  missingLeg?: { from: string; to: string };
};

type Leg = { from: string; to: string; result: PathResult };

export function shortestPathVia(
  graph: Graph,
  startId: string,
  goalId: string,
  waypoints: readonly string[],
  criteria: Criteria,
  algorithm: Algorithm,
  options: { ordered: boolean },
): WaypointResult {
  const t0 = performance.now();
  if (!options.ordered && waypoints.length > MAX_FREE_WAYPOINTS) {
    throw new GraphError(
      "TROP_D_ETAPES",
      `L'ordre libre est limité à ${MAX_FREE_WAYPOINTS} étapes imposées (complexité exponentielle).`,
    );
  }

  const legCache = new Map<string, Leg>();
  const leg = (from: string, to: string): Leg => {
    const key = `${from}→${to}`;
    let cached = legCache.get(key);
    if (!cached) {
      cached = { from, to, result: shortestPath(graph, from, to, criteria, algorithm) };
      legCache.set(key, cached);
    }
    return cached;
  };

  const order = options.ordered ? [...waypoints] : bestOrder(startId, goalId, waypoints, leg);
  const sequence = [startId, ...order, goalId];
  const legs = sequence.slice(1).map((to, i) => leg(sequence[i]!, to));

  // Nœuds explorés : somme sur TOUS les calculs effectués (y compris ceux de la recherche
  // du meilleur ordre), pour une comparaison honnête entre algorithmes.
  const explored = [...legCache.values()].flatMap((l) => l.result.explored);
  const timeMs = performance.now() - t0;

  const missing = legs.find((l) => !l.result.found);
  if (missing) {
    return {
      found: false,
      path: [],
      arcs: [],
      cost: Infinity,
      distanceKm: 0,
      dureeMinutes: 0,
      difficulteCumulee: 0,
      difficulteMoyenne: 0,
      exploredCount: explored.length,
      explored,
      timeMs,
      order,
      missingLeg: { from: missing.from, to: missing.to },
    };
  }

  const arcs: Arc[] = legs.flatMap((l) => l.result.arcs);
  const cost = legs.reduce((sum, l) => sum + l.result.cost, 0);
  return { ...summarize(startId, arcs, cost, explored, timeMs), order };
}

/** Meilleur ordre de visite (Held-Karp) ; les étapes injoignables sont repoussées à la fin. */
function bestOrder(
  startId: string,
  goalId: string,
  waypoints: readonly string[],
  leg: (from: string, to: string) => Leg,
): string[] {
  const k = waypoints.length;
  if (k <= 1) return [...waypoints];
  const d = (from: string, to: string) => leg(from, to).result.cost; // Infinity si aucun chemin

  const full = (1 << k) - 1;
  // cost[S][j] et parent[S][j] : S est un masque de bits des étapes visitées.
  const cost: number[][] = Array.from({ length: 1 << k }, () =>
    new Array<number>(k).fill(Infinity),
  );
  const parent: number[][] = Array.from({ length: 1 << k }, () => new Array<number>(k).fill(-1));
  for (let j = 0; j < k; j += 1) cost[1 << j]![j] = d(startId, waypoints[j]!);

  for (let set = 1; set <= full; set += 1) {
    for (let j = 0; j < k; j += 1) {
      if (!(set & (1 << j)) || cost[set]![j] === Infinity) continue;
      for (let next = 0; next < k; next += 1) {
        if (set & (1 << next)) continue;
        const nextSet = set | (1 << next);
        const candidate = cost[set]![j]! + d(waypoints[j]!, waypoints[next]!);
        if (candidate < cost[nextSet]![next]!) {
          cost[nextSet]![next] = candidate;
          parent[nextSet]![next] = j;
        }
      }
    }
  }

  let best = Infinity;
  let last = -1;
  for (let j = 0; j < k; j += 1) {
    const total = cost[full]![j]! + d(waypoints[j]!, goalId);
    if (total < best) {
      best = total;
      last = j;
    }
  }
  if (last === -1) return [...waypoints]; // aucun ordre possible : on garde l'ordre donné

  const order: string[] = [];
  for (let set = full, j = last; j !== -1;) {
    order.push(waypoints[j]!);
    const previous = parent[set]![j]!;
    set &= ~(1 << j);
    j = previous;
  }
  return order.reverse();
}
