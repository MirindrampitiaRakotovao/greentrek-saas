import { shortestPath } from "@/lib/graph/search";
import type { Criteria, Graph, PathResult } from "@/lib/graph/types";

/**
 * Algorithme A* (§6.2) : Dijkstra guidé par une heuristique admissible fondée sur la
 * distance de Haversine (heuristic.ts). Même coût optimal que Dijkstra, en explorant en
 * général moins de nœuds : ceux qui s'éloignent de l'arrivée sont développés plus tard.
 */
export function astar(
  graph: Graph,
  startId: string,
  goalId: string,
  criteria: Criteria,
): PathResult {
  return shortestPath(graph, startId, goalId, criteria, "ASTAR");
}
